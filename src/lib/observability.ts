import { SpanStatusCode, trace } from "@opentelemetry/api";

const tracer = trace.getTracer("mylocalhealth");

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

function otelAttributes(attributes?: ObservabilityEvent["attributes"]) {
  const sanitized = sanitizeAttributes(attributes);
  if (!sanitized) return {};

  // OTel span attributes can't be null/undefined -- drop those keys rather
  // than coerce them into a misleading string.
  return Object.fromEntries(
    Object.entries(sanitized).filter(([, value]) => value !== null && value !== undefined)
  ) as Record<string, string | number | boolean>;
}

/**
 * Wraps an async operation in both a real OpenTelemetry span (see
 * src/lib/otel.ts for where the tracer provider is registered) and the
 * existing structured console trace log. Every call site (ML serving, RAG
 * retrieval, the WASM risk-kernel cross-check, rate limiting) gets real
 * distributed tracing for free without needing to know OpenTelemetry
 * exists -- this is the only function that touches the OTel API directly.
 */
export async function traceAsync<T>(
  name: string,
  operation: () => Promise<T>,
  attributes?: ObservabilityEvent["attributes"]
): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    const start = performance.now();
    span.setAttributes(otelAttributes(attributes));

    try {
      const result = await operation();
      const durationMs = Math.round(performance.now() - start);
      span.setStatus({ code: SpanStatusCode.OK });
      recordEvent({ name, status: "ok", durationMs, attributes });
      return result;
    } catch (error) {
      const durationMs = Math.round(performance.now() - start);
      const message = error instanceof Error ? error.message : "Unknown error";
      span.recordException(message);
      span.setStatus({ code: SpanStatusCode.ERROR, message });
      recordEvent({ name, status: "error", durationMs, attributes, error: message });
      throw error;
    } finally {
      span.end();
    }
  });
}
