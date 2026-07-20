export type LocationData = {
  city: string;
  state: string;
  latitude: string;
  longitude: string;
};

type ZippopotamusPlace = {
  "place name": string;
  "state abbreviation": string;
  latitude: string;
  longitude: string;
};

type ZippopotamusResponse = {
  places?: ZippopotamusPlace[];
};

// zippopotam.us only serves the 50 states + DC under the "us" country
// code -- ZIPs in US territories (Puerto Rico, Virgin Islands, Guam,
// American Samoa, Northern Mariana Islands) 404 there and need their own
// country code instead. Tried in order after "us" fails, since a plain
// 5-digit ZIP doesn't itself indicate which of these it belongs to.
//
// For these territory codes, zippopotam.us's own "state abbreviation"
// field is a numeric FIPS state code (e.g. "72" for Puerto Rico), not a
// postal abbreviation like the "us" endpoint returns (e.g. "CA") -- every
// state-keyed feature downstream (CDC FluView, Census ACS, etc.) expects
// postal codes, so the territory's own postal abbreviation is substituted
// in directly rather than trusting that field for these lookups.
const TERRITORY_POSTAL_ABBREVIATIONS: Record<string, string> = {
  pr: "PR",
  vi: "VI",
  gu: "GU",
  as: "AS",
  mp: "MP",
};

async function fetchZippopotamPlace(
  countryCode: string,
  zipCode: string
): Promise<ZippopotamusPlace | null> {
  const response = await fetch(
    `https://api.zippopotam.us/${countryCode}/${zipCode}`
  );

  if (!response.ok) return null;

  const data = (await response.json()) as ZippopotamusResponse;
  return data.places?.[0] ?? null;
}

export async function getLocation(zipCode: string): Promise<LocationData> {
  const place = await fetchZippopotamPlace("us", zipCode);

  if (place) {
    return {
      city: place["place name"],
      state: place["state abbreviation"],
      latitude: place.latitude,
      longitude: place.longitude,
    };
  }

  for (const [countryCode, postalAbbreviation] of Object.entries(
    TERRITORY_POSTAL_ABBREVIATIONS
  )) {
    const territoryPlace = await fetchZippopotamPlace(countryCode, zipCode);
    if (territoryPlace) {
      return {
        city: territoryPlace["place name"],
        state: postalAbbreviation,
        latitude: territoryPlace.latitude,
        longitude: territoryPlace.longitude,
      };
    }
  }

  throw new Error("Please enter a valid US ZIP code.");
}
