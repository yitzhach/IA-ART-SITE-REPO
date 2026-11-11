# studio-site

The owner's area (`/studio`) of Isaac Anderson Art's site 3.0: a Cloudflare Worker serving a phone-first SPA in plain
TypeScript, plus `/v1/*` and `/assistant/*` forwarded to the studio platform by service bindings. Plan:
Art-Talk-Back `docs/phase-6-site.md`.

## Rules

- This repo holds no data. All reads and writes go through `/v1` (studio-api), never a database.
- The studio comes from the session, never from a request body.
- No secrets in front-end code. Never test against real client data.
- Screens live in `src/screens/`, one `render(el, params)` each; the API client is `src/api.ts`; DOM helpers `src/ui.ts`.

## Checks

`npm ci`, then `npm run format:check`, `npm run typecheck`, `npm test`, `npm run build` (CI runs the same). Config check:
`npx wrangler deploy --dry-run --outdir /tmp/sitebuild` (never a real deploy from here).

## Shipping

Claude may merge its own pull requests once tests pass and let deploys run, app before platform. Still Isaac's: secrets, spending money, deleting data or Workers, a new Worker's first deploy.
Flow, undo and per-repo setup: `docs/SHIPPING.md` (D-057).
