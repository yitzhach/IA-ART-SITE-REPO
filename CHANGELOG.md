# Changelog

## Unreleased

- CI: if Ubuntu's mirrors can't be reached, Playwright installs Chromium without system packages.
- Stage 1 scaffold: `studio-site` Worker (`/studio` SPA, `/v1/*` to studio-api, `/assistant/*` to studio-assistant,
  `/` to `/studio`, CSP and security headers), email-code and password sign-in, router, API client, UI helpers,
  placeholder screens, CI and tests.
- Owner screens: Works grid with filters and drafts banner, Add a work (photos, progress, assistant draft), a work
  (edit, reorder photos, approve/unpublish, redo draft, delete with undo), Review drafts. Signed picture links
  (`pictures.ts`), draft polling, shared form fields, contrast test, `npm run test:screens` (Playwright, both themes)
  and its CI step. `post()` in `api.ts` takes an optional `If-Match` version.
- Review fixes: the Worker runs first for `/studio` (security headers on the SPA HTML), CSP allows WebAssembly,
  the router starts when the app opens signed out, safer retries in Add / Review / the work screen, archived works
  are not drafts, malformed URLs are "not found", and a new cover gets its own palette.
