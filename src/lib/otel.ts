import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  type SpanExporter,
} from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

const SERVICE_NAME = "mylocalhealth";

let registered = false;

function buildExporter(): SpanExporter {
  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  if (otlpEndpoint) {
    return new OTLPTraceExporter({ url: otlpEndpoint });
  }

  // No backend configured -- export real OpenTelemetry spans to stdout
  // instead of nowhere. This is genuine OTel (proper spans, trace/span IDs,
  // context propagation), just without a hosted collector; point
  // OTEL_EXPORTER_OTLP_ENDPOINT at Honeycomb/Grafana Cloud/etc. (both have
  // free tiers) to switch to a real backend with zero code changes.
  return new ConsoleSpanExporter();
}

/**
 * Registers a NodeTracerProvider as the global OpenTelemetry tracer
 * provider. Called once from instrumentation.ts at server startup. Safe to
 * call more than once (e.g. hot reload in dev) -- only registers globally
 * the first time.
 */
export function registerOpenTelemetry() {
  if (registered) return;
  registered = true;

  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: SERVICE_NAME,
    }),
    spanProcessors: [new BatchSpanProcessor(buildExporter())],
  });

  provider.register();
}
