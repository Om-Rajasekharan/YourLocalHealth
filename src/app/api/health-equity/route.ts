import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import type {
  HealthEquityData,
  HealthEquityIndicator,
} from "../../../services/healthEquity";

const CENSUS_ACS_PROFILE_URL =
  "https://api.census.gov/data/2023/acs/acs5/profile";
const CENSUS_GEOCODER_URL =
  "https://geocoding.geo.census.gov/geocoder/geographies/coordinates";
const CDC_PLACES_ARCGIS_URL =
  "https://services1.arcgis.com/qTQ6qYkHpxlu0G82/arcgis/rest/services/CDC_Places_2025/FeatureServer/6/query";

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

type CensusGeocoderResponse = {
  result?: {
    geographies?: {
      "Census Tracts"?: {
        GEOID?: string;
      }[];
    };
  };
};

type CdcPlacesAttributes = {
  countyname?: string | null;
  tractfips?: string | null;
  totalpopulation_NUM?: number | null;
  casthma_crudeprev_NUM?: number | null;
  copd_crudeprev_NUM?: number | null;
  csmoking_crudeprev_NUM?: number | null;
  obesity_crudeprev_NUM?: number | null;
  diabetes_crudeprev_NUM?: number | null;
  ghlth_crudeprev_NUM?: number | null;
  phlth_crudeprev_NUM?: number | null;
  access2_crudeprev_NUM?: number | null;
  lpa_crudeprev_NUM?: number | null;
  foodinsecu_crudeprev_NUM?: number | null;
  housinsecu_crudeprev_NUM?: number | null;
  lacktrpt_crudeprev_NUM?: number | null;
};

type CdcPlacesResponse = {
  features?: {
    attributes?: CdcPlacesAttributes;
  }[];
};

type SpatialTractEntry = {
  smoothed_prevalence: number;
  smoothed_ci_lower: number;
  smoothed_ci_upper: number;
};

let spatialLookupCache: Record<string, SpatialTractEntry> | null = null;

// Precomputed by ml/spatial_model.py (BYM2 spatial model over CDC PLACES
// diabetes prevalence, pilot region only) -- read once and cached, since
// the underlying file only changes when the model is re-fit offline.
function getSpatialLookup(): Record<string, SpatialTractEntry> {
  if (spatialLookupCache) return spatialLookupCache;

  try {
    const lookupPath = path.join(
      process.cwd(),
      "ml/models/spatial/tract_lookup.json"
    );
    spatialLookupCache = JSON.parse(fs.readFileSync(lookupPath, "utf-8"));
  } catch {
    spatialLookupCache = {};
  }

  return spatialLookupCache ?? {};
}

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

