import { NextResponse } from "next/server";
import type {
  HealthEquityData,
  HealthEquityIndicator,
} from "../../../services/healthEquity";

const CENSUS_ACS_PROFILE_URL =
  "https://api.census.gov/data/2023/acs/acs5/profile";

type CensusProfileRow = [
  name: string,
  poverty: string,
  uninsured: string,
  noVehicle: string,
  zcta: string
];

type CensusProfileResponse = [
  string[],
  CensusProfileRow | undefined
];

function parsePercent(value: string) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function levelFromPercent(
  value: number | null,
  moderateThreshold: number,
  highThreshold: number
): HealthEquityIndicator["level"] {
  if (value === null) return "Unknown";
  if (value >= highThreshold) return "High";
  if (value >= moderateThreshold) return "Moderate";
  return "Low";
}

function pointsFromLevel(level: HealthEquityIndicator["level"]) {
  if (level === "High") return 100;
  if (level === "Moderate") return 55;
  if (level === "Low") return 20;
  return 0;
}

function equityLevelFromScore(score: number) {
  if (score >= 67) return "High";
  if (score >= 34) return "Moderate";
  return "Low";
}

function buildHealthEquityData(row: CensusProfileRow): HealthEquityData {
  const [name, povertyRaw, uninsuredRaw, noVehicleRaw, zcta] = row;
  const poverty = parsePercent(povertyRaw);
  const uninsured = parsePercent(uninsuredRaw);
  const noVehicle = parsePercent(noVehicleRaw);
  const indicators: HealthEquityIndicator[] = [
    {
      label: "Poverty",
      value: poverty,
      unit: "%",
      level: levelFromPercent(poverty, 10, 20),
      source: "Census ACS 5-year profile DP03_0128PE",
      detail:
        "Percent of people whose income in the past 12 months is below the poverty level.",
    },
    {
      label: "Uninsured",
      value: uninsured,
      unit: "%",
      level: levelFromPercent(uninsured, 6, 12),
      source: "Census ACS 5-year profile DP03_0099PE",
      detail:
        "Percent of civilian noninstitutionalized residents with no health insurance coverage.",
    },
    {
      label: "No vehicle access",
      value: noVehicle,
      unit: "%",
      level: levelFromPercent(noVehicle, 6, 12),
      source: "Census ACS 5-year profile DP04_0058PE",
      detail:
        "Percent of occupied housing units with no vehicles available.",
    },
  ];
  const knownIndicators = indicators.filter(
    (indicator) => indicator.level !== "Unknown"
  );
  const equityScore =
    knownIndicators.length > 0
      ? Math.round(
          knownIndicators.reduce(
            (total, indicator) =>
              total + pointsFromLevel(indicator.level),
            0
          ) / knownIndicators.length
        )
      : 0;
  const equityLevel =
    knownIndicators.length > 0
      ? equityLevelFromScore(equityScore)
      : "Unknown";
  const elevatedIndicators = indicators.filter(
    (indicator) =>
      indicator.level === "Moderate" || indicator.level === "High"
  );

  return {
    zctaName: name,
    zcta,
    equityScore,
    equityLevel,
    indicators,
    summary:
      elevatedIndicators.length > 0
        ? `Structural vulnerability may be elevated because of ${elevatedIndicators
            .map((indicator) => indicator.label.toLowerCase())
            .join(", ")}.`
        : "The currently loaded ACS indicators do not show elevated structural vulnerability.",
    caveats: [
      "ACS ZIP-level values are estimates for ZIP Code Tabulation Areas, not exact neighborhood boundaries.",
      "EPA EJScreen, CDC asthma prevalence, tree canopy, clinic access, and hospital access are planned next-layer indicators.",
    ],
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const zipCode = searchParams.get("zipCode")?.trim();
  const apiKey = process.env.CENSUS_API_KEY;

  if (!zipCode) {
    return NextResponse.json(
      { error: "A ZIP code is required." },
      { status: 400 }
    );
  }

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Health equity data needs a Census API key. Add CENSUS_API_KEY to .env.local, then restart the dev server.",
      },
      { status: 503 }
    );
  }

  const params = new URLSearchParams({
    get: "NAME,DP03_0128PE,DP03_0099PE,DP04_0058PE",
    for: `zip code tabulation area:${zipCode}`,
    key: apiKey,
  });

  try {
    const response = await fetch(
      `${CENSUS_ACS_PROFILE_URL}?${params.toString()}`
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Unable to retrieve Census health equity data." },
        { status: response.status }
      );
    }

    const data = (await response.json()) as CensusProfileResponse;
    const row = data[1];

    if (!row) {
      return NextResponse.json(
        {
          error:
            "No Census ACS health equity data was found for this ZIP/ZCTA.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ equityData: buildHealthEquityData(row) });
  } catch {
    return NextResponse.json(
      { error: "Health equity data is temporarily unavailable." },
      { status: 503 }
    );
  }
}
