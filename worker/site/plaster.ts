// The "Plaster" template (D-121): the current site's palette and fonts, both themes. Colours and fonts live here
// only (the variables at the top), so a second template is a copy of this file. Inlined into every page by layout.ts.
// Contrast (WCAG AA, checked for every text/background pair): ink, muted and accent on --bg and --card, and
// --on-accent on --accent, in both themes.
// "Gallery wall, lighter": the scales and rules are written down in docs/DESIGN.md; a new value goes there first.
// Band tokens: a dark band redefines the template's own variables (.band), so every component keeps working.
const LIGHT = `--bg:#edeae3;--card:#f5f3ee;--line:#d6cfc2;--ink:#1a1814;--muted:#5c564c;--accent:#a34a24;--on-accent:#fff;--band:#1a1814;--band-line:#3a342c;--band-card:#24211c;`;
const DARK = `--bg:#1b1917;--card:#24211c;--line:#3a342c;--ink:#edeae3;--muted:#a09889;--accent:#d2794a;--on-accent:#1a1814;--band:#0f0e0c;--band-line:#2e2a24;--band-card:#1b1917;`;
const BAND = `--band-fg:#edeae3;--band-muted:#a09889;--band-accent:#d2794a;--band-on-accent:#1a1814;--photo-fg:#f5f3ee;--photo-line:rgb(245 243 238/.3);--scrim:16 15 13;`;
const SCALE = `--d1:clamp(1.25rem,2.4vw,1.875rem);--d2:clamp(1.5rem,3.6vw,2.75rem);--d3:clamp(1.75rem,4vw,2.75rem);--d4:clamp(2.25rem,6vw,4rem);--d5:clamp(2.5rem,7.2vw,5.75rem);--sec:64px;--hdr:112px;`;
const FONTS = `--head:'Bodoni Moda','Bodoni 72',Didot,Georgia,serif;--serif:Newsreader,Georgia,'Times New Roman',serif;--body:Archivo,system-ui,-apple-system,'Segoe UI',Arial,sans-serif;--mono:'IBM Plex Mono',ui-monospace,'SF Mono',Menlo,Consolas,monospace;`;

const face = (family: string, file: string, weight: number, style = 'normal') =>
  `@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};font-display:swap;src:url(/fonts/${file}.woff2) format('woff2')}`;

/** The files the layout preloads: every face used above the fold on every page (headings, body, the header's
 * links in Archivo 600, eyebrows and labels in Plex Mono). A face that arrives late swaps in at a different width,
 * rewraps a row (Works' filters) and moves the page under it: CI measured that as layout shift. */
export const PRELOAD_FONTS = [
  '/fonts/bodoni-700.woff2',
  '/fonts/archivo-400.woff2',
  '/fonts/archivo-600.woff2',
  '/fonts/plexmono-400.woff2',
];

/** The one motion: the hero cross-fades through its photos, CSS only: 7 s each, a 1.5 s fade. The first photo
 * is the still base; each later one fades in over it, and the last fades out to show the first again. */
const HOLD = 7;
const FADE = 1.5;
const pc = (v: number) => `${Math.round(v * 100) / 100}%`;
const crossfade = [2, 3, 4, 5]
  .map(n => {
    const t = n * HOLD;
    const f = (FADE / t) * 100;
    const s = 100 / n;
    const mid = `@keyframes x${n}m{0%{opacity:0}${pc(f)},${pc(s + f)}{opacity:1}${pc(s + f + 0.01)},to{opacity:0}}`;
    const last = `@keyframes x${n}l{0%{opacity:0}${pc(f)},${pc(s)}{opacity:1}${pc(s + f)},to{opacity:0}}`;
    return `${n > 2 ? mid : ''}${last}.xf-${n} img+img{animation:x${n}m ${t}s linear infinite backwards}.xf-${n} img:last-child{animation-name:x${n}l}`;
  })
  .concat([3, 4, 5].map(k => `.xf img:nth-child(${k}){animation-delay:${(k - 1) * HOLD}s}`))
  .concat(`.xf img:nth-child(2){animation-delay:${HOLD}s}@media(scripting:none){.xf img+img{animation:none}}`)
  .join('');

