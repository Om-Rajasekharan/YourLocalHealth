import { afterEach, describe, expect, it, vi } from "vitest";
import { getLocation } from "./location";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("getLocation", () => {
  it("resolves a normal 50-state ZIP directly from the us endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        places: [
          {
            "place name": "Beverly Hills",
            "state abbreviation": "CA",
            latitude: "34.0901",
            longitude: "-118.4065",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getLocation("90210");

    expect(result).toEqual({
      city: "Beverly Hills",
      state: "CA",
      latitude: "34.0901",
      longitude: "-118.4065",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.zippopotam.us/us/90210"
    );
  });

  it("falls back to Puerto Rico when the us endpoint 404s, using the postal abbreviation not the FIPS code", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/us/")) {
        return Promise.resolve({ ok: false });
      }
      if (url.includes("/pr/")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            places: [
              {
                "place name": "San Juan",
                // zippopotam.us returns a numeric FIPS code here for
                // territories, e.g. "72" -- must not leak into the result.
                "state abbreviation": "72",
                latitude: "18.4105",
                longitude: "-66.0605",
              },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: false });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getLocation("00910");

    expect(result).toEqual({
      city: "San Juan",
      state: "PR",
      latitude: "18.4105",
      longitude: "-66.0605",
    });
  });

  it("throws a clear error when no country code has the ZIP", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false })
    );

    await expect(getLocation("00000")).rejects.toThrow(
      "Please enter a valid US ZIP code."
    );
  });
});
