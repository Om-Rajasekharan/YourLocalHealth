# Native Risk Kernel

This folder contains a small C++ scoring kernel for MyLocalHealth. It mirrors
the app's transparent risk-index idea in a portable native module.

It is not used by the deployed Next.js app yet. For now, it is useful for:

- demonstrating that the scoring logic can be separated from the UI
- testing weighted risk calculations outside the browser
- future WebAssembly or backend integration

## Build

```bash
clang++ -std=c++17 -O2 -Wall -Wextra native/risk_kernel.cpp -o /tmp/mylocalhealth-risk
```

## Run

```bash
/tmp/mylocalhealth-risk \
  --aqi 72 \
  --heat 61 \
  --uv 55 \
  --pollen 44 \
  --illness 38 \
  --equity 52 \
  --chronic 48 \
  --profile 12 \
  --forecast 67
```

The output is compact JSON:

```json
{"score":56,"level":"Moderate","dominant":"forecast","confidence":100}
```

## Notes

Scores are normalized to `0..100`. The kernel is informational only and is not
a clinical model.
