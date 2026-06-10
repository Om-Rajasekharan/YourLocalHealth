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

export async function getLocation(zipCode: string): Promise<LocationData> {
  const response = await fetch(
    `https://api.zippopotam.us/us/${zipCode}`
  );

  if (!response.ok) {
    throw new Error("Please enter a valid US ZIP code.");
  }

  const data = (await response.json()) as ZippopotamusResponse;
  const place = data.places?.[0];

  if (!place) {
    throw new Error("No location found for that ZIP code.");
  }

  return {
    city: place["place name"],
    state: place["state abbreviation"],
    latitude: place.latitude,
    longitude: place.longitude,
  };
}
