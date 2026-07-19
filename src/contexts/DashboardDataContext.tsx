"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  getAirQualityLabel,
  getDominantPollutant,
  getPollutantRiskLabel,
} from "../lib/airQuality";
import {
  evaluateRiskModel,
  type DataStatus,
  type RiskModelConfidence,
} from "../lib/riskModel";
import {
  estimateSymptomPrediction,
  type SymptomPrediction,
} from "../lib/symptomPrediction";
import { getLocation } from "../services/location";
import { getAirQuality, type AirQualityData } from "../services/airsQuality";
import { getFluData } from "../services/flu";
import { getCovidData, type CovidActivityData } from "../services/covid";
import { getLocalHealthNews, type LocalHealthNewsArticle } from "../services/localNews";
import {
  getEnvironmentData,
  getHeatRiskLabel,
  getUvRiskLabel,
  type EnvironmentData,
} from "../services/environment";
import {
  getWeatherAlerts,
  summarizeAlertRisk,
  type WeatherAlert,
} from "../services/weatherAlerts";
import { getUserProfile, type UserProfile } from "../services/userProfile";
import { getHealthEquityData, type HealthEquityData } from "../services/healthEquity";
import { getHealthForecast, type HealthForecastData } from "../services/healthForecast";
import {
  buildFeatureSnapshot,
  featureSnapshotSummary,
  type FeatureSnapshot,
} from "../services/featureSnapshot";
import {
  emptyCheckinStreak,
  getSymptomCheckinStreak,
  saveHealthSnapshot,
  type CheckinStreak,
  type SavedHealthSnapshot,
} from "../services/mlTrainingData";
import {
  emptySymptomEnvironmentCorrelation,
  getSymptomEnvironmentCorrelation,
  type SymptomEnvironmentCorrelation,
} from "../services/symptomEnvironmentCorrelation";
import {
  computeUserFactorSlope,
  type PersonalRiskCalibration,
} from "../services/personalRiskCalibration";
import { supabase } from "../lib/supabaseClient";

const unknownCovidData: CovidActivityData = {
  activity: "Unknown",
  value: null,
  numberOfSites: 0,
  coverage: "Unknown",
  timePeriod: "Unknown",
  updatedAt: "Unknown",
  weekEnd: "Unknown",
};

export function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function exposureLabel(score: number) {
  if (score >= 67) return "High";
  if (score >= 34) return "Moderate";
  return "Low";
}

export function profileModifier(profile: UserProfile | null) {
  if (!profile) return 0;

  const exposure =
    profile.outdoor_exposure === "High"
      ? 8
      : profile.outdoor_exposure === "Moderate"
      ? 4
      : 0;
  const commute =
    profile.commute_exposure === "High"
      ? 6
      : profile.commute_exposure === "Moderate"
      ? 3
      : 0;
  const sensitivity =
    profile.respiratory_sensitivity === "High"
      ? 10
      : profile.respiratory_sensitivity === "Mild"
      ? 5
      : 0;
  const activity =
    profile.activity_level === "High"
      ? 4
      : profile.activity_level === "Moderate"
      ? 2
      : 0;

  return exposure + commute + sensitivity + activity;
}

type DashboardDataContextValue = {
  // identity/search
  zipCode: string;
  city: string;
  state: string;
  latitude: string;
  longitude: string;
  searched: boolean;
  loading: boolean;
  error: string;

  // auth/profile
  user: User | null;
  userProfile: UserProfile | null;
  checkinStreak: CheckinStreak;
  symptomEnvironmentCorrelation: SymptomEnvironmentCorrelation;
  personalRiskCalibration: PersonalRiskCalibration | null;

  // raw signal state
  aqi: number | null;
  fluActivity: string;
  covidData: CovidActivityData | null;
  environmentData: EnvironmentData | null;
  weatherAlerts: WeatherAlert[];
  airComponents: Record<string, number> | undefined;
  localNews: LocalHealthNewsArticle[];
  healthEquityData: HealthEquityData | null;
  healthForecastData: HealthForecastData | null;
  dataStatus: DataStatus;
  newsLoading: boolean;
  newsError: string;
  equityError: string;
  forecastError: string;
  latestSnapshot: SavedHealthSnapshot | null;
  snapshotStatus: string;
  featureSnapshot: FeatureSnapshot | null;
  featureSnapshotStatus: string;

  // derived
  covidActivity: string;
  heatRisk: string;
  uvRisk: string;
  alertRisk: string;
  pollutantRisk: string;
  dominantPollutant: string;
  airQualityLabel: string;
  healthRisk: string;
  respiratoryRisk: string;
  baseHealthRisk: string;
  baseRespiratoryRisk: string;
  personalizationSummary: string;
  personalizedRiskReasons: string[];
  isPersonalized: boolean;
  modelVersion: string;
  methodology: string[];
  scoreBreakdown: ReturnType<typeof evaluateRiskModel>["scoreBreakdown"];
  dataConfidence: RiskModelConfidence;
  symptomPrediction: SymptomPrediction;
  mainTwinScore: number;
  mainTwinLevel: string;

  // actions
  searchZipCode: (
    zipToSearch: string,
    options?: { updateUrl?: boolean }
  ) => Promise<void>;
  resetSearch: () => void;
  setZipCode: (zip: string) => void;
  refreshCheckinStreak: (userId: string) => Promise<void>;
};

