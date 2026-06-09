"use client";

import { useState } from "react";

export default function Home() {
  const [zipCode, setZipCode] = useState("");
  const [searched, setSearched] = useState(false);

  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  const handleSearch = async () => {
    try {
    const response = await fetch(
      `https://api.zippopotam.us/us/${zipCode}`
    );

    const data = await response.json();

    setCity(data.places[0]["place name"]);
    setState(data.places[0]["state abbreviation"]);

    setSearched(true);
  } catch (error) {
    console.error(error);
  }
  };

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-5xl font-bold">
        YourLocalHealth
      </h1>

      <p className="mt-4 text-xl">
        Health risks and public health conditions affecting your community.
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
          Search
        </button>
      </div>

      {searched && (
        <div className="mt-8 border rounded p-4">
          <h2 className="text-2xl font-bold">
            Results for {zipCode}
          </h2>

          <p>Location: {city}, {state}</p>
          <p>Respiratory Risk: Moderate</p>
          <p>Flu Activity: Moderate</p>
          <p>COVID Activity: Low</p>
          <p>Air Quality: Good</p>
        </div>
      )}
    </main>
  );
}