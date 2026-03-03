# rombl-ai-proposal

RAG-based proposal generation MVP built with TypeScript, Next.js (App Router), Convex, LangGraph.js, OpenAI, and Zod.

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

## Useful Commands

```bash
npm test
npm run build
npm start
```

## `.env` vs `.env.local`

You can use either `.env` or `.env.local`.

- Recommended for local development: `.env.local`
- Why: `.env.local` is gitignored and intended for machine-specific secrets
- Good use for `.env`: shared non-secret defaults
- If the same variable exists in both files, `.env.local` should override `.env` in Next.js local development
