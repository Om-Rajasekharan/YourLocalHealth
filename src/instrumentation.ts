// Next.js calls register() once, automatically, before the server starts
// handling requests (Node.js runtime only -- this file is a no-op under the
// Edge runtime). This is the standard place to wire up OpenTelemetry: see
// src/lib/observability.ts, which uses the tracer registered here for every
// traceAsync() call across the app (ML serving, RAG retrieval, the WASM
// risk-kernel cross-check, rate limiting) without any of those call sites
// needing to know OpenTelemetry exists.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { registerOpenTelemetry } = await import("./lib/otel");
  registerOpenTelemetry();
}
