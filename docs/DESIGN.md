# Studio Site design system

The written system behind the public site's look ("Gallery wall, lighter", chosen by Isaac from three trials).
Every value used by `worker/site/plaster.ts` is in this file; a new value goes here first.

Reference sites: none given.

## Colours

Decided by Isaac (D-121) and unchanged. The only additions are the band and photo tokens, derived from the two
existing themes.

| Token | Light theme | Dark theme | Used for |
|---|---|---|---|
| `--bg` | `#edeae3` paper | `#1b1917` | page background |
| `--card` | `#f5f3ee` | `#24211c` | picture placeholder, hover fill |
| `--line` | `#d6cfc2` | `#3a342c` | hairlines |
| `--ink` | `#1a1814` | `#edeae3` | text, heavy rules, outline buttons |
| `--muted` | `#5c564c` | `#a09889` | labels, secondary text |
| `--accent` | `#a34a24` rust | `#d2794a` | links, index numbers, first button |
| `--on-accent` | `#ffffff` | `#1a1814` | text on the first button |
| `--band` | `#1a1814` (the light theme's ink) | `#0f0e0c` (deeper than the page, so it still reads as a band) | dark band background |
| `--band-line` | `#3a342c` | `#2e2a24` | hairlines inside a band |
| `--band-card` | `#24211c` | `#1b1917` | placeholder inside a band |
| `--band-fg` | `#edeae3` | same | text inside a band |
| `--band-muted` | `#a09889` | same | labels inside a band |
| `--band-accent` | `#d2794a` | same | links and first button inside a band |
| `--band-on-accent` | `#1a1814` | same | text on the first button inside a band |
| `--photo-fg` | `#f5f3ee` | same | text set on a picture |
| `--photo-line` | `rgb(245 243 238 / .3)` | same | hairline and button fill on a picture |
| `--scrim` | `rgb(16 15 13 / α)` | same | the picture scrim (the only gradient) |

A band (`.band`, the closing block, the hero, the header when it sits on the hero) works by redefining the
template's own variables (`--bg`, `--ink`, `--muted`, `--line`, `--accent`, `--on-accent`, `--card`), so every
component inside it keeps working without its own dark rules.

Contrast (WCAG AA, 4.5:1 for text, 3:1 for large text): ink, muted and accent on paper and on card in both
themes (as today); band text, band muted and band accent on both band colours; band-on-accent on band accent.
Text on pictures sits on the scrim: at least 64% scrim under small text (the header links, the tagline, room
lines) and at least 50% under large text (the name, room titles), which holds 4.5:1 and 3:1 even on a white
photo.

## Type

Four families, self-hosted in `public/fonts/` (unchanged):

| Family | Weights | Used for |
|---|---|---|
| Bodoni Moda | 500, 700 | headings, names, work titles, prices |
| Newsreader | 400 italic | taglines, statements, ledes |
| Archivo | 400, 600 | body text, links, navigation |
| IBM Plex Mono | 400 (600 synthesised on buttons, as today) | numbers, labels, buttons, facts |

One scale. Fixed steps:

| Step | Size | Where |
|---|---|---|
| xs | 12 px | everything in Plex Mono: labels, eyebrows, index numbers, chips, buttons, facts, hours, notes, version line |
| sm | 14 px | header and footer links, filter links, size lines, the line on a room picture, spec-sheet line |
| md | 16 px | body text; footer name (Bodoni 700 capitals) |
| lg | 18 px (1.125 rem) | work titles on the wall (Bodoni 500); the availability line |
| xl | 20 px (1.25 rem) | the site name in the header (Bodoni 700 capitals); a step's opening line (Newsreader italic) |
| 2xl | 24 px (1.5 rem) | titles on room pictures (Bodoni 700); the price (Bodoni 500); lightbox arrows |

Fluid steps (they grow with the screen):

| Step | Size | Where |
|---|---|---|
| d1 | `clamp(1.25rem, 2.4vw, 1.875rem)` 20 → 30 px | tagline and ledes (Newsreader italic); h3, the object headings (Bodoni 500) |
| d2 | `clamp(1.5rem, 3.6vw, 2.75rem)` 24 → 44 px | the statement under the hero (Newsreader italic); collection names; previous / next work (Bodoni 700) |
| d3 | `clamp(1.75rem, 4vw, 2.75rem)` 28 → 44 px | h2, section headings |
| d4 | `clamp(2.25rem, 6vw, 4rem)` 36 → 64 px | h1 on Works, a piece, and the text pages |
| d5 | `clamp(2.5rem, 7.2vw, 5.75rem)` 40 → 92 px | the closing heading ("Start a conversation"), never broken mid-word |
| name | sized to the content width: `138.6cqw ÷ letters in the name` on one line from 760 px (at most 16cqw); `123cqw ÷ letters in the longest word` on phones (at most 24cqw) | the studio name on the hero |

Line heights: 1.6 body; 1.5 mono; 1.4 ledes; 1.3 tagline; 1.25 statement and work titles; 1.2 h3 and room
titles; 1.1 collection names and previous / next; 1.05 headings; 0.95 closing heading; 0.88 hero name.
Letter spacing: 0.12em labels; 0.08em buttons, chips, facts; 0.04em hours; 0.02em navigation; 0.015em the
name in capitals; −0.01em the hero name.

## Spacing

One set only: **4, 8, 12, 16, 24, 32, 48, 64, 96 px**. Every margin, padding and gap in the template
is one of these.

Section rhythm: 64 px above and below each section on phones, 96 px from 900 px (`--sec`).

Deliberate exceptions:

- Page gutter: 20 px on phones (kept from the current template and the mock-up; `ask.css`, `wall.css` and
  `collector.css` read the same `--gut`), 48 px from 900 px. Never less than the device's safe area.
- The hero has no padding: the picture runs edge to edge and the words sit on its foot, 24 px up (32 px from 760 px).
- "The work, closely" pictures have no gutter on their outer side.
- Under the works wall the gap is 32 px (48 px from 760 px), not a section gap, so the "See all" button stays with the wall.
- "Seen in" hangs 48 px under the rooms with a hairline, inside the rooms section.
- The closing band (or a piece's "More works" band) runs straight into the footer band with no gap.

Sizes that are not spacing: tap targets 44 px (links, Ask, the theme switch) and 48 px (buttons, the site
name, lightbox buttons); content width 1320 px; hero picture 4:5 on phones, 16:9 from 760 px, at most 760 px
tall; scrim stops at the header's height (112 px on phones, 64 px from 760 px) plus 48 px; extra pictures on a
piece page 128 px tall; the filters' label column 96 px; text measures 24em (statement), 32em (ledes, object words), 40em (prose).

Breakpoints: 760 px and 900 px. Nothing else.

## Shape and rules

- Corner radius 0 everywhere (the theme switch and lightbox buttons lose their round shape).
- No shadows.
- Hairline: 1 px `--line`. Heavy rule: 2 px, used under the current navigation or filter link and for the focus ring (`--accent`, 4 px offset).
- Artworks are shown at their true shape, never cropped. Only atmosphere pictures (the hero) are cropped.

## Motion

One moment; nothing else moves. CSS only (no script, no library). The resting state is always fully visible.
Under `prefers-reduced-motion: reduce` every animation and transition is off.

The hero cross-fades through its `home.hero` photos (up to five): 7 s each, a 1.5 s fade, linear, looping. With
scripts off (`@media (scripting: none)`), under reduced motion, or with one photo, the first photo stays.

## Forbidden

- No Inter or Roboto (Roboto is removed from the body font's fallback list too).
- No purple or indigo. No gradients as decoration: the picture scrim is the only gradient.
- No centred hero with one button.
- No row of three equal cards or tiles.
- No drop shadows.
- No rounded corners.
- No all-white or light-grey page.
- No cropping of an artwork.
- No motion beyond the hero cross-fade.
- No value that is not in this file.
- No numbered markers except the site's existing index numbers ("No. 01"). The step numbers already on
  Commissions and Process are the studio's existing content and stay as they are.

Two technical notes, so a reviewer does not read them as breaking a rule: the closing band's colour is carried
past the page gutter with `border-image` (a solid colour written as a gradient function, because that is the
only way CSS takes a colour there), and nothing uses `box-shadow`.
