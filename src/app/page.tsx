"use client";

import { useState } from "react";
import { getAirQualityLabel } from "../lib/airQuality";
import {
  calculateRespiratoryRisk,
  calculateHealthRisk,
  getRiskColor
} from "../lib/healthRisk";
import { getLocation } from "../services/location";
import { getAirQuality } from "../services/airsQuality";
import { getFluData } from "../services/flu";
import { getCovidData } from "../services/covid";

export default function Home() {
  const [zipCode, setZipCode] = useState("");
  const [searched, setSearched] = useState(false);

  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [aqi, setAqi] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fluActivity, setFluActivity] = useState("Unknown");
  const [covidActivity, setCovidActivity] = useState("Unknown");

  const handleSearch = async () => {
    setError("");
    setSearched(false);
    setLoading(true);
    try {
      const location = await getLocation(zipCode);

      setCity(location.city);
      setState(location.state);

      const fluData = await getFluData(location.state);
      setFluActivity(fluData);

      const covidData = await getCovidData(location.state);
      setCovidActivity(covidData.activity);

      const airData = await getAirQuality(
        location.latitude,
        location.longitude
      );

      setAqi(airData.list?.[0]?.main.aqi ?? null);
      setSearched(true);
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Unable to retrieve health data.");
      }
    } finally {
      setLoading(false);
    }
  };

  const healthRisk = calculateHealthRisk(
    aqi,
    fluActivity,
    covidActivity
  );
  const respiratoryRisk = calculateRespiratoryRisk(
    aqi,
    fluActivity,
    covidActivity
  );
  return (
    <main className="min-h-screen max-w-6xl mx-auto p-8">
      <h1 className="text-6xl font-bold">
  YourLocalHealth
</h1>

<p className="mt-4 text-xl text-gray-400 max-w-2xl">
  Understand health risks in your area. Track air quality,
  respiratory illness activity, and public health alerts.
</p>

      <div className="mt-8">
        <input
          type="text"
          placeholder="Enter ZIP Code"
          value={zipCode}
          onChange={(e) => setZipCode(e.target.value)}
          className="border rounded p-2"
        />

        <button
          onClick={handleSearch}
          className="ml-2 rounded bg-blue-500 px-4 py-2 text-white"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {error && (
  <p className="mt-4 text-red-500">
    {error}
  </p>
)}

      {searched && (
        <div className="mt-8 border rounded p-4">
          <h2 className="text-2xl font-bold">
            Results for {zipCode}
          </h2>
{/*summary card*/}
<div className="mb-6 mt-4 rounded-xl border p-6">
      <h3 className="text-gray-400">
        Overall Health Risk
      </h3>

      <p
  className={`mt-2 text-5xl font-bold ${getRiskColor(
    healthRisk
  )}`}
>
  {healthRisk.toUpperCase()}
</p>
    </div>

{/*GRID*/}
          <div className="mt-4 grid md:grid-cols-2 gap-4">

  <div className="border rounded p-3">
    <strong>📍 Location</strong>
    <p>{city}, {state}</p>
  </div>

  <div className="border rounded p-3">
    <strong>🌬️ Air Quality</strong>
    <p>{aqi} - {getAirQualityLabel(aqi)}</p>
  </div>

  <div className="border rounded p-3">
    <strong>😷 Respiratory Risk</strong>
    <p className={getRiskColor(respiratoryRisk)}>
      {respiratoryRisk}
    </p>
  </div>

  <div className="border rounded p-3">
    <strong>🤒 Flu Activity</strong>
    <p>{fluActivity}</p>
  </div>

  <div className="border rounded p-3">
    <strong>🦠 COVID Activity</strong>
    <p>{covidActivity}</p>
  </div>

</div>
        </div>
      )}
    </main>
  );
}
