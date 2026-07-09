export type ObservabilityEvent = {
  name: string;
  status: "ok" | "error";
  durationMs: number;
  attributes?: Record<string, string | number | boolean | null | undefined>;
  error?: string;
};

function sanitizeAttributes(
  attributes?: ObservabilityEvent["attributes"]
): ObservabilityEvent["attributes"] {
  if (!attributes) return undefined;

  return Object.fromEntries(
    Object.entries(attributes).filter(
      ([key]) =>
        !key.toLowerCase().includes("key") &&
        !key.toLowerCase().includes("token") &&
        !key.toLowerCase().includes("secret")
    )
  );
}

export function recordEvent(event: ObservabilityEvent) {
  const payload = {
    ...event,
    attributes: sanitizeAttributes(event.attributes),
    timestamp: new Date().toISOString(),
  };

  if (event.status === "error") {
    console.warn("[mylocalhealth:trace]", JSON.stringify(payload));
  } else if (process.env.NODE_ENV !== "test") {
    console.info("[mylocalhealth:trace]", JSON.stringify(payload));
  }
}

export async function traceAsync<T>(
  name: string,
  operation: () => Promise<T>,
  attributes?: ObservabilityEvent["attributes"]
): Promise<T> {
  const start = performance.now();

  try {
    const result = await operation();
    recordEvent({
      name,
      status: "ok",
      durationMs: Math.round(performance.now() - start),
      attributes,
    });
    return result;
  } catch (error) {
    recordEvent({
      name,
      status: "error",
      durationMs: Math.round(performance.now() - start),
      attributes,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}
