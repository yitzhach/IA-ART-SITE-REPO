# Changelog

## Unreleased

- Stage 1 scaffold: `studio-site` Worker (`/studio` SPA, `/v1/*` to studio-api, `/assistant/*` to studio-assistant,
  `/` to `/studio`, CSP and security headers), email-code and password sign-in, router, API client, UI helpers,
  placeholder screens, CI and tests.
- Owner screens: Works grid with filters and drafts banner, Add a work (photos, progress, assistant draft), a work
  (edit, reorder photos, approve/unpublish, redo draft, delete with undo), Review drafts. Signed picture links
  (`pictures.ts`), draft polling, shared form fields, contrast test, `npm run test:screens` (Playwright, both themes)
  and its CI step. `post()` in `api.ts` takes an optional `If-Match` version.
