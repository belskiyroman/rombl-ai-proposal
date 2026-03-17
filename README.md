# rombl-ai-proposal

Grounded proposal generation workspace built with TypeScript, Next.js (App Router), Convex, LangGraph.js, OpenAI, and Zod.

## Basic Setup

The default local profile in this repo still targets Convex Cloud through `.env.local`.
The self-hosted staging profile is isolated in `.env.selfhosted` so rollback stays env-only.

## Convex Cloud Setup (current default)

1. Install dependencies:

```bash
npm install
```

2. Create your env file from the example:

```bash
cp .env.example .env.local
```

3. Fill in required values in `.env.local`:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional, defaults to `gpt-5-mini`)
- `CONVEX_DEPLOYMENT`
- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CONVEX_SITE_URL`

4. Start Convex (terminal 1):

```bash
npx convex dev
```

5. Start Next.js (terminal 2):

```bash
npm run dev
```

6. Open:

- App: <http://localhost:3000>
- Health check: <http://localhost:3000/api/health>

## Self-Hosted Convex Staging

Self-hosted staging runs a minimal Convex backend + Postgres stack via Docker Compose.
The app and Chrome extension stay outside Docker and point to the local backend on `127.0.0.1`.

1. Copy the staging env template:

```bash
cp .env.selfhosted.example .env.selfhosted
```

2. Fill `POSTGRES_PASSWORD`, `INSTANCE_SECRET`, and any OpenAI values you need for generation.

3. Start the self-hosted staging stack:

```bash
npm run selfhosted:up
```

4. Confirm the backend is reachable:

```bash
curl http://127.0.0.1:3210/version
```

5. Generate the self-hosted admin key and paste it into `.env.selfhosted`:

```bash
npm run selfhosted:admin-key
```

6. Push the current Convex schema/functions to the self-hosted backend:

```bash
npm run convex:selfhosted:push
```

7. Set self-hosted Convex action secrets:

```bash
npm run convex:selfhosted:env:sync
```

8. Run the app against the self-hosted staging backend:

```bash
npm run dev:selfhosted
```

9. Clone the current cloud data into staging:

```bash
mkdir -p backups
npx convex export --path backups/convex-cloud-$(date +%Y%m%d-%H%M%S).zip
npm run convex:selfhosted:import -- backups/your-export.zip --replace-all --yes
```

10. Seed the default local candidate profile:

```bash
npm run seed:candidates:selfhosted
```

Detailed staging runbook and smoke checklist:

- [docs/selfhosted-staging.md](docs/selfhosted-staging.md)

## Chrome Extension

The repo also contains a Chrome MV3 extension in `chrome-extension/`.

Useful commands:

```bash
npm run extension:build
npm run extension:watch
npm run seed:candidates:selfhosted
```

Local flow:

1. Build the extension.
2. Load `chrome-extension/dist` as an unpacked extension in Chrome.
3. Open the extension options page and set the app base URL, for example `http://localhost:3000`.
4. Visit an Upwork Submit Proposal page and click the extension action to open the side panel.
5. Review the parsed job, choose a candidate, and run generation directly in the side panel.

Primary extension flow:

- `GET /api/extension/candidates`
- `POST /api/extension/generate`
- `GET /api/extension/generate/status?id=...`

Fallback/manual tooling still exists through `POST /api/extension/handoffs` and `/generate?handoff=...`.

## Useful Commands

```bash
npm test
npm run build
npm run extension:build
npm start
npm run selfhosted:up
npm run convex:selfhosted:push
npm run dev:selfhosted
```

## `.env` vs `.env.local`

You can use either `.env` or `.env.local`.

- Recommended for local development: `.env.local`
- Why: `.env.local` is gitignored and intended for machine-specific secrets
- Good use for `.env`: shared non-secret defaults
- If the same variable exists in both files, `.env.local` should override `.env` in Next.js local development
