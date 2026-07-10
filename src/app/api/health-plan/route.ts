import { NextResponse } from "next/server";
import { healthDisclaimer } from "../../../lib/aiSafety";
import {
  healthPlanSchema,
  validationErrorMessage,
} from "../../../lib/apiValidation";
import { isFeatureEnabled } from "../../../lib/featureFlags";
import { traceAsync } from "../../../lib/observability";
import { getRateLimitKey, rateLimit } from "../../../lib/rateLimit";

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
  forecast?: {
    summary?: string;
    averageScore?: number;
    peakScore?: number;
    bestWindow?: string;
    bestWindowScore?: number | null;
    worstWindow?: string;
    worstWindowScore?: number | null;
    allergyPeakWindow?: string;
    allergyPeakScore?: number | null;
    pollenRisk?: string;
    trends?: {
      label: string;
      direction: string;
      peakTime: string;
      min: number | null;
      max: number | null;
      unit: string;
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

type HealthPlan = {
  headline: string;
  summary: string;
  priority: string;
  actions: string[];
  watch: string[];
  uncertainty: string;
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
  const forecast = body.forecast;
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
  const forecastTrends = forecast?.trends?.length
    ? forecast.trends
        .map(
          (trend) =>
            `- ${trend.label}: ${trend.direction}, peaks around ${
              trend.peakTime
            }, range ${trend.min ?? "unknown"} to ${
              trend.max ?? "unknown"
            } ${trend.unit}`
        )
        .join("\n")
    : "No forecast trend data was provided.";

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

Forecast context:
- Summary: ${forecast?.summary ?? "No forecast summary was provided"}
- Average forecast risk: ${forecast?.averageScore ?? "Unknown"}/100
- Peak forecast risk: ${forecast?.peakScore ?? "Unknown"}/100
- Best outdoor window: ${forecast?.bestWindow ?? "Unknown"} at ${
    forecast?.bestWindowScore ?? "unknown"
  }/100
- Worst exposure window: ${forecast?.worstWindow ?? "Unknown"} at ${
    forecast?.worstWindowScore ?? "unknown"
  }/100
- Allergy/pollen peak window: ${
    forecast?.allergyPeakWindow ?? "Unknown"
  } at ${forecast?.allergyPeakScore ?? "unknown"} grains/m3, risk ${
    forecast?.pollenRisk ?? "Unknown"
  }
- Forecast trends:
${forecastTrends}

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
      priority: "Review today's local signals before outdoor activity.",
      actions: [],
      watch: [],
      uncertainty: "The response could not be structured automatically.",
    };
  }
}

function buildFallbackPlan(body: HealthPlanRequest): HealthPlan {
  const context = body.context;
  const forecast = body.forecast;
  const drivers = body.model?.topDrivers ?? [];
  const location =
    context?.city && context.state
      ? `${context.city}, ${context.state}`
      : context?.zipCode
      ? `ZIP ${context.zipCode}`
      : "this location";
  const topDriver = drivers[0];
  const bestWindow = forecast?.bestWindow;
  const worstWindow = forecast?.worstWindow;
  const riskText =
    context?.healthRisk && context.respiratoryRisk
      ? `${context.healthRisk.toLowerCase()} overall and ${context.respiratoryRisk.toLowerCase()} respiratory risk`
      : "limited local risk context";

  return {
    headline: `Today's local health brief for ${location}`,
    summary: `Current signals suggest ${riskText}. ${
      topDriver
        ? `${topDriver.label} is the strongest contributor in the transparent model.`
        : "No single model driver is dominating the snapshot."
    }`,
    priority: worstWindow
      ? `Pay closest attention around ${worstWindow}, when the forecast layer is highest.`
      : "Check the forecast and current air/heat signals before extended outdoor activity.",
    actions: [
      bestWindow
        ? `If your schedule is flexible, place outdoor activity near ${bestWindow}.`
        : "Use the lower-risk parts of the day for longer outdoor activity.",
      context?.airQuality
        ? `Use the air-quality reading (${context.airQuality}) as the first breathing-safety check.`
        : "Recheck air quality if conditions seem hazy, smoky, or irritating.",
      context?.heatRisk && context.heatRisk !== "Low"
        ? "Build in shade, hydration, and indoor breaks during hotter windows."
        : "Stay hydrated and adjust if heat, sun, or symptoms change.",
      "For serious or worsening symptoms, seek medical care rather than relying on this informational tool.",
    ],
    watch: [
      context?.dominantPollutant
        ? `Dominant pollutant: ${context.dominantPollutant}`
        : "Dominant pollutant data",
      context?.fluActivity
        ? `Flu activity: ${context.fluActivity}`
        : "Respiratory illness activity",
      context?.covidActivity
        ? `COVID wastewater: ${context.covidActivity}`
        : "COVID wastewater signal",
      forecast?.pollenRisk ? `Pollen risk: ${forecast.pollenRisk}` : "Pollen forecast",
    ],
    uncertainty:
      "Generated from available dashboard data when the AI plan service is unavailable; this is informational only and not medical advice.",
  };
}

