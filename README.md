# Bland FDE Foundation (Node/TS)

This is a production-ish demo project for a Bland inbound voice agent for **The Rive**:

- Routes calls: **Leasing** vs **Maintenance** vs **Wrong number**
- Uses **Bland inbound number + webhooks + custom tools**
- Logs **Lease Leads**, **Maintenance Tickets**, and **Call Logs** to **Google Sheets**
- Stores raw events/tool runs/calls in local **SQLite** for replay/debug

## Quickstart

1) Install deps
```bash
npm install
```

2) Create `.env`
```bash
cp .env.example .env
```

3) Configure env (minimum)

- `BLAND_API_KEY`
- `BLAND_WEBHOOK_SECRET` (Bland Dev Portal → webhook signing secret)
- `BLAND_INBOUND_NUMBER=+16507497390`
- `TOOLS_SHARED_SECRET` (random)

4) Run
```bash
npm run dev
```

## Google Sheets setup (Apps Script)

1) Run:
```bash
npm run setup:sheets
```

2) Follow the printed steps and paste `apps-script/Code.gs` into a bound Apps Script project.

3) Add to `.env`:
- `SHEETS_APPS_SCRIPT_URL`
- `SHEETS_APPS_SCRIPT_TOKEN`

Re-run `npm run setup:sheets` to validate test writes.

## Bland setup (configure inbound number + tools)

You need a public HTTPS URL so Bland can call your webhook/tool endpoints.

Local dev options:
- ngrok / cloudflared tunnel → set `PUBLIC_BASE_URL=https://...`

Then:
```bash
npm run setup:bland
```

Call your Bland number and test:
- `(650) 749-7390` (E.164: `+16507497390`)

## Endpoints

- `GET /health` — health check
- `POST /webhooks/bland` — Bland webhook (verifies `X-Webhook-Signature` if `BLAND_WEBHOOK_SECRET` is set)
- `POST /tools/log-lease-lead` — custom tool endpoint (auth via `TOOLS_SHARED_SECRET`)
- `POST /tools/log-maintenance-ticket` — custom tool endpoint (auth via `TOOLS_SHARED_SECRET`)
- `GET /debug/calls` — list stored calls
- `GET /debug/calls/:callId` — show call + events + tool runs

## Local smoke tests

Health:
```bash
curl -s localhost:3000/health
```

Webhook (no signature required unless you set `BLAND_WEBHOOK_SECRET`):
```bash
curl -s -X POST localhost:3000/webhooks/bland -H 'content-type: application/json' -d '{"type":"example"}'
```

## Replay/debug

Replay a call from SQLite:
```bash
npm run replay -- --call-id <CALL_ID>
```

## Deployment

- This repo includes a `Dockerfile` for simple deployment to any container host.
- Ensure your deployment has a stable `PUBLIC_BASE_URL` (https) and set all env vars from `.env.example`.

## Code map

- `src/rive/prompt.ts` — The Rive agent prompt
- `src/tools/routes.ts` — Tool endpoints → Sheets writes
- `src/webhooks/routes.ts` — Bland webhook ingest + signature verify
- `src/events/handlers.ts` — Event storage + call-complete processing + evals
- `src/store/sqlite.ts` — Local SQLite store for replay/debug
- `src/sheets/*` — Sheets writer (Apps Script)

## Notes

- If Sheets env vars aren’t set, writes are no-ops but events still store in SQLite (useful for local dev).
