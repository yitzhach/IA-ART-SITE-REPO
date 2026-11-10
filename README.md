# Studio Site

The public studio site engine for Isaac Anderson Art, and later for other artists, galleries and
art shows. Working name **Studio Site** (Art-Talk-Back D-102).

- **This repo:** `yitzhach/IA-ART-SITE-REPO`. The build brief calls it `studio-site`; that stays
  the name of the Workers: `studio-site` (production) and `studio-site-staging`.
- **Build brief:** [Art-Talk-Back `docs/phase-6-site.md`](https://github.com/yitzhach/Art-Talk-Back/blob/HEAD/docs/phase-6-site.md).
  One stage per session; a stage ships only when its gate passes.
- **Data and AI live on the studio platform** ([`yitzhach/Art-Talk-Back`](https://github.com/yitzhach/Art-Talk-Back)):
  this Worker holds no data. It reaches `studio-api` and `studio-assistant` through service
  bindings, and the studio always comes from the platform, never from a request body (D-097).

## What is here (stage 1: the catalogue)

The owner's area, `/studio`: sign in with the studio's email code, see every work, add one from the
phone's camera, read the assistant's draft, approve and publish. The public pages come in stage 2.

## How it ships

Same branch name here and in Art-Talk-Back for a change that spans both (D-056). The platform
merges first when the site needs a new contract. Staging (`studio-site-staging`) is deployed by
Art-Talk-Back's **Deploy staging** workflow. See Art-Talk-Back `docs/SHIPPING.md`.