function numberOrNull(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function buildIndicator(
  label: string,
  value: number | null,
  moderateThreshold: number,
  highThreshold: number,
  source: string,
  detail: string
): HealthEquityIndicator {
  return {
    label,
    value,
    unit: "%",
    level: levelFromPercent(value, moderateThreshold, highThreshold),
    source,
    detail,
  };
}

function averageKnownScores(indicators: HealthEquityIndicator[]) {
  const knownIndicators = indicators.filter(
    (indicator) => indicator.level !== "Unknown"
  );

  if (knownIndicators.length === 0) return null;

  return Math.round(
    knownIndicators.reduce(
      (total, indicator) => total + pointsFromLevel(indicator.level),
      0
    ) / knownIndicators.length
  );
}

function buildPlacesIndicators(
  places: CdcPlacesAttributes | null
): HealthEquityIndicator[] {
  if (!places) return [];

  const source = "CDC PLACES 2025 census tract estimates";

  return [
    buildIndicator(
      "Asthma prevalence",
      numberOrNull(places.casthma_crudeprev_NUM),
      10,
      14,
      source,
      "Estimated percent of adults with current asthma in this census tract."
    ),
    buildIndicator(
      "COPD prevalence",
      numberOrNull(places.copd_crudeprev_NUM),
      6,
      9,
      source,
      "Estimated percent of adults with chronic obstructive pulmonary disease."
    ),
    buildIndicator(
      "Current smoking",
      numberOrNull(places.csmoking_crudeprev_NUM),
      14,
      20,
      source,
      "Estimated percent of adults who currently smoke."
    ),
    buildIndicator(
      "Diabetes prevalence",
      numberOrNull(places.diabetes_crudeprev_NUM),
      10,
      15,
      source,
      "Estimated percent of adults with diagnosed diabetes."
    ),
    buildIndicator(
      "Obesity prevalence",
      numberOrNull(places.obesity_crudeprev_NUM),
      35,
      45,
      source,
      "Estimated percent of adults with obesity."
    ),
    buildIndicator(
      "Poor physical health",
      numberOrNull(places.phlth_crudeprev_NUM),
      12,
      18,
      source,
      "Estimated percent of adults reporting frequent physical health distress."
    ),
    buildIndicator(
      "No leisure activity",
      numberOrNull(places.lpa_crudeprev_NUM),
      25,
      35,
      source,
      "Estimated percent of adults reporting no leisure-time physical activity."
    ),
    buildIndicator(
      "Food insecurity",
      numberOrNull(places.foodinsecu_crudeprev_NUM),
      10,
      18,
      source,
      "Estimated percent of adults reporting food insecurity."
    ),
    buildIndicator(
      "Housing insecurity",
      numberOrNull(places.housinsecu_crudeprev_NUM),
      10,
      18,
      source,
      "Estimated percent of adults reporting housing insecurity."
    ),
    buildIndicator(
      "Transportation barriers",
      numberOrNull(places.lacktrpt_crudeprev_NUM),
      6,
      12,
      source,
      "Estimated percent of adults reporting lack of reliable transportation."
    ),
  ];
}

function buildHealthEquityData(
  row: CensusProfileRow,
  places: CdcPlacesAttributes | null
): HealthEquityData {
  const [name, povertyRaw, uninsuredRaw, noVehicleRaw, zcta] = row;
  const poverty = parsePercent(povertyRaw);
  const uninsured = parsePercent(uninsuredRaw);
  const noVehicle = parsePercent(noVehicleRaw);
  const censusIndicators: HealthEquityIndicator[] = [
    buildIndicator(
      "Poverty",
      poverty,
      10,
      20,
      "Census ACS 5-year profile DP03_0128PE",
      "Percent of people whose income in the past 12 months is below the poverty level."
    ),
    buildIndicator(
      "Uninsured",
      uninsured,
      6,
      12,
      "Census ACS 5-year profile DP03_0099PE",
      "Percent of civilian noninstitutionalized residents with no health insurance coverage."
    ),
    buildIndicator(
      "No vehicle access",
      noVehicle,
      6,
      12,
      "Census ACS 5-year profile DP04_0058PE",
      "Percent of occupied housing units with no vehicles available."
    ),
  ];
  const placesIndicators = buildPlacesIndicators(places);
  const chronicIndicators = placesIndicators.filter((indicator) =>
    [
      "Asthma prevalence",
      "COPD prevalence",
      "Current smoking",
      "Diabetes prevalence",
      "Obesity prevalence",
      "Poor physical health",
      "No leisure activity",
    ].includes(indicator.label)
  );
  const indicators = [...censusIndicators, ...placesIndicators];
  const knownIndicators = indicators.filter(
    (indicator) => indicator.level !== "Unknown"
  );
  const equityScore =
    averageKnownScores(indicators) ?? 0;
  const equityLevel =
    knownIndicators.length > 0
      ? equityLevelFromScore(equityScore)
      : "Unknown";
  const elevatedIndicators = indicators.filter(
    (indicator) =>
      indicator.level === "Moderate" || indicator.level === "High"
  );

  const spatialEntry = places?.tractfips
    ? getSpatialLookup()[places.tractfips]
    : undefined;

  return {
    zctaName: name,
    zcta,
    tractFips: places?.tractfips ?? null,
    equityScore,
    equityLevel,
    indicators,
    cdcPlaces: places
      ? {
          chronicBurdenScore: averageKnownScores(chronicIndicators),
          asthma: numberOrNull(places.casthma_crudeprev_NUM),
          copd: numberOrNull(places.copd_crudeprev_NUM),
          smoking: numberOrNull(places.csmoking_crudeprev_NUM),
          obesity: numberOrNull(places.obesity_crudeprev_NUM),
          diabetes: numberOrNull(places.diabetes_crudeprev_NUM),
          ...(spatialEntry
            ? {
                isPilotRegion: true,
                spatiallySmoothedDiabetes: spatialEntry.smoothed_prevalence,
                spatiallySmoothedDiabetesCiLower: spatialEntry.smoothed_ci_lower,
                spatiallySmoothedDiabetesCiUpper: spatialEntry.smoothed_ci_upper,
              }
            : {}),
        }
      : null,
    summary:
      elevatedIndicators.length > 0
        ? `Structural vulnerability may be elevated because of ${elevatedIndicators
            .map((indicator) => indicator.label.toLowerCase())
            .join(", ")}.`
        : "The currently loaded ACS indicators do not show elevated structural vulnerability.",
    caveats: [
      "ACS ZIP-level values are estimates for ZIP Code Tabulation Areas, not exact neighborhood boundaries.",
      "CDC PLACES values are modeled census tract estimates and should be interpreted as community context, not diagnosis.",
      "EPA EJScreen, tree canopy, clinic access, and hospital access are planned next-layer indicators.",
    ],
  };
}

async function getCensusTractFips(latitude: string, longitude: string) {
  const params = new URLSearchParams({
    x: longitude,
    y: latitude,
    benchmark: "Public_AR_Current",
    vintage: "Current_Current",
    format: "json",
  });
  const response = await fetch(`${CENSUS_GEOCODER_URL}?${params.toString()}`);

  if (!response.ok) return null;

  const data = (await response.json()) as CensusGeocoderResponse;

  return data.result?.geographies?.["Census Tracts"]?.[0]?.GEOID ?? null;
}

async function getCdcPlacesData(tractFips: string) {
  const params = new URLSearchParams({
    where: `tractfips='${tractFips}'`,
    outFields:
      "countyname,tractfips,totalpopulation_NUM,casthma_crudeprev_NUM,copd_crudeprev_NUM,csmoking_crudeprev_NUM,obesity_crudeprev_NUM,diabetes_crudeprev_NUM,ghlth_crudeprev_NUM,phlth_crudeprev_NUM,access2_crudeprev_NUM,lpa_crudeprev_NUM,foodinsecu_crudeprev_NUM,housinsecu_crudeprev_NUM,lacktrpt_crudeprev_NUM",
    returnGeometry: "false",
    f: "json",
  });
  const response = await fetch(`${CDC_PLACES_ARCGIS_URL}?${params.toString()}`);

  if (!response.ok) return null;

  const data = (await response.json()) as CdcPlacesResponse;

  return data.features?.[0]?.attributes ?? null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const zipCode = searchParams.get("zipCode")?.trim();
  const latitude = searchParams.get("latitude")?.trim();
  const longitude = searchParams.get("longitude")?.trim();
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

    let placesData: CdcPlacesAttributes | null = null;

    if (latitude && longitude) {
      const tractFips = await getCensusTractFips(latitude, longitude);
      placesData = tractFips ? await getCdcPlacesData(tractFips) : null;
    }

    return NextResponse.json({
      equityData: buildHealthEquityData(row, placesData),
    });
  } catch {
    return NextResponse.json(
      { error: "Health equity data is temporarily unavailable." },
      { status: 503 }
    );
  }
}