export const CSS = [
  `:root{${LIGHT}${BAND}${SCALE}${FONTS}--gut:max(20px,env(safe-area-inset-left));--gur:max(20px,env(safe-area-inset-right));color-scheme:light dark}`,
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
body{position:relative;margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 var(--body);overflow-wrap:break-word;-webkit-font-smoothing:antialiased}
img{display:block;max-width:100%;height:auto;background:var(--card)}
a{color:var(--accent);text-underline-offset:4px}
a:hover{color:var(--ink)}
:focus-visible{outline:2px solid var(--accent);outline-offset:4px}
h1,h2,h3{font-family:var(--head);font-weight:700;line-height:1.05;margin:0 0 16px;text-wrap:balance}
h1{font-size:var(--d4)}
h2{font-size:var(--d3)}
h3{font-size:var(--d1);font-weight:500;line-height:1.2}
p,ul,ol,dl{margin:0 0 16px}
ul,ol{padding-left:24px}
li{margin:4px 0}
.skip{position:absolute;left:-999px;top:0;background:var(--ink);color:var(--bg);padding:12px 16px;z-index:9}
.skip:focus{left:8px;top:8px}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.wrap,.site-hdr{max-width:1320px;margin:0 auto;padding-left:var(--gut);padding-right:var(--gur)}
main{display:block;padding-bottom:var(--sec)}
section{margin:0 0 var(--sec)}
.sec{margin:0;padding-block:var(--sec)}
.rule,.ruled{padding-top:0}
.rule::before{content:"";display:block;margin-bottom:var(--sec);border-top:1px solid var(--line)}

.band,.convo,.site-hdr.over,.hero{--bg:var(--band);--ink:var(--band-fg);--muted:var(--band-muted);--line:var(--band-line);--accent:var(--band-accent);--on-accent:var(--band-on-accent);--card:var(--band-card);background:var(--bg);color:var(--ink)}
.site-hdr{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:0 16px;padding-top:8px;border-bottom:1px solid var(--line)}
.site-hdr.over{position:absolute;inset:0 0 auto;z-index:2;--ink:var(--photo-fg);--line:var(--photo-line);--card:var(--photo-line);background:none}
.site-name{display:inline-flex;align-items:center;min-height:48px;font:700 20px/1 var(--head);text-transform:uppercase;letter-spacing:.015em;color:var(--ink);text-decoration:none}
.site-hdr nav{order:3;width:100%;display:flex;flex-wrap:wrap;gap:0 24px}
.site-hdr nav a,.site-ftr nav a{display:inline-flex;align-items:center;min-height:44px;font:600 14px var(--body);letter-spacing:.02em;color:var(--ink);text-decoration:none;border-bottom:2px solid transparent}
.site-hdr nav a:hover,.site-ftr nav a:hover,.site-hdr nav a[aria-current]{border-bottom-color:var(--accent)}
.theme-switch{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;margin-right:-12px;border:0;background:none;color:var(--ink);cursor:pointer}
.theme-switch:hover{background:var(--card)}
.theme-switch[hidden]{display:none}
.hdr-tools{display:flex;align-items:center;gap:8px}
.ask-btn{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border:1px solid var(--ink);color:var(--ink);font:600 12px var(--mono);text-transform:uppercase;letter-spacing:.08em;text-decoration:none}
.ask-btn:hover{background:var(--ink);color:var(--bg)}
.eyebrow,.no,.chip,.hours,.caption,.note,.proof h2,.proof .prose,.obj-txt li{font:400 12px/1.5 var(--mono);text-transform:uppercase;letter-spacing:.12em;color:var(--muted)}
.no b{font-weight:400;color:var(--accent)}
.lede{font:italic 400 var(--d1)/1.4 var(--serif);max-width:32em;margin:0 0 16px}
.tag{font:italic 400 var(--d1)/1.3 var(--serif);margin:12px 0 0}
.intro{padding-block:32px 24px}
.hero{position:relative;overflow:hidden;margin:0;--ink:var(--photo-fg);--line:var(--photo-line)}
.hero-img{aspect-ratio:4/5;max-height:760px;overflow:hidden}
.hero-img img{width:100%;height:100%;object-fit:cover;background:none}
.xf img+img{position:absolute;inset:0;opacity:0}
.hero-img~.hero-txt{position:absolute;inset:auto 0 0;z-index:1;padding-block:0 24px}
.hero-img::after{content:"";position:absolute;inset:0;background:linear-gradient(to bottom,rgb(var(--scrim)/.64) var(--hdr),rgb(var(--scrim)/0) calc(var(--hdr) + 48px),rgb(var(--scrim)/0) 40%,rgb(var(--scrim)/.5) 64%,rgb(var(--scrim)/.88))}
.hero-txt{padding-block:var(--sec) 24px}
.hero-title{container-type:inline-size}
.hero h1{font-size:min(calc(123cqw / var(--w,8)),24cqw);line-height:.88;text-transform:uppercase;letter-spacing:-.01em;margin:0;overflow-wrap:normal}
.big{font:italic 400 var(--d2)/1.25 var(--serif);max-width:24em;margin:0;text-wrap:balance}
.note{margin:24px 0 0}
.sec-head{display:grid;gap:12px;margin-bottom:32px}
.sec-head>*,.sec-head p:last-child,.convo h2,.convo p:last-child,.obj-txt>*,.proof *{margin:0}
.sec-head .prose{color:var(--muted)}
.btns{display:flex;flex-wrap:wrap;gap:12px;margin:24px 0}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 24px;background:var(--accent);color:var(--on-accent);border:1px solid var(--accent);font:600 12px var(--mono);text-transform:uppercase;letter-spacing:.08em;text-decoration:none;cursor:pointer}
.btn:hover{background:var(--ink);border-color:var(--ink);color:var(--bg)}
.btn.alt{background:none;color:var(--ink);border-color:var(--ink)}
.btn.alt:hover{background:var(--ink);color:var(--bg)}
.btn[hidden]{display:none}
.filters{display:flex;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;gap:0 24px;margin:0;padding:0;list-style:none;border-top:1px solid var(--line)}
.filters li{margin:0;flex:none}
.filters a{display:inline-flex;align-items:center;min-height:44px;color:var(--ink);text-decoration:none;font:600 14px var(--body);border-bottom:2px solid transparent}
.filters a:hover,.filters a[aria-current]{border-bottom-color:var(--accent)}
.filters .lbl{font:400 12px var(--mono);text-transform:uppercase;letter-spacing:.12em;color:var(--muted);display:inline-flex;align-items:center;min-height:44px;min-width:96px}
.wall,.grid{columns:2;column-gap:16px;list-style:none;margin:0;padding:0}
.wall>li,.grid>li{break-inside:avoid;margin:0;padding-bottom:32px}
.card{display:block;color:var(--ink);text-decoration:none}
.card img,.card .blank,.obj img,.rooms img,.split img,.step img{width:100%}
.blank{aspect-ratio:4/5;background:var(--card)}
.card .meta{display:grid;gap:4px;padding-top:12px}
.card .ttl{font:500 1.125rem/1.25 var(--head)}
.card:hover .ttl,.prevnext a:hover{color:var(--accent)}
.card .sz,.ov .sz,.spec-link{font-size:14px;color:var(--muted)}
.chip{display:inline-block;justify-self:start;margin-top:4px;padding:4px 8px;border:1px solid var(--muted);letter-spacing:.08em}
.chip.price{color:var(--ink);border-color:var(--ink)}
.more{margin:0}
.grid.top,.wall.top{margin-top:32px}
.empty{margin:32px 0 48px}
.salon{display:grid;grid-template-columns:repeat(2,1fr);gap:32px 16px;align-items:start;list-style:none;margin:0;padding:0}
.salon>li{margin:0;min-width:0}
.salon>li:first-child{grid-column:1/-1}
.salon>li:nth-child(3){margin-top:48px}
.salon .no{display:block;margin-top:12px}
.salon .ttl{display:block;font:700 var(--d2)/1.1 var(--head)}
.obj{display:grid}
.obj+.obj{margin-top:48px}
.obj-txt{display:grid;gap:16px;align-content:center;padding:24px var(--gur) 24px var(--gut)}
.obj-txt>*{max-width:32em}
.obj-txt ul{list-style:none;padding:0}
.obj-txt li{padding-block:8px;border-top:1px solid var(--line);letter-spacing:.08em}
.rooms{display:flex;flex-wrap:wrap;gap:16px;list-style:none;margin:0;padding:0}
.rooms>li{flex:var(--r,.8) 1 0;min-width:0;margin:0}
.rooms>li:nth-child(3){flex-basis:100%}
.rooms a{position:relative;display:block;color:var(--photo-fg);text-decoration:none}
.ov{position:absolute;inset:auto 0 0;display:grid;gap:4px;padding:64px 16px 12px;background:linear-gradient(to top,rgb(var(--scrim)/.84),rgb(var(--scrim)/.64) 56%,rgb(var(--scrim)/0))}
.ov .ttl{font:700 1.5rem/1.2 var(--head)}
.ov .sz{color:inherit}
.proof,.proof ul{display:flex;flex-wrap:wrap;gap:8px 24px;list-style:none;padding:0}
.proof{margin:48px 0 0;padding-top:16px;border-top:1px solid var(--line)}
.proof h2{color:var(--accent)}
.piece{display:grid;gap:24px;padding-top:24px}
.piece-media a{display:block}
.piece-media img{width:100%}
.pics{display:flex;flex-wrap:wrap;gap:12px;list-style:none;padding:0;margin:12px 0 0}
.pics li{margin:0}
.pics img{width:auto;height:128px}
.facts{display:grid;grid-template-columns:auto 1fr;gap:0 24px;margin:24px 0;border-bottom:1px solid var(--line)}
.facts dt,.facts dd{margin:0;padding-block:8px;border-top:1px solid var(--line)}
.facts dt{font:400 12px/2 var(--mono);text-transform:uppercase;letter-spacing:.12em;color:var(--muted)}
.avail{font-size:1.125rem;margin:16px 0}
.avail strong{font:500 1.5rem var(--head);margin-right:8px}
.endband{margin:var(--sec) 0 calc(var(--sec) * -1);padding-block:48px}
.prevnext{display:flex;justify-content:space-between;gap:24px}
.prevnext a{display:inline-flex;align-items:center;min-height:44px;color:var(--ink);text-decoration:none;font:700 var(--d2)/1.1 var(--head)}
.prevnext a[rel=next]{text-align:right}
.prose{max-width:40em}
.prose li::marker{color:var(--accent)}
.split{display:grid;gap:24px}
.steps{list-style:none;padding:0;margin:0}
.step{display:grid;gap:16px;padding:32px 0;border-top:1px solid var(--line);margin:0}
.step .n{font:400 12px/2 var(--mono);color:var(--accent);letter-spacing:.12em}
.step h2,.step h3{margin-bottom:8px}
.step h2+p{font:italic 400 1.25rem/1.4 var(--serif)}
.step.nophoto{grid-template-columns:64px 1fr}
.gap{margin-top:8px}
.after{margin-top:48px}
.convo{display:grid;gap:24px;margin:0 0 calc(var(--sec) * -1);padding-block:var(--sec);border-image:linear-gradient(var(--band),var(--band)) fill 0/0/0 100vmax}
.convo h2{font-size:var(--d5);line-height:.95;overflow-wrap:normal}
.convo-txt{display:grid;gap:16px}
.convo .btns{margin:0}
.site-ftr{border-top:1px solid var(--line);padding-block:24px max(48px,env(safe-area-inset-bottom))}
.ftr-name{font:700 16px var(--head);text-transform:uppercase;letter-spacing:.015em;margin:0 0 4px}
.ftr-contact{display:flex;flex-wrap:wrap;gap:0 24px;margin:0}
.ftr-contact a{display:inline-flex;align-items:center;min-height:44px;font-weight:600}
.hours{margin:0 0 8px;text-transform:none;letter-spacing:.04em}
.site-ftr nav{display:flex;flex-wrap:wrap;gap:0 24px}
.ftr-follow{margin:8px 0 0}
.ftr-ver{margin:12px 0 0;font:400 12px var(--mono);color:var(--muted)}
.inq-bar{position:fixed;left:0;right:0;bottom:0;z-index:5;display:flex;flex-wrap:wrap;align-items:center;gap:4px 16px;padding:8px var(--gut) max(8px,env(safe-area-inset-bottom));background:var(--ink);color:var(--bg);font-weight:600}
.inq-bar a,.inq-bar button{display:inline-flex;align-items:center;min-height:44px;color:var(--bg);background:none;border:0;font:600 14px var(--body);text-decoration:underline;cursor:pointer;padding:0 4px}
.inq-bar button{margin-left:auto;font-weight:400}
.inq-bar span a{margin-left:0}
.inq-bar[hidden]{display:none}
.lb{position:fixed;inset:0;z-index:10;display:flex;align-items:center;justify-content:center;background:rgb(var(--scrim)/.94);padding:64px 12px}
.lb img{max-width:100%;max-height:100%;object-fit:contain;background:none}
.lb button{position:absolute;width:48px;height:48px;border:0;background:var(--photo-line);color:var(--photo-fg);font-size:24px;cursor:pointer}
.lb .x{top:4px;right:8px}.lb .pv{left:8px;top:50%}.lb .nx{right:8px;top:50%}
.lb-open{overflow:hidden}
@media(min-width:760px){
:root{--hdr:64px}
.site-hdr nav{order:0;width:auto;margin-left:auto}
.hdr-tools{order:2}
.hero-img{aspect-ratio:16/9}
.hero-img~.hero-txt{padding-bottom:32px}
.hero h1{font-size:min(calc(138.6cqw / var(--n,14)),16cqw)}
.wall,.grid{columns:3;column-gap:48px}
.wall>li,.grid>li{padding-bottom:48px}
.salon{grid-template-columns:repeat(12,1fr);gap:24px}
.salon>li{grid-column:span 3}
.salon>li:first-child{grid-column:1/6}
.salon>li:nth-child(2){grid-column:7/10;align-self:end}
.salon>li:nth-child(3){grid-column:10/13;margin-top:0}
.rooms{flex-wrap:nowrap;gap:24px}
.rooms>li:nth-child(3){flex-basis:0}
.split{grid-template-columns:1fr 1fr;gap:48px;align-items:start}
.split.flip>:first-child{order:2}
.step{grid-template-columns:64px 1fr 1fr;gap:32px;align-items:start}
}
@media(min-width:900px){
:root{--sec:96px;--gut:max(48px,env(safe-area-inset-left));--gur:max(48px,env(safe-area-inset-right))}
.sec-head,.convo{grid-template-columns:repeat(12,1fr);column-gap:24px;align-items:baseline}
.sec-head{margin-bottom:48px}
.sec-head h2{grid-column:1/6}
.sec-head .prose{grid-column:7/13}
.convo{align-items:end}
.convo h2{grid-column:1/8}
.convo-txt{grid-column:8/13}
.obj{grid-template-columns:7fr 5fr;align-items:center}
.obj.flip .obj-img{order:2}
.piece{grid-template-columns:7fr 5fr;gap:48px;align-items:start;padding-top:48px}
.piece-info{position:sticky;top:24px}
.piece-media>a img{width:auto;max-height:calc(100vh - 96px)}
}
`.replace(/\n/g, ''),
  crossfade,
  `@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;scroll-behavior:auto!important}}`,
].join('\n');
