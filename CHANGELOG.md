# Changelog

## Unreleased

- Stage 4, shipping and the cart (D-146…D-154): piece pages say how each piece ships and offer Add to cart (any piece
  with a tier that isn't a quote); `/cart` keeps the cart in the browser, asks for a ZIP when a large piece needs an
  estimate, shows the studio's offer and suggestions, and sends the shipping it showed (a change is caught, not
  charged). `/buy/{slug}` now adds to the cart. Studio: Site → Shipping (prices, the offer, UPS rates) and Shipping
  tiers (accept the size's suggestions); a Shipping section on each work; Orders list every piece of a cart.
- Stage 4 (buying, D-144): a Buy button on priced, available small pieces when the studio's checkout is on; `/buy/{slug}`
  (card on Square's page, or Venmo / Zelle with name, email and address); `/thanks/{id}` (the buyer's own order, waits
  for Square's confirmation); the owner's Orders screen (Mark paid, Add tracking, More time, Cancel) and Site →
  Checkout settings.
- Leads: a visitor's own pictures showed "Couldn't load" (they have no WebP sizes, so the 480 px link was a 404). The
  picture loader now falls back to the original file.
- The Ask sheet's thank-you after a lead or hold starts with a capital ("Thank you. The artist will reply…") while the
  studio has no artist name yet.
- Site 3.0 stage 3 (cards D and F): an Ask button in every page's header and "Ask about this piece" / "Hold for 48
  hours" on a piece open a bottom sheet (loaded on a tap, `/site/ask.js`): the assistant's greeting and questions, answers
  with up to six cards (Add to inquiry), "Open these as a page" (`/p/{token}`, noindex), Ask Isaac / Send to Isaac leads,
  hold requests, Keep this chat (email code), and plain search when the chat is off or capped. `/ask` works without
  scripts (search form). `/inquiry` is the list like a cart (note, Email form with up to 5 pictures, Download as PDF, PNG or
  JPEG). Text / Call / Email everywhere open one contact sheet; the phone number is never whole in any page (two reversed
  halves assembled on a tap; `/contact` without scripts asks one question first). The Worker sets the `sv` visitor cookie
  and the `x-visitor-key` / studio / address headers for `/v1`, `/ask/chat` and `/assistant/visitor`. Tests:
  `tests/site/worker-visitor.test.ts`, `tests/site/visitor-pages.test.ts`, new checks in `npm run test:site`.
- Site 3.0 stage 3 (card E): a Leads screen at `/studio/leads` (newest first, Open or All; a lead's page with tap to
  email / text / call, the pieces, their note and pictures, and the chat it came from; Approve hold (48 hours),
  Decline and Done, each after a plain-words confirm and sent with `If-Match`), a count of new leads on the
  navigation item, and a Site screen section "Assistant" (name, greeting, three questions, reply time, monthly
  budget, on/off, the answers by topic, this month's spend). On start the app fills the assistant's starting words
  once if the studio has none (D-139; never overwrites). The import's words step now treats a site that holds only
  the assistant as having no profile yet. Tests: `tests/leads.test.ts`, `tests/assistant-defaults.test.ts`.
- Works page no longer jumps while fonts load (CI measured layout shift 0.22, Lighthouse performance 88): the
  filter rows stay on one line (they scroll sideways if a studio has many collections), and the layout preloads
  the header's Archivo 600 and Plex Mono as well.
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
