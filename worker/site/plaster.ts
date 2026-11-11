// The "Plaster" template (D-121): the current site's palette and fonts, both themes. Colours and fonts live here
// only (the variables at the top), so a second template is a copy of this file. Inlined into every page by layout.ts.
// Contrast (WCAG AA, checked for every text/background pair): ink, muted and accent on --bg and --card, and
// --on-accent on --accent, in both themes.
const LIGHT = `--bg:#edeae3;--card:#f5f3ee;--line:#d6cfc2;--ink:#1a1814;--muted:#5c564c;--accent:#a34a24;--on-accent:#fff;`;
const DARK = `--bg:#1b1917;--card:#24211c;--line:#3a342c;--ink:#edeae3;--muted:#a09889;--accent:#d2794a;--on-accent:#1a1814;`;
const FONTS = `--head:'Bodoni Moda','Bodoni 72',Didot,Georgia,serif;--serif:Newsreader,Georgia,'Times New Roman',serif;--body:Archivo,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;--mono:'IBM Plex Mono',ui-monospace,'SF Mono',Menlo,Consolas,monospace;`;

const face = (family: string, file: string, weight: number, style = 'normal') =>
  `@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};font-display:swap;src:url(/fonts/${file}.woff2) format('woff2')}`;

/** The files the layout preloads (used above the fold on every page). */
export const PRELOAD_FONTS = ['/fonts/bodoni-700.woff2', '/fonts/archivo-400.woff2'];

