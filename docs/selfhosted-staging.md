# Self-Hosted Convex Staging Runbook

This repo keeps the current Convex Cloud profile as the default path in `.env.local`.
The self-hosted staging path lives beside it in `.env.selfhosted`.

## Files

- `docker-compose.selfhosted.yml`
- `.env.selfhosted.example`

## 1. Prepare the staging VM

Install Docker Engine and Docker Compose on a Linux VM or local machine.
This profile publishes the self-hosted Convex backend directly on localhost:

- `127.0.0.1:3210`
- `127.0.0.1:3211`

## 2. Create the self-hosted env file

```bash
cp .env.selfhosted.example .env.selfhosted
```

Set at minimum:

- `POSTGRES_PASSWORD`
- `INSTANCE_SECRET`

Generate `INSTANCE_SECRET` with:

```bash
openssl rand -hex 32
```

## 3. Start the self-hosted stack

```bash
npm run selfhosted:up
```

Check logs:

```bash
npm run selfhosted:logs
```

## 4. Generate the self-hosted admin key

```bash
npm run selfhosted:admin-key
```

Paste the generated key into `CONVEX_SELF_HOSTED_ADMIN_KEY` inside `.env.selfhosted`.

## 5. Push the current Convex schema and functions

```bash
npm run convex:selfhosted:push
```

Use the watch mode during staging development:

```bash
npm run convex:selfhosted:dev
```

## 6. Set staging secrets inside the self-hosted Convex deployment

The proposal engine depends on these Convex action env vars:

```bash
npm run convex:selfhosted:env:sync
```

Verify them:

```bash
npm run convex:selfhosted:env:list
```

## 7. Clone the current Convex Cloud data into staging

Export from the existing cloud deployment first. If your current cloud profile is still in `.env.local`, this uses it by default:

```bash
mkdir -p backups
npx convex export --path backups/convex-cloud-$(date +%Y%m%d-%H%M%S).zip
```

Import into the self-hosted staging deployment:

```bash
npm run convex:selfhosted:import -- backups/your-export.zip --replace-all --yes
```

For the first pass, import only into an empty or disposable staging deployment.

## 8. Run the app against self-hosted staging

Use the dedicated self-hosted app profile:

```bash
npm run dev:selfhosted
```

You can also build or start against the self-hosted profile:

```bash
npm run build:selfhosted
npm run start:selfhosted
```

The extension should keep pointing at the same app host you are testing, for example `http://localhost:3000` in local development.

The app itself should use these runtime values from `.env.selfhosted`:

- `NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210`
- `NEXT_PUBLIC_CONVEX_SITE_URL=http://127.0.0.1:3211`

## 9. Seed the default local candidate profile

After any optional `convex import --replace-all` step, load the checked-in candidate seed:

```bash
npm run seed:candidates:selfhosted
```

## 10. Smoke checklist

- `curl http://127.0.0.1:3210/version` returns a backend version response.
- Candidate `1 / Yurii Shepitko` appears in `/ingest` and `/generate`.
- App loads successfully against the self-hosted backend.
- Candidate profile create/update/delete works.
- Candidate evidence ingest works.
- Historical case ingest works.
- Proposal generation completes successfully.
- Saved run history and run detail load correctly.
- Extension handoff flow works.
- Extension-native generation works.
- Retrieval still returns vector-search results.
- Background generation / scheduler path completes normally.

## 11. Rollback

Rollback is env-only:

- stop using `.env.selfhosted`
- go back to the existing cloud-backed `.env.local`
- run the default commands again:

```bash
npm run dev
npx convex dev
```

No code-path rollback is required for this repo.
