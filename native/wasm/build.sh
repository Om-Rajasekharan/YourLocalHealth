#!/usr/bin/env bash
# Compiles risk_kernel_wasm.cpp to a single self-contained ES module
# (WASM binary embedded as base64 via SINGLE_FILE, so there's no separate
# .wasm asset for Next.js's bundler to resolve at runtime -- it's just a
# plain JS module).
#
# Requires Emscripten (brew install emscripten). The compiled output in
# dist/ is committed to git like any other build artifact -- the deployed
# app does not have emcc available, so this is not run as part of
# `npm run build`. Re-run this script and commit the result whenever
# risk_kernel_wasm.cpp changes.
set -euo pipefail

cd "$(dirname "$0")"
mkdir -p dist

emcc risk_kernel_wasm.cpp \
  -O3 \
  -s WASM=1 \
  -s SINGLE_FILE=1 \
  -s MODULARIZE=1 \
  -s EXPORT_ES6=1 \
  -s ENVIRONMENT=node \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s EXPORTED_FUNCTIONS='["_compute_weighted_score","_dominant_contributor_index","_available_signal_count","_malloc","_free"]' \
  -s EXPORTED_RUNTIME_METHODS='["ccall","HEAPF64"]' \
  -o dist/risk_kernel_wasm.mjs

echo "Wrote native/wasm/dist/risk_kernel_wasm.mjs"