const DashboardDataContext = createContext<DashboardDataContextValue | null>(
  null
);

export function useDashboardData() {
  const value = useContext(DashboardDataContext);

  if (!value) {
    throw new Error(
      "useDashboardData must be used within a DashboardDataProvider"
    );
  }

  return value;
}

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const loadedZipRef = useRef("");
  const hasRedirectedForMissingProfileRef = useRef(false);
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [zipCode, setZipCode] = useState("");
  const [searched, setSearched] = useState(false);

  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [aqi, setAqi] = useState<number | null>(null);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState("");
  const [equityError, setEquityError] = useState("");
  const [forecastError, setForecastError] = useState("");
  const [fluActivity, setFluActivity] = useState("Unknown");
  const [covidData, setCovidData] = useState<CovidActivityData | null>(null);
  const [environmentData, setEnvironmentData] =
    useState<EnvironmentData | null>(null);
  const [weatherAlerts, setWeatherAlerts] = useState<WeatherAlert[]>([]);
  const [airComponents, setAirComponents] =
    useState<Record<string, number>>();
  const [localNews, setLocalNews] = useState<LocalHealthNewsArticle[]>([]);
  const [healthEquityData, setHealthEquityData] =
    useState<HealthEquityData | null>(null);
  const [healthForecastData, setHealthForecastData] =
    useState<HealthForecastData | null>(null);
  const [latestSnapshot, setLatestSnapshot] =
    useState<SavedHealthSnapshot | null>(null);
  const [snapshotStatus, setSnapshotStatus] = useState("");
  const [checkinStreak, setCheckinStreak] = useState<CheckinStreak>(
    emptyCheckinStreak
  );
  const [symptomEnvironmentCorrelation, setSymptomEnvironmentCorrelation] =
    useState<SymptomEnvironmentCorrelation>(emptySymptomEnvironmentCorrelation);
  const [personalRiskCalibration, setPersonalRiskCalibration] =
    useState<PersonalRiskCalibration | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [dataStatus, setDataStatus] = useState<DataStatus>({
    airQuality: false,
    pollutants: false,
    heatUv: false,
    weatherAlerts: false,
    flu: false,
    covid: false,
    news: false,
  });

  const covidActivity = covidData?.activity ?? "Unknown";
  const heatRisk = getHeatRiskLabel(
    environmentData?.apparentTemperatureMax ??
      environmentData?.apparentTemperature ??
      null
  );
  const uvRisk = getUvRiskLabel(environmentData?.uvIndexMax ?? null);
  const alertRisk = summarizeAlertRisk(weatherAlerts);
  const pollutantRisk = getPollutantRiskLabel(airComponents);
  const dominantPollutant = getDominantPollutant(airComponents);
  const airQualityLabel = getAirQualityLabel(aqi);
  const riskModel = evaluateRiskModel({
    aqi,
    airQualityLabel,
    pollutantRisk,
    heatRisk,
    uvRisk,
    alertRisk,
    fluActivity,
    covidActivity,
    covidCoverage: covidData?.coverage ?? "Unknown",
    dataStatus,
    profile: userProfile,
  });
  const healthRisk = riskModel.healthRisk;
  const respiratoryRisk = riskModel.respiratoryRisk;
  const personalizationSummary = riskModel.personalizationSummary;
  const scoreBreakdown = riskModel.scoreBreakdown;
  const dataConfidence = riskModel.dataConfidence;
  const symptomPrediction = estimateSymptomPrediction({
    aqi,
    heatRisk,
    uvRisk,
    pollutantRisk,
    fluActivity,
    covidActivity,
    scoreBreakdown,
    forecastData: healthForecastData,
    environmentData,
    equityData: healthEquityData,
    profile: userProfile,
    dataConfidence,
  });
  const mainTwinScore = clampScore(
    scoreBreakdown.score * 0.68 +
      (healthForecastData?.peakScore ?? scoreBreakdown.score) * 0.22 +
      profileModifier(userProfile)
  );
  const mainTwinLevel = exposureLabel(mainTwinScore);
  const featureSnapshot = searched
    ? buildFeatureSnapshot({
        zipCode,
        city,
        state,
        latitude,
        longitude,
        aqi,
        airComponents,
        heatRisk,
        uvRisk,
        alertRisk,
        fluActivity,
        covidData,
        forecastData: healthForecastData,
        equityData: healthEquityData,
        profileModifier: profileModifier(userProfile),
        dataStatus,
      })
    : null;
  const featureSnapshotStatus = featureSnapshot
    ? featureSnapshotSummary(featureSnapshot)
    : "Search a ZIP code to generate an ML-ready feature snapshot.";

  const searchZipCode = async (
    zipToSearch: string,
    options: { updateUrl?: boolean } = {}
  ) => {
    void options;
    setZipCode(zipToSearch);
    setError("");
    setNewsError("");
    setEquityError("");
    setForecastError("");
    setLocalNews([]);
    setHealthEquityData(null);
    setHealthForecastData(null);
    setLatestSnapshot(null);
    setSnapshotStatus("");
    setEnvironmentData(null);
    setWeatherAlerts([]);
    setAirComponents(undefined);
    setDataStatus({
      airQuality: false,
      pollutants: false,
      heatUv: false,
      weatherAlerts: false,
      flu: false,
      covid: false,
      news: false,
    });
    setSearched(false);
    setLoading(true);

    try {
      const location = await getLocation(zipToSearch);

      setCity(location.city);
      setState(location.state);
      setLatitude(location.latitude);
      setLongitude(location.longitude);
      setSearched(true);
      setLoading(false);
      loadedZipRef.current = zipToSearch;

      const currentUser = user;
      const currentProfile = userProfile;

      void (async () => {
        setNewsLoading(true);

        const fluPromise = getFluData(location.state)
          .then((fluData) => {
            setFluActivity(fluData);
            setDataStatus((current) => ({
              ...current,
              flu: fluData !== "Unknown",
            }));
            return fluData;
          })
          .catch((fetchError) => {
            console.error("Flu data unavailable", fetchError);
            return "Unknown";
          });

        const covidPromise = getCovidData(location.state)
          .then((covidActivityData) => {
            setCovidData(covidActivityData);
            setDataStatus((current) => ({
              ...current,
              covid: covidActivityData.activity !== "Unknown",
            }));
            return covidActivityData;
          })
          .catch((fetchError) => {
            console.error("COVID wastewater data unavailable", fetchError);
            setCovidData(unknownCovidData);
            return unknownCovidData;
          });

        const coreDataPromise = Promise.all([
          getAirQuality(location.latitude, location.longitude).catch(
            (fetchError) => {
              console.error("Air quality data unavailable", fetchError);
              return {} as AirQualityData;
            }
          ),
          getEnvironmentData(location.latitude, location.longitude).catch(
            (fetchError) => {
              console.error("Heat and UV data unavailable", fetchError);
              return {
                temperature: null,
                apparentTemperature: null,
                humidity: null,
                uvIndexMax: null,
                temperatureMax: null,
                apparentTemperatureMax: null,
              };
            }
          ),
          getWeatherAlerts(location.latitude, location.longitude).catch(
            (fetchError) => {
              console.error("Weather alerts unavailable", fetchError);
              return [];
            }
          ),
          getHealthForecast(location.latitude, location.longitude).catch(
            (fetchError) => {
              setForecastError(
                fetchError instanceof Error
                  ? fetchError.message
                  : "Forecast data is temporarily unavailable."
              );
              return null;
            }
          ),
        ]).then(([airData, environment, alerts, forecast]) => {
          setAqi(airData.list?.[0]?.main.aqi ?? null);
          setAirComponents(airData.list?.[0]?.components);
          setEnvironmentData(environment);
          setWeatherAlerts(alerts);
          setHealthForecastData(forecast);
          setDataStatus((current) => ({
            ...current,
            airQuality: airData.list?.[0]?.main.aqi !== undefined,
            pollutants: Boolean(airData.list?.[0]?.components),
            heatUv:
              environment.apparentTemperature !== null ||
              environment.apparentTemperatureMax !== null ||
              environment.uvIndexMax !== null,
            weatherAlerts: true,
          }));

          return { airData, environment, alerts, forecast };
        });

        const equityPromise = getHealthEquityData(
          zipToSearch,
          location.latitude,
          location.longitude
        )
          .then((equityData) => {
            setHealthEquityData(equityData);
            return equityData;
          })
          .catch((fetchError) => {
            setEquityError(
              fetchError instanceof Error
                ? fetchError.message
                : "Health equity data is temporarily unavailable."
            );
            return null;
          });

        const newsPromise = getLocalHealthNews(location.city, location.state)
          .then((news) => {
            setLocalNews(news);
            setDataStatus((current) => ({ ...current, news: true }));
          })
          .catch(() => {
            setNewsError("Local health news is temporarily unavailable.");
          })
          .finally(() => {
            setNewsLoading(false);
          });

        const [fluData, covidActivityData, coreData, loadedEquityData] =
          await Promise.all([
            fluPromise,
            covidPromise,
            coreDataPromise,
            equityPromise,
          ]);

        if (currentUser) {
          const nextAqi = coreData.airData.list?.[0]?.main.aqi ?? null;
          const nextAirQualityLabel = getAirQualityLabel(nextAqi);
          const nextAirComponents = coreData.airData.list?.[0]?.components;
          const nextPollutantRisk = getPollutantRiskLabel(nextAirComponents);
          const nextDominantPollutant =
            getDominantPollutant(nextAirComponents);
          const nextHeatRisk = getHeatRiskLabel(
            coreData.environment.apparentTemperatureMax ??
              coreData.environment.apparentTemperature ??
              null
          );
          const nextUvRisk = getUvRiskLabel(
            coreData.environment.uvIndexMax ?? null
          );
          const nextAlertRisk = summarizeAlertRisk(coreData.alerts);
          const nextRiskModel = evaluateRiskModel({
            aqi: nextAqi,
            airQualityLabel: nextAirQualityLabel,
            pollutantRisk: nextPollutantRisk,
            heatRisk: nextHeatRisk,
            uvRisk: nextUvRisk,
            alertRisk: nextAlertRisk,
            fluActivity: fluData,
            covidActivity: covidActivityData.activity,
            covidCoverage: covidActivityData.coverage,
            dataStatus: {
              airQuality: nextAqi !== null,
              pollutants: Boolean(nextAirComponents),
              heatUv:
                coreData.environment.apparentTemperature !== null ||
                coreData.environment.apparentTemperatureMax !== null ||
                coreData.environment.uvIndexMax !== null,
              weatherAlerts: true,
              flu: fluData !== "Unknown",
              covid: covidActivityData.activity !== "Unknown",
              news: false,
            },
            profile: currentProfile,
          });

          try {
            const snapshot = await saveHealthSnapshot({
              userId: currentUser.id,
              zipCode: zipToSearch,
              city: location.city,
              state: location.state,
              latitude: location.latitude,
              longitude: location.longitude,
              modelVersion: nextRiskModel.modelVersion,
              modelScore: nextRiskModel.scoreBreakdown.score,
              healthRisk: nextRiskModel.healthRisk,
              respiratoryRisk: nextRiskModel.respiratoryRisk,
              airQuality: nextAirQualityLabel,
              aqi: nextAqi,
              dominantPollutant: nextDominantPollutant,
              pollutantRisk: nextPollutantRisk,
              heatRisk: nextHeatRisk,
              uvRisk: nextUvRisk,
              alertRisk: nextAlertRisk,
              fluActivity: fluData,
              covidActivity: covidActivityData.activity,
              covidCoverage: covidActivityData.coverage,
              forecastAverageScore: coreData.forecast?.averageScore ?? null,
              forecastPeakScore: coreData.forecast?.peakScore ?? null,
              forecastBestWindow:
                coreData.forecast?.bestWindow?.displayTime ?? null,
              forecastWorstWindow:
                coreData.forecast?.worstWindow?.displayTime ?? null,
              forecastAllergyPeakScore:
                coreData.forecast?.allergyPeakScore ?? null,
              forecastAllergyPeakWindow:
                coreData.forecast?.allergyPeakWindow?.displayTime ?? null,
              forecastPollenRisk:
                coreData.forecast?.allergyPeakWindow?.pollenRisk ?? null,
              equityScore: loadedEquityData?.equityScore ?? null,
              equityLevel: loadedEquityData?.equityLevel ?? null,
              placesChronicBurdenScore:
                loadedEquityData?.cdcPlaces?.chronicBurdenScore ?? null,
              placesAsthma: loadedEquityData?.cdcPlaces?.asthma ?? null,
              placesCopd: loadedEquityData?.cdcPlaces?.copd ?? null,
              placesSmoking: loadedEquityData?.cdcPlaces?.smoking ?? null,
              placesObesity: loadedEquityData?.cdcPlaces?.obesity ?? null,
              placesDiabetes: loadedEquityData?.cdcPlaces?.diabetes ?? null,
              profileSummary: nextRiskModel.personalizationSummary,
            });
            setLatestSnapshot(snapshot);
            setSnapshotStatus(
              "Today's local conditions were saved for this check-in."
            );
          } catch (snapshotError) {
            setSnapshotStatus(
              snapshotError instanceof Error
                ? `Snapshot not saved: ${snapshotError.message}`
                : "Snapshot not saved."
            );
          }
        }

        await newsPromise;
      })();
    } catch (locationError) {
      console.error(locationError);
      if (locationError instanceof Error) {
        setError(locationError.message);
      } else {
        setError("Unable to retrieve health data.");
      }
    } finally {
      setLoading(false);
    }
  };

  const resetSearch = () => {
    setSearched(false);
    setError("");
    setZipCode("");
    loadedZipRef.current = "";
  };

  const loadUserProfile = async (userId: string) => {
    try {
      const profile = await getUserProfile(userId);
      setUserProfile(profile);

      // Email/password sign-up collects these fields before the account is
      // ever created, so the only way to land here authenticated with no
      // profile is a first-time Google sign-in/sign-up, which skips that
      // form entirely. Send them to finish it once per session rather than
      // silently dropping them on the generic ZIP-level dashboard.
      if (!profile && !hasRedirectedForMissingProfileRef.current) {
        hasRedirectedForMissingProfileRef.current = true;
        router.push("/account");
      }
    } catch (profileError) {
      console.error(profileError);
    }
  };

  const loadCheckinStreak = async (userId: string) => {
    try {
      const streak = await getSymptomCheckinStreak(userId);
      setCheckinStreak(streak);
    } catch (streakError) {
      console.error(streakError);
      setCheckinStreak(emptyCheckinStreak());
    }
  };

  // Downstream of the correlation feature, not parallel to it -- reuses
  // whichever factor the correlation feature already identified as
  // strongest for this user, rather than re-deriving a separate one.
  const loadPersonalRiskCalibration = async (
    userId: string,
    correlation: SymptomEnvironmentCorrelation
  ) => {
    if (correlation.status !== "ready" || !correlation.topFactor) {
      setPersonalRiskCalibration(null);
      return;
    }

    const { topFactor } = correlation;

    try {
      const slope = await computeUserFactorSlope(userId, topFactor.factor);

      if (!slope) {
        setPersonalRiskCalibration({
          status: "insufficient_variation",
          factorLabel: topFactor.label,
          posteriorMean: null,
          posteriorSE: null,
          trustWeightPct: null,
          populationSource: "neutral_fallback",
          populationN: 0,
        });
        return;
      }

      const response = await fetch("/api/personal-risk-calibration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          factor: topFactor.factor,
          userSlope: slope.beta,
          userSE: slope.se,
          userN: slope.n,
        }),
      });

      if (!response.ok) {
        setPersonalRiskCalibration(null);
        return;
      }

      const data = await response.json();
      setPersonalRiskCalibration({ ...data, factorLabel: topFactor.label });
    } catch (calibrationError) {
      console.error(calibrationError);
      setPersonalRiskCalibration(null);
    }
  };

  const loadSymptomEnvironmentCorrelation = async (userId: string) => {
    try {
      const correlation = await getSymptomEnvironmentCorrelation(userId);
      setSymptomEnvironmentCorrelation(correlation);
      await loadPersonalRiskCalibration(userId, correlation);
    } catch (correlationError) {
      console.error(correlationError);
      setSymptomEnvironmentCorrelation(emptySymptomEnvironmentCorrelation());
      setPersonalRiskCalibration(null);
    }
  };

  // A freshly logged check-in is a new data point for both -- refresh
  // together so the correlation card doesn't lag behind the streak.
  const refreshCheckinDerivedData = async (userId: string) => {
    await Promise.all([
      loadCheckinStreak(userId),
      loadSymptomEnvironmentCorrelation(userId),
    ]);
  };

  useEffect(() => {
    const restoreFromUrl = () => {
      if (typeof window === "undefined") return;

      const params = new URLSearchParams(window.location.search);
      const restoredZipCode = params.get("zipCode");

      if (!restoredZipCode) {
        loadedZipRef.current = "";
        setSearched(false);
        setError("");
        setZipCode("");
        return;
      }

      if (restoredZipCode !== loadedZipRef.current) {
        loadedZipRef.current = restoredZipCode;
        setZipCode(restoredZipCode);
        void searchZipCode(restoredZipCode, { updateUrl: false });
      }
    };

    restoreFromUrl();
    window.addEventListener("popstate", restoreFromUrl);

    return () => {
      window.removeEventListener("popstate", restoreFromUrl);
    };
    // Restores shared/bookmarked URLs and browser back/forward without re-triggering fetches unnecessarily.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!supabase) return;

    void supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) {
        void loadUserProfile(data.user.id);
        void loadCheckinStreak(data.user.id);
        void loadSymptomEnvironmentCorrelation(data.user.id);
      } else {
        setCheckinStreak(emptyCheckinStreak());
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);

      if (nextUser) {
        void loadUserProfile(nextUser.id);
        void loadCheckinStreak(nextUser.id);
        void loadSymptomEnvironmentCorrelation(nextUser.id);
      } else {
        setUserProfile(null);
        setCheckinStreak(emptyCheckinStreak());
        setSymptomEnvironmentCorrelation(emptySymptomEnvironmentCorrelation());
        setPersonalRiskCalibration(null);
        hasRedirectedForMissingProfileRef.current = false;
      }
    });

    return () => {
      data.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: DashboardDataContextValue = {
    zipCode,
    city,
    state,
    latitude,
    longitude,
    searched,
    loading,
    error,
    user,
    userProfile,
    checkinStreak,
    symptomEnvironmentCorrelation,
    personalRiskCalibration,
    aqi,
    fluActivity,
    covidData,
    environmentData,
    weatherAlerts,
    airComponents,
    localNews,
    healthEquityData,
    healthForecastData,
    dataStatus,
    newsLoading,
    newsError,
    equityError,
    forecastError,
    latestSnapshot,
    snapshotStatus,
    featureSnapshot,
    featureSnapshotStatus,
    covidActivity,
    heatRisk,
    uvRisk,
    alertRisk,
    pollutantRisk,
    dominantPollutant,
    airQualityLabel,
    healthRisk,
    respiratoryRisk,
    baseHealthRisk: riskModel.baseHealthRisk,
    baseRespiratoryRisk: riskModel.baseRespiratoryRisk,
    personalizationSummary,
    personalizedRiskReasons: riskModel.personalizedRiskReasons,
    isPersonalized: riskModel.isPersonalized,
    modelVersion: riskModel.modelVersion,
    methodology: riskModel.methodology,
    scoreBreakdown,
    dataConfidence,
    symptomPrediction,
    mainTwinScore,
    mainTwinLevel,
    searchZipCode,
    resetSearch,
    setZipCode,
    refreshCheckinStreak: refreshCheckinDerivedData,
  };

  return (
    <DashboardDataContext.Provider value={value}>
      {children}
    </DashboardDataContext.Provider>
  );
}
