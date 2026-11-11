# Importing the current site

`build-manifest.mjs` reads a checkout of the current site (`yitzhach/IA-ART-Claude-Code`, pinned to the commit in the
script) and writes `src/import/manifest.json`: one entry per work, with the text its page types, the largest picture as
the source, and `mergedBecause` for every grouping decision. It also writes 800 px JPEG previews (not committed).

Re-run (offline, needs Node 22 and `npm ci`):

    node scripts/import/build-manifest.mjs --site /path/to/IA-ART-Claude-Code [--previews /tmp/claude-0/import-previews]

Grouping: dHash (9x8 greyscale), Hamming distance of 6 or less, shapes within 3 percent, and every pair in a group must
match. `drafts.json` (optional, by hand or by the assistant) holds `{ "<key>": { description, tags, collection, altText } }`.
The button that runs the import is the `/studio/import` screen; nothing here touches the database.
