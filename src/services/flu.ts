import { stateMap } from "../lib/states";

type FluRecord = {
  geography?: string;
  label?: string;
};

export async function getFluData(
  stateAbbreviation: string
): Promise<string> {
  const response = await fetch(
    "https://data.cdc.gov/api/v3/views/f3zz-zga5/query.json"
  );

  if (!response.ok) {
    throw new Error("Unable to retrieve CDC respiratory illness data.");
  }

  const data = (await response.json()) as FluRecord[];

  const stateName =
    stateMap[stateAbbreviation];

  if (!stateName) {
    return "Unknown";
  }

  const record = data.find(
    (item) =>
      item.geography === stateName
  );

  return record?.label ?? "Unknown";
}
