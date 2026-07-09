import { NextResponse } from "next/server";
import {
  buildAiSafetyAudit,
  unsafeQuestionMessage,
  urgentCareMessage,
} from "../../../lib/aiSafety";
import {
  healthChatSchema,
  validationErrorMessage,
} from "../../../lib/apiValidation";
import { isFeatureEnabled } from "../../../lib/featureFlags";
import { traceAsync } from "../../../lib/observability";
import { getRateLimitKey, rateLimit } from "../../../lib/rateLimit";

const OPENAI_RESPONSES_API_URL = "https://api.openai.com/v1/responses";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type HealthChatRequest = {
  question?: string;
  messages?: ChatMessage[];
  context?: {
    zipCode?: string;
    city?: string;
    state?: string;
    aqi?: number | null;
    airQuality?: string;
    fluActivity?: string;
    covidActivity?: string;
    covidValue?: number | null;
    covidSites?: number | null;
    covidCoverage?: string;
    covidTimePeriod?: string;
    covidUpdatedAt?: string;
    healthRisk?: string;
    respiratoryRisk?: string;
    profileSummary?: string;
    profileReasons?: string[];
    heatRisk?: string;
    uvRisk?: string;
    alertRisk?: string;
    activeAlerts?: string[];
    dominantPollutant?: string;
    pollutantRisk?: string;
    news?: {
      title: string;
      source: string;
      publishedAt: string;
      url: string;
    }[];
  };
};

type OpenAIResponse = {
  output_text?: string;
  output?: {
    content?: {
      text?: string;
      type?: string;
    }[];
  }[];
};

function getResponseText(data: OpenAIResponse) {
  if (data.output_text) {
    return data.output_text;
  }

  return (
    data.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text ?? "")
      .join("\n")
      .trim() ?? ""
  );
}

function formatContext(context: HealthChatRequest["context"]) {
  if (!context) {
    return "No location context was provided.";
  }

  const news = context.news?.length
    ? context.news
        .map(
          (article, index) =>
            `${index + 1}. ${article.title} (${article.source}, ${
              article.publishedAt
            }) - ${article.url}`
        )
        .join("\n")
    : "No relevant local news articles were found for this search.";

  return `
Location:
- ZIP: ${context.zipCode ?? "Unknown"}
- City/state: ${context.city ?? "Unknown"}, ${context.state ?? "Unknown"}

Dashboard signals:
- Overall health risk: ${context.healthRisk ?? "Unknown"}
- Respiratory risk: ${context.respiratoryRisk ?? "Unknown"}
- Personalization summary: ${context.profileSummary ?? "No profile summary"}
- Personalization factors: ${
    context.profileReasons?.length
      ? context.profileReasons.join(", ")
      : "No saved profile factors were used"
  }
- Heat risk: ${context.heatRisk ?? "Unknown"}
- UV risk: ${context.uvRisk ?? "Unknown"}
- Active alert risk: ${context.alertRisk ?? "Unknown"}
- Active alerts: ${
    context.activeAlerts?.length
      ? context.activeAlerts.join(", ")
      : "No active alerts provided"
  }
- Dominant pollutant signal: ${context.dominantPollutant ?? "Unknown"}
- Pollutant-specific risk: ${context.pollutantRisk ?? "Unknown"}
- Air quality: ${context.airQuality ?? "Unknown"}; AQI category value ${
    context.aqi ?? "unavailable"
  }
- Flu activity: ${context.fluActivity ?? "Unknown"}
- COVID wastewater activity: ${context.covidActivity ?? "Unknown"}
- COVID wastewater value: ${context.covidValue ?? "Unavailable"}
- COVID reporting sites: ${context.covidSites ?? "Unavailable"}
- COVID data coverage: ${context.covidCoverage ?? "Unknown"}
- COVID time period: ${context.covidTimePeriod ?? "Unknown"}
- COVID updated at: ${context.covidUpdatedAt ?? "Unknown"}

Local health news:
${news}
`.trim();
}

