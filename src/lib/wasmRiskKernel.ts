import path from "node:path";
import { pathToFileURL } from "node:url";
import { signalSeverity } from "./riskModel";
import { recordEvent, traceAsync } from "./observability";

export type WeightedSignal = {
  value: string;
  maxPoints: number;
};

type EmscriptenModule = {
  _malloc(bytes: number): number;
  _free(ptr: number): void;
  HEAPF64: Float64Array;
  ccall(
    name: string,
    returnType: string,
    argTypes: string[],
    args: number[]
  ): number;
};

let modulePromise: Promise<EmscriptenModule> | null = null;

async function loadModule(): Promise<EmscriptenModule> {
  if (!modulePromise) {
    // Two separate problems, two separate fixes:
    // 1. A relative import path resolves against webpack's *compiled*
    //    output location (.next/server/app/...), not this source file's
    //    location -- so it needs to be an absolute path instead, anchored
    //    to process.cwd() (the project root in dev/next-start, and the
    //    standalone output root in production -- see
    //    outputFileTracingIncludes in next.config.ts, which makes sure
    //    this file is actually copied into that directory).
    // 2. webpack still mistransforms the generated Emscripten glue code
    //    even with an absolute path (it isn't meant to be bundled -- it's
    //    already a complete, optimized, self-contained module), so
    //    webpackIgnore tells it to leave this import alone entirely and
    //    resolve it natively at request time.
    const modulePath = path.join(
      process.cwd(),
      "native/wasm/dist/risk_kernel_wasm.mjs"
    );
    const moduleUrl = pathToFileURL(modulePath).href;

    modulePromise = import(/* webpackIgnore: true */ moduleUrl).then(
      (mod) => (mod.default as () => Promise<EmscriptenModule>)()
    );
  }

  return modulePromise;
}

/**
 * Recomputes the overall risk score using the C++ WASM kernel
 * (native/wasm/risk_kernel_wasm.cpp) and compares it against the
 * TypeScript-computed score, purely as an independent cross-check -- this
 * never replaces src/lib/riskModel.ts's score, which stays the single
 * source of truth for what the app shows. Returns null on any failure
 * (module fails to load, WASM call throws) so a WASM problem can never
 * affect the actual API response, only the verification signal.
 */
export async function crossCheckRiskScore(
  signals: WeightedSignal[],
  expectedScore: number
): Promise<{ wasmScore: number; agrees: boolean } | null> {
  try {
    const result = await traceAsync(
      "wasm_risk_kernel.cross_check",
      async () => {
        const kernel = await loadModule();
        const count = signals.length;
        const valuesPtr = kernel._malloc(count * 8);
        const weightsPtr = kernel._malloc(count * 8);

        try {
          signals.forEach((signal, index) => {
            kernel.HEAPF64[(valuesPtr >> 3) + index] =
              signalSeverity(signal.value) * 100;
            kernel.HEAPF64[(weightsPtr >> 3) + index] = signal.maxPoints;
          });

          const rawScore = kernel.ccall(
            "compute_weighted_score",
            "number",
            ["number", "number", "number"],
            [valuesPtr, weightsPtr, count]
          );

          const wasmScore = Math.round(rawScore);
          return { wasmScore, agrees: wasmScore === expectedScore };
        } finally {
          kernel._free(valuesPtr);
          kernel._free(weightsPtr);
        }
      },
      { signalCount: signals.length, expectedScore }
    );

    // traceAsync only records that the call succeeded, not what it found --
    // a disagreement is the actual signal this exists to catch, so it gets
    // its own loud, explicitly-searchable event on top of the normal trace.
    if (!result.agrees) {
      recordEvent({
        name: "wasm_risk_kernel.disagreement",
        status: "error",
        durationMs: 0,
        attributes: { expectedScore, wasmScore: result.wasmScore },
        error: "TypeScript and WASM risk scores disagree.",
      });
    }

    return result;
  } catch {
    return null;
  }
}