export async function POST(request: Request) {
  const limiter = await rateLimit({
    key: getRateLimitKey(request, "api-health-plan"),
    limit: 8,
    windowMs: 60 * 1000,
  });

  if (!limiter.allowed) {
    return NextResponse.json(
      {
        plan: buildFallbackPlan({}),
        fallback: true,
        error: "Too many AI plan requests. Please try again shortly.",
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

  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      {
        plan: buildFallbackPlan({}),
        fallback: true,
        error: "Please send a valid JSON request body.",
      },
      { status: 400 }
    );
  }

  const parsedBody = healthPlanSchema.safeParse(rawBody);

  if (!parsedBody.success) {
    return NextResponse.json(
      {
        plan: buildFallbackPlan({}),
        fallback: true,
        error: validationErrorMessage(parsedBody.error),
      },
      { status: 400 }
    );
  }

  const body = parsedBody.data as HealthPlanRequest;

  if (!isFeatureEnabled("aiPlan")) {
    return NextResponse.json(
      {
        plan: {
          ...buildFallbackPlan(body),
          uncertainty:
            "AI plan generation is disabled by feature flag; this fallback uses deterministic dashboard context only.",
        },
        fallback: true,
        audit: {
          blocked: true,
          reasons: ["AI plan feature flag is disabled."],
          disclaimer: healthDisclaimer,
        },
      },
      { status: 503 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        plan: buildFallbackPlan(body),
        fallback: true,
      }
    );
  }

  const prompt = `
You are generating a concise, practical public-health planning brief for MyLocalHealth.

Use only the provided dashboard context plus general public-health knowledge. Do not diagnose, prescribe, or claim certainty. Do not invent missing data. If symptoms sound severe or urgent, recommend contacting emergency services or a medical professional.

Return only valid JSON with this exact shape:
{
  "headline": "short location-specific headline",
  "summary": "2 sentence plain-English explanation",
      "priority": "the single most important thing to pay attention to today, including timing if forecast data is available",
      "actions": ["3 to 5 practical, non-medical actions; include best/worst timing if forecast data is available"],
      "watch": ["2 to 4 signals or situations to monitor, including forecast peaks when relevant"],
  "uncertainty": "one sentence about data limits"
}

Dashboard context:
${formatPlanContext(body)}
`.trim();

  try {
    const response = await traceAsync(
      "api.health_plan.openai",
      () =>
        fetch(OPENAI_RESPONSES_API_URL, {
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
        }),
      {
        route: "/api/health-plan",
        zipCode: body.context?.zipCode,
        modelVersion: body.model?.version,
      }
    );

    const data = (await response.json()) as OpenAIResponse & {
      error?: { message?: string };
    };

    if (!response.ok) {
      return NextResponse.json(
        {
          plan: buildFallbackPlan(body),
          fallback: true,
          error:
            data.error?.message ?? "The AI health plan is temporarily unavailable.",
          audit: {
            fallback: true,
            disclaimer: healthDisclaimer,
          },
        }
      );
    }

    return NextResponse.json({
      plan: parsePlan(getResponseText(data)),
      audit: {
        fallback: false,
        usedContext: [
          "risk model",
          "forecast",
          "environment",
          "respiratory signals",
          "local news",
        ],
        disclaimer: healthDisclaimer,
      },
    });
  } catch {
    return NextResponse.json(
      {
        plan: buildFallbackPlan(body),
        fallback: true,
        error: "The AI health plan is temporarily unavailable.",
        audit: {
          fallback: true,
          disclaimer: healthDisclaimer,
        },
      }
    );
  }
}
