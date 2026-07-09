import { stateMap } from "../lib/states";
import { cachedJson } from "../lib/apiCache";

const COVID_WASTEWATER_URL =
  "https://www.cdc.gov/wcms/vizdata/NCEZID_DIDRI/NWSS_WVAL_metric/NWSSWVALStateMap.json";

type CovidWastewaterRecord = {
  "State/Territory": string;
  "State/Territory_WVAL_Category": string;
  "State/Territory_WVAL": string;
  Number_of_Sites: string;
  Time_Period: string;
  Coverage: string;
  Date_Updated: string;
  Week_End: string;
  Pathogen_Target: string;
};

export type CovidActivityData = {
  activity: string;
  value: number | null;
  numberOfSites: number;
  coverage: string;
  timePeriod: string;
  updatedAt: string;
  weekEnd: string;
};

export async function getCovidData(
  stateAbbreviation: string
): Promise<CovidActivityData> {
  const stateName = stateMap[stateAbbreviation];

  if (!stateName) {
    throw new Error("Unable to match that ZIP code to a state.");
  }

  let data: CovidWastewaterRecord[];

  try {
    data = await cachedJson<CovidWastewaterRecord[]>(COVID_WASTEWATER_URL, {
      cacheKey: "cdc-covid-wastewater-state-map",
      ttlMs: 60 * 60 * 1000,
    });
  } catch {
    throw new Error("Unable to retrieve CDC COVID wastewater data.");
  }

  const record = data.find(
    (item) =>
      item["State/Territory"] === stateName &&
      item.Pathogen_Target === "SARS-CoV-2"
  );

  if (!record) {
    return {
      activity: "Unknown",
      value: null,
      numberOfSites: 0,
      coverage: "Unknown",
      timePeriod: "Unknown",
      updatedAt: "Unknown",
      weekEnd: "Unknown",
    };
  }

  const value = Number(record["State/Territory_WVAL"]);

  return {
    activity: record["State/Territory_WVAL_Category"],
    value: Number.isNaN(value) ? null : value,
    numberOfSites: Number(record.Number_of_Sites),
    coverage: record.Coverage.trim() || "Standard Coverage",
    timePeriod: record.Time_Period,
    updatedAt: record.Date_Updated,
    weekEnd: record.Week_End,
  };
}
