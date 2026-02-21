# OpenClaw Dashboard (Lit)

Lightweight Lit + Vite dashboard for the OpenClaw gateway. Overview and Chat views with WebSocket connection to the gateway.

## Run

```bash
pnpm dashboard-lit:dev
```

Open http://localhost:5174 (or the port Vite prints).

## Build

```bash
pnpm dashboard-lit:build
```

Output in `packages/dashboard-lit/dist/`.

## Env

- `VITE_GATEWAY_URL` – WebSocket URL (default: `ws://127.0.0.1:18789`)
- `OPENCLAW_CONTROL_UI_BASE_PATH` – Base path for deployment (e.g. `/dashboard`)
