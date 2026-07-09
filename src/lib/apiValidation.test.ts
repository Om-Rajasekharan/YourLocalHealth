import { describe, expect, it } from "vitest";
import {
  healthChatSchema,
  reverseLocationQuerySchema,
  riskQuerySchema,
} from "./apiValidation";

describe("api validation schemas", () => {
  it("accepts valid risk query ZIP codes", () => {
    expect(riskQuerySchema.parse({ zipCode: "80528" })).toEqual({
      zipCode: "80528",
    });
  });

  it("rejects malformed ZIP codes", () => {
    expect(() => riskQuerySchema.parse({ zipCode: "abc" })).toThrow();
  });

  it("coerces valid coordinates", () => {
    expect(
      reverseLocationQuerySchema.parse({
        latitude: "40.5",
        longitude: "-105.1",
      })
    ).toEqual({
      latitude: 40.5,
      longitude: -105.1,
    });
  });

  it("bounds health chat questions", () => {
    expect(() =>
      healthChatSchema.parse({ question: "x".repeat(1300) })
    ).toThrow();
  });
});
