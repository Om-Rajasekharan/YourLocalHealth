import { z } from "zod";

export const zipCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{5}$/, "ZIP code must be exactly 5 digits.");

export const stateSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, "State must be a 2-letter abbreviation.");

export const coordinateSchema = z.coerce
  .number()
  .finite()
  .refine((value) => value >= -180 && value <= 180, {
    message: "Coordinate is out of range.",
  });

export const latitudeSchema = z.coerce
  .number()
  .finite()
  .refine((value) => value >= -90 && value <= 90, {
    message: "Latitude is out of range.",
  });

export const longitudeSchema = z.coerce
  .number()
  .finite()
  .refine((value) => value >= -180 && value <= 180, {
    message: "Longitude is out of range.",
  });

export const reverseLocationQuerySchema = z.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
});

export const riskQuerySchema = z.object({
  zipCode: zipCodeSchema,
});

export const healthChatSchema = z.object({
  question: z.string().trim().min(1).max(1200),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(3000),
      })
    )
    .max(12)
    .optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

export const healthPlanSchema = z.object({
  context: z.record(z.string(), z.unknown()).optional(),
  model: z.record(z.string(), z.unknown()).optional(),
  forecast: z.record(z.string(), z.unknown()).optional(),
});

export function validationErrorMessage(error: z.ZodError) {
  return error.issues.map((issue) => issue.message).join(" ");
}
