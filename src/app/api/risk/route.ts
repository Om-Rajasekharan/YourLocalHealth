import { NextResponse } from "next/server";
import {
  getAirQualityLabel,
  getDominantPollutant,
  getPollutantRiskLabel,
} from "../../../lib/airQuality";
import {
  riskQuerySchema,
  validationErrorMessage,
} from "../../../lib/apiValidation";
import { isFeatureEnabled } from "../../../lib/featureFlags";
import { getMlPredictions } from "../../../lib/mlModelClient";
import { evaluateRiskModel } from "../../../lib/riskModel";
import { getRateLimitKey, rateLimit } from "../../../lib/rateLimit";
import { getAirQuality, type AirQualityData } from "../../../services/airsQuality";
import { getCovidData, type CovidActivityData } from "../../../services/covid";
import {
  getEnvironmentData,
  getHeatRiskLabel,
  getUvRiskLabel,
} from "../../../services/environment";
import { buildFeatureSnapshot } from "../../../services/featureSnapshot";
import { getFluData } from "../../../services/flu";
import { getHealthEquityData } from "../../../services/healthEquity";
import { getHealthForecast } from "../../../services/healthForecast";
import { getLocation } from "../../../services/location";
import {
  getWeatherAlerts,
  summarizeAlertRisk,
} from "../../../services/weatherAlerts";

const unknownCovidData: CovidActivityData = {
  activity: "Unknown",
  value: null,
  numberOfSites: 0,
  coverage: "Unknown",
  timePeriod: "Unknown",
  updatedAt: "Unknown",
  weekEnd: "Unknown",
};

