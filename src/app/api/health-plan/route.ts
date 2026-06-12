import { NextResponse } from "next/server";

const OPENAI_RESPONSES_API_URL = "https://api.openai.com/v1/responses";

type HealthPlanRequest = {
  context?: {
    zipCode?: string;
    city?: string;
    state?: string;
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
    airQuality?: string;
    fluActivity?: string;
    covidActivity?: string;
    covidCoverage?: string;
    news?: {
      title: string;
      source: string;
      publishedAt: string;
      url: string;
    }[];
  };
  model?: {
    version?: string;
    score?: number;
    topDrivers?: {
      label: string;
      points: number;
      detail: string;
      category: string;
    }[];
    categoryScores?: {
      label: string;
      score: number;
      detail: string;
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

function formatPlanContext(body: HealthPlanRequest) {
  const context = body.context;
  const model = body.model;
  const news = context?.news?.length
    ? context.news
        .slice(0, 5)
        .map(
          (article, index) =>
            `${index + 1}. ${article.title} (${article.source}, ${
              article.publishedAt
            })`
        )
        .join("\n")
    : "No relevant local news articles were found.";
  const topDrivers = model?.topDrivers?.length
    ? model.topDrivers
        .map(
          (driver) =>
            `- ${driver.label}: +${driver.points}, ${driver.detail}, category ${driver.category}`
        )
        .join("\n")
    : "No elevated top drivers were provided.";
  const categories = model?.categoryScores?.length
    ? model.categoryScores
        .map(
          (category) =>
            `- ${category.label}: ${category.score}/100 (${category.detail})`
        )
        .join("\n")
    : "No category scores were provided.";

  return `
Location:
- ZIP: ${context?.zipCode ?? "Unknown"}
- City/state: ${context?.city ?? "Unknown"}, ${context?.state ?? "Unknown"}

Risk model:
- Version: ${model?.version ?? "Unknown"}
- Transparent index: ${model?.score ?? "Unknown"}/100
- Overall health risk: ${context?.healthRisk ?? "Unknown"}
- Respiratory risk: ${context?.respiratoryRisk ?? "Unknown"}
- Profile summary: ${context?.profileSummary ?? "No profile summary"}
- Profile factors: ${
    context?.profileReasons?.length
      ? context.profileReasons.join(", ")
      : "No saved profile factors were used"
  }

Category scores:
${categories}

Top model drivers:
${topDrivers}

Environmental and respiratory signals:
- Air quality: ${context?.airQuality ?? "Unknown"}
- Dominant pollutant: ${context?.dominantPollutant ?? "Unknown"}
- Pollutant-specific risk: ${context?.pollutantRisk ?? "Unknown"}
- Heat risk: ${context?.heatRisk ?? "Unknown"}
- UV risk: ${context?.uvRisk ?? "Unknown"}
- Alert risk: ${context?.alertRisk ?? "Unknown"}
- Active alerts: ${
    context?.activeAlerts?.length
      ? context.activeAlerts.join(", ")
      : "No active alerts provided"
  }
- Flu activity: ${context?.fluActivity ?? "Unknown"}
- COVID wastewater: ${context?.covidActivity ?? "Unknown"}
- COVID coverage: ${context?.covidCoverage ?? "Unknown"}

Local health news:
${news}
`.trim();
}

function parsePlan(rawText: string) {
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    return {
      headline: "AI health plan generated",
      summary: cleaned,
      priority: "Review today&apos;s local signals before outdoor activity.",
      actions: [],
      watch: [],
      uncertainty: "The response could not be structured automatically.",
    };
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "The AI plan is not configured yet. Add OPENAI_API_KEY to .env.local, then restart the dev server.",
      },
      { status: 503 }
    );
  }

  const body = (await request.json()) as HealthPlanRequest;
  const prompt = `
You are generating a concise, practical public-health planning brief for YourLocalHealth.

Use only the provided dashboard context plus general public-health knowledge. Do not diagnose, prescribe, or claim certainty. Do not invent missing data. If symptoms sound severe or urgent, recommend contacting emergency services or a medical professional.

Return only valid JSON with this exact shape:
{
  "headline": "short location-specific headline",
  "summary": "2 sentence plain-English explanation",
  "priority": "the single most important thing to pay attention to today",
  "actions": ["3 to 5 practical, non-medical actions"],
  "watch": ["2 to 4 signals or situations to monitor"],
  "uncertainty": "one sentence about data limits"
}

Dashboard context:
${formatPlanContext(body)}
`.trim();

  try {
    const response = await fetch(OPENAI_RESPONSES_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
        input: prompt,
        temperature: 0.2,
        max_output_tokens: 650,
      }),
    });

    const data = (await response.json()) as OpenAIResponse & {
      error?: { message?: string };
    };

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            data.error?.message ??
            "The AI health plan is temporarily unavailable.",
        },
        { status: response.status }
      );
    }

    return NextResponse.json({ plan: parsePlan(getResponseText(data)) });
  } catch {
    return NextResponse.json(
      { error: "The AI health plan is temporarily unavailable." },
      { status: 503 }
    );
  }
}