export async function POST(request: Request) {
  const limiter = rateLimit({
    key: getRateLimitKey(request, "api-health-chat"),
    limit: 10,
    windowMs: 60 * 1000,
  });

  if (!limiter.allowed) {
    return NextResponse.json(
      {
        answer: "Too many assistant requests. Please try again shortly.",
        retryAfterSeconds: limiter.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          "Retry-After": limiter.retryAfterSeconds.toString(),
        },
      }
    );
  }

  if (!isFeatureEnabled("aiAssistant")) {
    return NextResponse.json(
      {
        answer: "The health assistant is currently disabled.",
        audit: {
          blocked: true,
          urgent: false,
          reasons: ["AI assistant feature flag is disabled."],
          usedContext: [],
          disclaimer:
            "MyLocalHealth is informational only and does not provide medical advice, diagnosis, or treatment.",
        },
      },
      { status: 503 }
    );
  }

  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { answer: "Please send a valid JSON request body." },
      { status: 400 }
    );
  }

  const parsedBody = healthChatSchema.safeParse(rawBody);

  if (!parsedBody.success) {
    return NextResponse.json(
      { answer: validationErrorMessage(parsedBody.error) },
      { status: 400 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        answer:
          "The health assistant is not configured yet. Add OPENAI_API_KEY to .env.local, then restart the dev server.",
      },
      { status: 503 }
    );
  }

  const body = parsedBody.data as HealthChatRequest;
  const question = body.question?.trim();

  if (!question) {
    return NextResponse.json(
      { answer: "Please ask a question first." },
      { status: 400 }
    );
  }

  const audit = buildAiSafetyAudit({
    question,
    contextLabels: [
      body.context?.zipCode ? "location" : "",
      body.context?.airQuality ? "air quality" : "",
      body.context?.fluActivity ? "flu activity" : "",
      body.context?.covidActivity ? "COVID wastewater" : "",
      body.context?.healthRisk ? "risk model" : "",
      body.context?.news?.length ? "local news" : "",
    ].filter(Boolean),
  });

  if (audit.blocked) {
    return NextResponse.json({
      answer: unsafeQuestionMessage(),
      audit,
    });
  }

  const priorMessages = (body.messages ?? [])
    .slice(-6)
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");

  const prompt = `
You are the MyLocalHealth public health assistant.

Use only the provided dashboard context, local news list, and general public-health knowledge. Be clear about uncertainty. Do not diagnose, prescribe, or replace a clinician. If symptoms sound urgent, recommend contacting emergency services or a medical professional. If the user asks about personal symptoms, give general education and practical next steps, not a diagnosis.

Keep answers concise and useful for a nontechnical user. Mention which local signals matter most. If local news is relevant, cite the article title/source in plain language. If the provided data does not answer something, say so.

${formatContext(body.context)}

Recent conversation:
${priorMessages || "No prior messages."}

User question:
${question}
`.trim();

  try {
    const response = await traceAsync(
      "api.health_chat.openai",
      () =>
        fetch(OPENAI_RESPONSES_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
            input: audit.urgent
              ? `${urgentCareMessage()}\n\n${prompt}`
              : prompt,
            temperature: 0.2,
            max_output_tokens: 500,
          }),
        }),
      {
        route: "/api/health-chat",
        zipCode: body.context?.zipCode,
        urgent: audit.urgent,
      }
    );

    const data = (await response.json()) as OpenAIResponse & {
      error?: { message?: string };
    };

    if (!response.ok) {
      return NextResponse.json(
        {
          answer:
            data.error?.message ??
            "The health assistant is temporarily unavailable.",
          audit,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      answer:
        `${audit.urgent ? `${urgentCareMessage()}\n\n` : ""}${
          getResponseText(data) ||
          "I could not generate an answer from the current health context."
        }`,
      audit,
    });
  } catch {
    return NextResponse.json(
      { answer: "The health assistant is temporarily unavailable.", audit },
      { status: 503 }
    );
  }
}
