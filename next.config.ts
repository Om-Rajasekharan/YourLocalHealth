import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // native/wasm/dist is loaded dynamically with webpackIgnore (see
  // src/lib/wasmRiskKernel.ts), so webpack's static analysis never sees the
  // import and won't otherwise include it in standalone output tracing.
  outputFileTracingIncludes: {
    "/api/risk": ["./native/wasm/dist/**"],
  },
};

export default nextConfig;
