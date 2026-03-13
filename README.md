# rombl-ai-proposal

Grounded proposal generation workspace built with TypeScript, Next.js (App Router), Convex, LangGraph.js, OpenAI, and Zod.

## Basic Setup

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

## Chrome Extension

The repo also contains a Chrome MV3 extension in `chrome-extension/`.

Useful commands:

```bash
npm run extension:build
npm run extension:watch
```

Local flow:

1. Build the extension.
2. Load `chrome-extension/dist` as an unpacked extension in Chrome.
3. Open the extension options page and set the app base URL, for example `http://localhost:3000`.
4. Visit an Upwork job page and click the extension action to open the side panel.
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
```

## `.env` vs `.env.local`

You can use either `.env` or `.env.local`.

- Recommended for local development: `.env.local`
- Why: `.env.local` is gitignored and intended for machine-specific secrets
- Good use for `.env`: shared non-secret defaults
- If the same variable exists in both files, `.env.local` should override `.env` in Next.js local development