export async function GET(request: Request) {
  const limiter = rateLimit({
    key: getRateLimitKey(request, "api-risk"),
    limit: 30,
    windowMs: 60 * 1000,
  });

  if (!limiter.allowed) {
    return NextResponse.json(
      {
        error: "Too many risk requests. Please try again shortly.",
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

  const { searchParams } = new URL(request.url);
  const parsed = riskQuerySchema.safeParse({
    zipCode: searchParams.get("zipCode"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: validationErrorMessage(parsed.error) },
      { status: 400 }
    );
  }

  const { zipCode } = parsed.data;

  try {
    const location = await getLocation(zipCode);
    const [
      airData,
      environmentData,
      alerts,
      fluActivity,
      covidData,
      forecastData,
      equityData,
    ] = await Promise.all([
      getAirQuality(location.latitude, location.longitude).catch(
        (): AirQualityData => ({})
      ),
      getEnvironmentData(location.latitude, location.longitude),
      getWeatherAlerts(location.latitude, location.longitude).catch(() => []),
      getFluData(location.state).catch(() => "Unknown"),
      getCovidData(location.state).catch(() => unknownCovidData),
      getHealthForecast(location.latitude, location.longitude).catch(() => null),
      getHealthEquityData(zipCode, location.latitude, location.longitude).catch(
        () => null
      ),
    ]);

    const aqi = airData.list?.[0]?.main.aqi ?? null;
    const airComponents = airData.list?.[0]?.components;
    const airQualityLabel = getAirQualityLabel(aqi);
    const pollutantRisk = getPollutantRiskLabel(airComponents);
    const dominantPollutant = getDominantPollutant(airComponents);
    const heatRisk = getHeatRiskLabel(
      environmentData.apparentTemperatureMax ??
        environmentData.apparentTemperature ??
        null
    );
    const uvRisk = getUvRiskLabel(environmentData.uvIndexMax ?? null);
    const alertRisk = summarizeAlertRisk(alerts);
    const dataStatus = {
      airQuality: aqi !== null,
      pollutants: Boolean(airComponents),
      heatUv:
        environmentData.apparentTemperature !== null ||
        environmentData.apparentTemperatureMax !== null ||
        environmentData.uvIndexMax !== null,
      weatherAlerts: true,
      flu: fluActivity !== "Unknown",
      covid: covidData.activity !== "Unknown",
      news: false,
    };
    const riskModel = evaluateRiskModel({
      aqi,
      airQualityLabel,
      pollutantRisk,
      heatRisk,
      uvRisk,
      alertRisk,
      fluActivity,
      covidActivity: covidData.activity,
      covidCoverage: covidData.coverage,
      dataStatus,
      profile: null,
    });
    const featureSnapshot = buildFeatureSnapshot({
      zipCode,
      city: location.city,
      state: location.state,
      latitude: location.latitude,
      longitude: location.longitude,
      aqi,
      airComponents,
      heatRisk,
      uvRisk,
      alertRisk,
      fluActivity,
      covidData,
      forecastData,
      equityData,
      profileModifier: 0,
      dataStatus,
    });

    const mlPredictions = isFeatureEnabled("mlModelServing")
      ? await getMlPredictions({
          model_score: riskModel.scoreBreakdown.score,
          aqi,
          latitude: Number(location.latitude) || null,
          longitude: Number(location.longitude) || null,
          forecast_average_score: forecastData?.averageScore ?? null,
          forecast_peak_score: forecastData?.peakScore ?? null,
          forecast_allergy_peak_score: forecastData?.allergyPeakScore ?? null,
          equity_score: equityData?.equityScore ?? null,
          places_chronic_burden_score:
            equityData?.cdcPlaces?.chronicBurdenScore ?? null,
          places_asthma: equityData?.cdcPlaces?.asthma ?? null,
          places_copd: equityData?.cdcPlaces?.copd ?? null,
          places_smoking: equityData?.cdcPlaces?.smoking ?? null,
          places_obesity: equityData?.cdcPlaces?.obesity ?? null,
          places_diabetes: equityData?.cdcPlaces?.diabetes ?? null,
          checkin_month: new Date().getMonth() + 1,
          checkin_day_of_week: new Date().getDay(),
          zip_prefix: Number(zipCode.slice(0, 3)) || null,
          city: location.city,
          state: location.state,
          model_version: riskModel.modelVersion,
          health_risk: riskModel.healthRisk,
          respiratory_risk: riskModel.respiratoryRisk,
          air_quality: airQualityLabel,
          dominant_pollutant: dominantPollutant,
          pollutant_risk: pollutantRisk,
          heat_risk: heatRisk,
          uv_risk: uvRisk,
          alert_risk: alertRisk,
          flu_activity: fluActivity,
          covid_activity: covidData.activity,
          covid_coverage: covidData.coverage,
          forecast_best_window: forecastData?.bestWindow?.displayTime ?? null,
          forecast_worst_window: forecastData?.worstWindow?.displayTime ?? null,
          forecast_allergy_peak_window:
            forecastData?.allergyPeakWindow?.displayTime ?? null,
          forecast_pollen_risk:
            forecastData?.allergyPeakWindow?.pollenRisk ?? null,
          equity_level: equityData?.equityLevel ?? null,
        })
      : null;

    return NextResponse.json({
      zipCode,
      location,
      generatedAt: new Date().toISOString(),
      risk: {
        overall: riskModel.healthRisk,
        respiratory: riskModel.respiratoryRisk,
        score: riskModel.scoreBreakdown.score,
        modelVersion: riskModel.modelVersion,
      },
      signals: {
        aqi,
        airQualityLabel,
        dominantPollutant,
        pollutantRisk,
        heatRisk,
        uvRisk,
        alertRisk,
        fluActivity,
        covidActivity: covidData.activity,
        covidCoverage: covidData.coverage,
      },
      forecast: forecastData
        ? {
            averageScore: forecastData.averageScore,
            peakScore: forecastData.peakScore,
            bestWindow: forecastData.bestWindow?.displayTime ?? null,
            worstWindow: forecastData.worstWindow?.displayTime ?? null,
            signalCompleteness: forecastData.statistics.signalCompleteness,
          }
        : null,
      equity: equityData
        ? {
            score: equityData.equityScore,
            level: equityData.equityLevel,
            chronicBurdenScore:
              equityData.cdcPlaces?.chronicBurdenScore ?? null,
          }
        : null,
      confidence: riskModel.dataConfidence,
      featureSnapshot,
      mlPredictions,
      disclaimer:
        "Informational public-health snapshot only; not medical advice, diagnosis, or treatment.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate risk snapshot.",
      },
      { status: 500 }
    );
  }
}
