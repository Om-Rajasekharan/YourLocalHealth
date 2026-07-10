// WebAssembly-exported version of the transparent weighted risk-scoring
// kernel. native/risk_kernel.cpp is a CLI tool (reads argv, prints JSON to
// stdout) meant for standalone use; this file exposes the same scoring math
// as plain callable functions instead, since a CLI-argument-parsing binary
// isn't something you can meaningfully call from JS. The scoring logic
// (clamp, weighted average, dominant contributor) is intentionally
// duplicated rather than shared via a header -- it's a handful of lines,
// and keeping the CLI tool and the WASM module independently readable and
// deployable outweighs the cost of the small duplication.
//
// Build: see native/wasm/build.sh

#include <algorithm>
#include <emscripten/emscripten.h>

extern "C" {

double clamp_value(double value, double low, double high) {
  return std::max(low, std::min(high, value));
}

// Weighted average of `count` (value, weight) pairs, each value clamped to
// [0, 100] before weighting, then the result clamped to [0, 100] again.
// Mathematically equivalent to src/lib/riskModel.ts's buildScoreBreakdown
// score -- that function converts each signal's string severity label
// (e.g. "High") to a 0/0.5/1 fraction via signalSeverity() and multiplies
// by an integer point weight, but since every weight used there is even,
// intermediate per-item rounding never actually changes the sum, so
// passing values = signalSeverity(label) * 100 with the same weights
// produces an identical result here. This exists so the two independent
// implementations can be cross-checked against each other in production
// (see src/lib/wasmRiskKernel.ts) -- an independent C++ reimplementation
// that silently disagrees with the TypeScript version is exactly the kind
// of drift bug that's otherwise invisible until someone notices a wrong
// score.
EMSCRIPTEN_KEEPALIVE
double compute_weighted_score(double* values, double* weights, int count) {
  double weighted_total = 0.0;
  double weight_total = 0.0;

  for (int i = 0; i < count; i++) {
    weighted_total += clamp_value(values[i], 0.0, 100.0) * weights[i];
    weight_total += weights[i];
  }

  if (weight_total <= 0.0) {
    return 0.0;
  }

  return clamp_value(weighted_total / weight_total, 0.0, 100.0);
}

// Index of the signal with the largest value*weight contribution, or -1 if
// count is 0.
EMSCRIPTEN_KEEPALIVE
int dominant_contributor_index(double* values, double* weights, int count) {
  int best_index = -1;
  double best_contribution = -1.0;

  for (int i = 0; i < count; i++) {
    const double contribution = clamp_value(values[i], 0.0, 100.0) * weights[i];
    if (contribution > best_contribution) {
      best_contribution = contribution;
      best_index = i;
    }
  }

  return best_index;
}

// Count of signals with a strictly positive value -- used as a rough
// "how much data did we actually have" signal.
EMSCRIPTEN_KEEPALIVE
int available_signal_count(double* values, int count) {
  int total = 0;

  for (int i = 0; i < count; i++) {
    if (values[i] > 0.0) {
      total++;
    }
  }

  return total;
}

}  // extern "C"
