import type { CensusRegion } from "../lib/regions";

const WASTEWATER_TRENDS_URL =
  "https://www.cdc.gov/wcms/vizdata/NCEZID_DIDRI/NWSS_WVAL_metric/NWSSWVALRegionalActivityLevel.json";

export type WastewaterPathogen = "SARS-CoV-2" | "Influenza A virus";

type WastewaterTrendRecord = {
  Week_End: string;
  National_WVAL_Category: string;
  Midwest_WVAL_Category: string;
  Northeast_WVAL_Category: string;
  South_WVAL_Category: string;
  West_WVAL_Category: string;
  National_WVAL: string;
  Midwest_WVAL: string;
  Northeast_WVAL: string;
  South_WVAL: string;
  West_WVAL: string;
  Time_Period: string;
  Date_Updated: string;
  Pathogen_Target: string;
};

export type WastewaterTrendPoint = {
  weekEnd: string;
  timePeriod: string;
  nationalValue: number;
  regionalValue: number;
  nationalCategory: string;
  regionalCategory: string;
};

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export async function getWastewaterTrends(
  pathogen: WastewaterPathogen,
  region: CensusRegion
): Promise<WastewaterTrendPoint[]> {
  const response = await fetch(WASTEWATER_TRENDS_URL);

  if (!response.ok) {
    throw new Error("Unable to retrieve CDC wastewater trend data.");
  }

  const data = (await response.json()) as WastewaterTrendRecord[];
  const regionValueKey = `${region}_WVAL` as keyof WastewaterTrendRecord;
  const regionCategoryKey =
    `${region}_WVAL_Category` as keyof WastewaterTrendRecord;

  return data
    .filter((record) => record.Pathogen_Target === pathogen)
    .map((record) => ({
      weekEnd: record.Week_End,
      timePeriod: record.Time_Period,
      nationalValue: toNumber(record.National_WVAL),
      regionalValue: toNumber(record[regionValueKey]),
      nationalCategory: record.National_WVAL_Category,
      regionalCategory: record[regionCategoryKey],
    }))
    .sort(
      (a, b) =>
        new Date(a.weekEnd).getTime() - new Date(b.weekEnd).getTime()
    );
}
