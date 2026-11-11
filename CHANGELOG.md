# Changelog

## Unreleased

- Site 3.0 stage 2: the public site (D-116…D-123). The Worker now serves `/`, `/works`, `/works/{slug}`,
  `/commissions`, `/process`, `/about`, `/sitemap.xml`, `/robots.txt` and 301s for the old site's addresses, from
  studio-api's public routes for the studio in `STUDIO_SLUG` (staging: Isaac's). Plain TypeScript templates
  (`worker/site/`), the "Plaster" template in one file (`plaster.ts`: palette, self-hosted fonts in `public/fonts/`,
  both themes), pages readable with scripts off; three small scripts (`public/site/theme.js`, `lightbox.js`,
  `inquiry.js`: "several pieces, one inquiry"). Text / Email / Call are `sms:` / `mailto:` / `tel:` links with the
  piece written in. Edge cache keyed on the catalogue version. Tests in `tests/site/` (fake studio-api), pictures
  (`tests/site/shots.mjs`) and the gate's checks (`npm run test:site`: scripts off, no sideways scroll, budgets,
  Lighthouse mobile ≥ 95), run by CI.
- Site 3.0 stage 2 (card F): a Site screen at `/studio/site` (site name with Copy, contact details and call hours,
  time zone, the words of Home / Commissions / Process / About, and a photo picker per place that publishes a chosen
  draft after asking); an import step "words and photos" (`src/import/site.ts`) that runs once after the photos,
  marks site photos `kind: site_photo`, builds `settings.meta.site` from the old site's words and places, publishes
  the placed photos and sets the time zone to Pacific; site photos get their own chip on Works and stay out of the
  default list. The import's record keeps `siteImport.siteStep`.
- CI: if Ubuntu's mirrors can't be reached, Playwright installs Chromium without system packages.
- Stage 1 scaffold: `studio-site` Worker (`/studio` SPA, `/v1/*` to studio-api, `/assistant/*` to studio-assistant,
  `/` to `/studio` (stage 2: `/` is the public site), CSP and security headers), email-code and password sign-in, router, API client, UI helpers,
  placeholder screens, CI and tests.
- Owner screens: Works grid with filters and drafts banner, Add a work (photos, progress, assistant draft), a work
  (edit, reorder photos, approve/unpublish, redo draft, delete with undo), Review drafts. Signed picture links
  (`pictures.ts`), draft polling, shared form fields, contrast test, `npm run test:screens` (Playwright, both themes)
  and its CI step. `post()` in `api.ts` takes an optional `If-Match` version.
- Review fixes: the Worker runs first for `/studio` (security headers on the SPA HTML), CSP allows WebAssembly,
  the router starts when the app opens signed out, safer retries in Add / Review / the work screen, archived works
  are not drafts, malformed URLs are "not found", and a new cover gets its own palette.