export const CSS = [
  `:root{${LIGHT}${FONTS}--gut:max(20px,env(safe-area-inset-left));color-scheme:light dark}`,
  `@media(prefers-color-scheme:dark){:root:not([data-theme=light]){${DARK}}}`,
  `:root[data-theme=dark]{${DARK}color-scheme:dark}:root[data-theme=light]{color-scheme:light}`,
  face('Bodoni Moda', 'bodoni-500', 500),
  face('Bodoni Moda', 'bodoni-700', 700),
  face('Newsreader', 'newsreader-400i', 400, 'italic'),
  face('Archivo', 'archivo-400', 400),
  face('Archivo', 'archivo-600', 600),
  face('IBM Plex Mono', 'plexmono-400', 400),
  `
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 var(--body);overflow-wrap:break-word;-webkit-font-smoothing:antialiased}
img{display:block;max-width:100%;height:auto;background:var(--card)}
a{color:var(--accent);text-underline-offset:3px}
a:hover{color:var(--ink)}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
h1,h2,h3{font-family:var(--head);font-weight:700;line-height:1.12;margin:0 0 .5em;overflow-wrap:anywhere}
h1{font-size:clamp(2rem,8.5vw,3.6rem);letter-spacing:.005em}
h2{font-size:clamp(1.5rem,5vw,2rem)}
h3{font-size:1.2rem;font-weight:500}
p,ul,ol,dl{margin:0 0 1em}
ul,ol{padding-left:1.2em}
li{margin:.2em 0}
.skip{position:absolute;left:-999px;top:0;background:var(--ink);color:var(--bg);padding:12px 16px;z-index:9}
.skip:focus{left:8px;top:8px}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.wrap,.site-hdr,.site-ftr{max-width:1240px;margin:0 auto;padding-left:var(--gut);padding-right:max(20px,env(safe-area-inset-right))}
main{display:block;padding-bottom:48px}
section{margin:0 0 56px}
.site-hdr{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:0 12px;padding-top:6px;border-bottom:1px solid var(--line)}
.site-name{display:inline-flex;align-items:center;min-height:48px;font:700 20px/1 var(--head);text-transform:uppercase;letter-spacing:.015em;color:var(--ink);text-decoration:none}
.site-hdr nav{order:3;width:100%;display:flex;flex-wrap:wrap;gap:0 20px}
.site-hdr nav a,.site-ftr nav a{display:inline-flex;align-items:center;min-height:44px;font:600 13px var(--body);letter-spacing:.02em;color:var(--ink);text-decoration:none;border-bottom:2px solid transparent}
.site-hdr nav a:hover,.site-ftr nav a:hover{border-bottom-color:var(--accent)}
.site-hdr nav a[aria-current]{border-bottom-color:var(--accent)}
.theme-switch{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;margin-right:-10px;border:0;background:none;color:var(--ink);cursor:pointer;border-radius:50%}
.theme-switch:hover{background:var(--card)}
.theme-switch[hidden]{display:none}
.eyebrow,.no,.chip,.hours,.caption{font:400 12px/1.4 var(--mono);text-transform:uppercase;letter-spacing:.12em;color:var(--muted)}
.no b{font-weight:400;color:var(--accent)}
.lede{font:italic 400 1.2rem/1.5 var(--serif);max-width:38em;margin:0 0 1em}
.tag{font:italic 400 1.3rem/1.4 var(--serif);margin:.6em 0 .4em}
.intro{padding-top:28px;padding-bottom:20px}
.intro-home{padding-top:36px}
.intro-home h1{text-transform:uppercase;font-size:clamp(2.4rem,12.8vw,5.5rem);line-height:1;margin-bottom:.15em}
.hero img{width:100%;aspect-ratio:7/6;object-fit:cover}
.hero{max-width:1240px;margin:0 auto 48px}
article.split{margin-bottom:40px}
.note{font:400 13px/1.5 var(--mono);color:var(--muted);margin:-28px 0 48px}
.btns{display:flex;flex-wrap:wrap;gap:10px;margin:1.2em 0}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 24px;background:var(--accent);color:var(--on-accent);border:1px solid var(--accent);font:600 12px var(--mono);text-transform:uppercase;letter-spacing:.08em;text-decoration:none;cursor:pointer}
.btn:hover{background:var(--ink);border-color:var(--ink);color:var(--bg)}
.btn.alt{background:none;color:var(--ink);border-color:var(--ink)}
.btn.alt:hover{background:var(--ink);color:var(--bg)}
.btn[hidden]{display:none}
.filters{display:flex;flex-wrap:wrap;gap:0 18px;margin:0 0 4px;padding:0;list-style:none}
.filters li{margin:0}
.filters a{display:inline-flex;align-items:center;min-height:44px;color:var(--ink);text-decoration:none;font:600 13px var(--body);border-bottom:2px solid transparent}
.filters a:hover,.filters a[aria-current]{border-bottom-color:var(--accent)}
.filters .lbl{font:400 12px var(--mono);text-transform:uppercase;letter-spacing:.12em;color:var(--muted);display:inline-flex;align-items:center;min-height:44px;margin-right:2px}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:28px 16px;list-style:none;margin:0 0 32px;padding:0}
.grid>li{margin:0;min-width:0}
.card{display:block;color:var(--ink);text-decoration:none}
.card img,.card .blank{width:100%;aspect-ratio:4/5;object-fit:cover}
.blank{background:var(--card)}
.card .meta{display:flex;flex-direction:column;gap:3px;padding-top:10px}
.card .ttl{font:500 1.05rem/1.25 var(--head)}
.card:hover .ttl{color:var(--accent)}
.card .sz{font-size:13px;color:var(--muted)}
.chip{display:inline-block;align-self:flex-start;margin-top:2px;padding:3px 8px;border:1px solid var(--muted);letter-spacing:.08em}
.chip.price{color:var(--ink);border-color:var(--ink)}
.more{margin:0 0 40px}
.grid.top{margin-top:20px}
.empty{margin:28px 0 48px}
.tiles{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:16px;margin-left:calc(var(--gut) * -1);margin-right:calc(var(--gut) * -1);padding:0 var(--gut) 8px;scroll-padding:0 var(--gut)}
.tiles>li{flex:0 0 78%;scroll-snap-align:start}
.tile img,.tile .blank{width:100%;aspect-ratio:4/3;object-fit:cover}
.tile .ttl{font:700 1.4rem/1.2 var(--head);margin-top:8px}
.piece{display:grid;gap:24px;padding-top:20px}
.piece-media a{display:block}
.piece-media img{width:100%}
.pics{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;list-style:none;padding:0;margin:12px 0 0}
.pics li{margin:0}
.facts{display:grid;grid-template-columns:auto 1fr;gap:6px 18px;margin:1em 0}
.facts dt{font:400 12px/1.8 var(--mono);text-transform:uppercase;letter-spacing:.12em;color:var(--muted)}
.facts dd{margin:0}
.avail{font-size:1.1rem;margin:1em 0}
.avail strong{font:500 1.5rem var(--head);margin-right:.4em}
.prevnext{display:flex;justify-content:space-between;gap:16px;margin-top:40px;padding-top:12px;border-top:1px solid var(--line)}
.prevnext a{display:inline-flex;align-items:center;min-height:44px;color:var(--ink);text-decoration:none;font-weight:600}
.prevnext a:hover{color:var(--accent)}
.prose{max-width:40em}
.prose li::marker{color:var(--accent)}
.split{display:grid;gap:20px}
.split img{width:100%;aspect-ratio:4/3;object-fit:cover}
.split.p-tall img{aspect-ratio:4/5}
.steps{list-style:none;padding:0;margin:0}
.step{display:grid;gap:14px;padding:28px 0;border-top:1px solid var(--line);margin:0}
.step .n{font:400 14px var(--mono);color:var(--accent);letter-spacing:.1em}
.step h2,.step h3{margin-bottom:.3em}
.step h2+p{font:italic 400 1.15rem/1.4 var(--serif)}
.step.nophoto{grid-template-columns:60px 1fr}
.gap{margin-top:8px}
.after{margin-top:40px}
.step img{width:100%;aspect-ratio:4/3;object-fit:cover}
.convo{background:var(--card);border:1px solid var(--line);padding:28px var(--gut) 20px;margin-left:calc(var(--gut) * -1);margin-right:calc(var(--gut) * -1)}
.convo h2{margin-bottom:.4em}
.site-ftr{border-top:1px solid var(--line);padding-top:24px;padding-bottom:max(28px,env(safe-area-inset-bottom))}
.ftr-name{font:700 16px var(--head);text-transform:uppercase;letter-spacing:.015em;margin:0 0 4px}
.ftr-contact{display:flex;flex-wrap:wrap;gap:0 18px;margin:0}
.ftr-contact a{display:inline-flex;align-items:center;min-height:44px;font-weight:600}
.hours{margin:0 0 8px;text-transform:none;letter-spacing:.04em}
.site-ftr nav{display:flex;flex-wrap:wrap;gap:0 18px}
.inq-bar{position:fixed;left:0;right:0;bottom:0;z-index:5;display:flex;flex-wrap:wrap;align-items:center;gap:4px 14px;padding:8px var(--gut) max(8px,env(safe-area-inset-bottom));background:var(--ink);color:var(--bg);font-weight:600}
.inq-bar a,.inq-bar button{display:inline-flex;align-items:center;min-height:44px;color:var(--bg);background:none;border:0;font:600 14px var(--body);text-decoration:underline;cursor:pointer;padding:0 4px}
.inq-bar button{margin-left:auto;font-weight:400}
.inq-bar[hidden]{display:none}
.lb{position:fixed;inset:0;z-index:10;display:flex;align-items:center;justify-content:center;background:rgba(10,9,8,.94);padding:56px 12px}
.lb img{max-width:100%;max-height:100%;object-fit:contain;background:none}
.lb button{position:absolute;width:48px;height:48px;border:0;border-radius:50%;background:rgba(255,255,255,.14);color:#fff;font-size:26px;cursor:pointer}
.lb .x{top:4px;right:8px}.lb .pv{left:6px;top:50%}.lb .nx{right:6px;top:50%}
.lb-open{overflow:hidden}
@media(min-width:760px){
.site-hdr nav{order:0;width:auto;margin-left:auto}
.theme-switch{order:2}
.grid{grid-template-columns:repeat(3,1fr);gap:36px 24px}
.tiles{display:grid;grid-template-columns:repeat(3,1fr);overflow:visible;margin-left:0;margin-right:0;padding:0}
.hero img{aspect-ratio:2/1}
.split{grid-template-columns:1fr 1fr;gap:40px;align-items:start}
.split.flip>:first-child{order:2}
.step{grid-template-columns:60px 1fr 1fr;gap:28px;align-items:start}
.convo{margin-left:0;margin-right:0;padding:40px}
}
@media(min-width:900px){
.piece{grid-template-columns:7fr 5fr;gap:48px;align-items:start}
.piece-info{position:sticky;top:16px}
}
@media(min-width:1100px){.grid{grid-template-columns:repeat(4,1fr)}}
@media(prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
`.replace(/\n/g, ''),
].join('\n');
