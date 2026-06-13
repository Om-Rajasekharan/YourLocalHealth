import { NextResponse } from "next/server";

const CENSUS_GEOCODER_URL =
  "https://geocoding.geo.census.gov/geocoder/geographies/coordinates";

type ReverseGeocoderResponse = {
  result?: {
    geographies?: Record<string, unknown[]>;
  };
};

type CensusGeographies = NonNullable<
  NonNullable<ReverseGeocoderResponse["result"]>["geographies"]
>;

function findZipCodeInRecord(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  const directValue =
    record.ZCTA5 ??
    record.ZCTA5CE20 ??
    record.ZCTA5CE10 ??
    record.ZIP ??
    record.ZIP_CODE ??
    record.zip ??
    record.zipCode ??
    record.GEOID;

  if (
    typeof directValue === "string" &&
    /^\d{5}$/.test(directValue)
  ) {
    return directValue;
  }

  for (const [key, nestedValue] of Object.entries(record)) {
    if (!/zip|zcta/i.test(key)) continue;

    if (
      typeof nestedValue === "string" &&
      /^\d{5}$/.test(nestedValue)
    ) {
      return nestedValue;
    }

    const match = findZipCodeInRecord(nestedValue);
    if (match) return match;
  }

  return null;
}

function findZipCode(geographies?: CensusGeographies): string | null {
  if (!geographies) return null;

  for (const [layerName, records] of Object.entries(geographies)) {
    if (!/zip|zcta/i.test(layerName)) continue;

    for (const record of records) {
      const match = findZipCodeInRecord(record);
      if (match) return match;
    }
  }

  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latitude = searchParams.get("latitude")?.trim();
  const longitude = searchParams.get("longitude")?.trim();

  if (!latitude || !longitude) {
    return NextResponse.json(
      { error: "Latitude and longitude are required." },
      { status: 400 }
    );
  }

  const latitudeValue = Number(latitude);
  const longitudeValue = Number(longitude);

  if (
    Number.isNaN(latitudeValue) ||
    Number.isNaN(longitudeValue) ||
    latitudeValue < -90 ||
    latitudeValue > 90 ||
    longitudeValue < -180 ||
    longitudeValue > 180
  ) {
    return NextResponse.json(
      { error: "The selected map point is not a valid location." },
      { status: 400 }
    );
  }

  const params = new URLSearchParams({
    x: longitudeValue.toString(),
    y: latitudeValue.toString(),
    benchmark: "Public_AR_Current",
    vintage: "Current_Current",
    layers: "all",
    format: "json",
  });

  try {
    const response = await fetch(`${CENSUS_GEOCODER_URL}?${params.toString()}`);

    if (!response.ok) {
      return NextResponse.json(
        { error: "Unable to match that map point to a ZIP code." },
        { status: response.status }
      );
    }

    const data = (await response.json()) as ReverseGeocoderResponse;
    const zipCode = findZipCode(data.result?.geographies);

    if (!zipCode) {
      return NextResponse.json(
        { error: "No ZIP/ZCTA was found for that map point." },
        { status: 404 }
      );
    }

    return NextResponse.json({ zipCode });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Unable to reverse-geocode that map point." },
      { status: 500 }
    );
  }
}
