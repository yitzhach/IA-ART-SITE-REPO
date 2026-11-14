// The "Gallery" template (D-180; design: Art-Talk-Back docs/site-templates-design.md §3–4). A light page: the
// photograph edge to edge under the bar, the line large beneath it, the bodies of work in a charcoal pane. Light only
// for now (no dark block; the switch is left out). Colours and fonts live only in the token block below.
// Contrast (WCAG AA, every text/background pair, tests/site/templates.test.ts): ink, soft, muted and accent on the
// page, card and mat; on-accent on accent; the page colour on ink; pane-ink, pane-muted and pane-accent on the pane,
// and the pane on pane-accent. No italics anywhere (Isaac, 2026-11-14).
import type {Template} from './template';

export const TOKENS = {
  bg: '#EDEAE3',
  card: '#F5F3EE',
  mat: '#E3DED3',
  line: '#D6CFC2',
  ink: '#1B1917',
  muted: '#5C564C',
  soft: '#4A443C',
  accent: '#A34A24',
  'on-accent': '#F5F3EE',
  pane: '#1B1917',
  'pane-ink': '#EDEAE3',
  'pane-muted': '#A29B8E',
  'pane-line': '#37332E',
  'pane-accent': '#D2794A',
} as const;

const COLOURS = Object.entries(TOKENS)
  .map(([k, v]) => `--${k}:${v};`)
  .join('');
const FONTS = `--name:'Bodoni Moda','Bodoni 72',Didot,Georgia,serif;--serif:Newsreader,Georgia,'Times New Roman',serif;--head:var(--serif);--body:Archivo,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;--mono:'IBM Plex Mono',ui-monospace,'SF Mono',Menlo,Consolas,monospace;`;

const face = (family: string, file: string, weight: number) =>
  `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url(/fonts/${file}.woff2) format('woff2')}`;

/** Above the fold on every page: the name (Bodoni 700), the nav (Archivo 500), the Ask button (Plex Mono 600), the
 * note (Plex Mono 500), the line and titles (Newsreader 400) and the description (Archivo 400). */
export const PRELOAD_FONTS = [
  '/fonts/bodoni-700.woff2',
  '/fonts/newsreader-400.woff2',
  '/fonts/archivo-400.woff2',
  '/fonts/archivo-500.woff2',
  '/fonts/plexmono-500.woff2',
  '/fonts/plexmono-600.woff2',
];

const LABEL = `font:500 11px/1.4 var(--mono);text-transform:uppercase;letter-spacing:.12em;color:var(--muted)`;

export const CSS = [
  `:root{${COLOURS}${FONTS}--gut:max(20px,env(safe-area-inset-left));color-scheme:light}`,
  face('Bodoni Moda', 'bodoni-700', 700),
  face('Newsreader', 'newsreader-400', 400),
  face('Archivo', 'archivo-400', 400),
  face('Archivo', 'archivo-500', 500),
  face('Archivo', 'archivo-600', 600),
  face('IBM Plex Mono', 'plexmono-400', 400),
  face('IBM Plex Mono', 'plexmono-500', 500),
  face('IBM Plex Mono', 'plexmono-600', 600),
  `
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;overflow-x:clip}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 var(--body);overflow-wrap:break-word;overflow-x:clip;-webkit-font-smoothing:antialiased}
img{display:block;max-width:100%;height:auto;background:var(--card)}
a{color:var(--accent);text-underline-offset:3px}
a:hover{color:var(--ink)}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
h1,h2,h3{font-family:var(--serif);font-weight:400;line-height:1.15;margin:0 0 .5em;overflow-wrap:anywhere;text-wrap:balance}
h1{font-size:40px;line-height:1.08;letter-spacing:-.02em}
h2{font-size:34px;letter-spacing:-.015em}
h3{font-size:22px}
p,ul,ol,dl{margin:0 0 1em}
ul,ol{padding-left:1.2em}
li{margin:.2em 0}
.skip{position:absolute;left:8px;top:8px;z-index:9;background:var(--ink);color:var(--bg);padding:12px 16px;transform:translateY(-200%)}
.skip:focus{transform:none}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.wrap,.site-hdr,.site-ftr{max-width:1240px;margin:0 auto;padding-left:var(--gut);padding-right:max(20px,env(safe-area-inset-right))}
main{display:block;padding-bottom:16px}
section{margin:72px 0 0}
.site-hdr{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:0 12px;padding-top:8px;padding-bottom:4px;border-bottom:1px solid var(--line)}
.site-name{display:inline-flex;align-items:center;min-height:48px;font:700 18px/1 var(--name);text-transform:uppercase;letter-spacing:.015em;color:var(--ink);text-decoration:none}
.site-hdr nav{order:3;width:100%;display:flex;flex-wrap:wrap;gap:0 24px}
.site-hdr nav a{display:inline-flex;align-items:center;min-height:44px;font:500 14px var(--body);color:var(--ink);text-decoration:none;border-bottom:2px solid transparent}
.site-hdr nav a:hover,.site-hdr nav a[aria-current]{border-bottom-color:var(--accent)}
.theme-switch{display:none}
.hdr-tools{display:flex;align-items:center;gap:8px}
.ask-btn{display:inline-flex;align-items:center;min-height:40px;padding:0 16px;border:1px solid var(--ink);color:var(--ink);font:600 11px var(--mono);text-transform:uppercase;letter-spacing:.08em;text-decoration:none}
.ask-btn:hover,.ask-btn:active{background:var(--ink);color:var(--bg)}
.eyebrow,.no,.caption,.lbl{${LABEL}}
.no b{font-weight:500;color:var(--accent)}
.lede{font:400 19px/1.5 var(--serif);color:var(--soft);max-width:38em;margin:0 0 1em}
.tag{font:400 32px/1.12 var(--serif);letter-spacing:-.02em;margin:0 0 14px;text-wrap:balance}
.intro{padding-top:36px;padding-bottom:8px}
.desc,.prose{color:var(--soft)}
.desc{font-size:16.5px;line-height:1.55;max-width:30em;margin:0}
.prose{max-width:40em}
.prose li::marker{color:var(--accent)}
.note{font:500 12px/1.5 var(--mono);color:var(--soft);margin:14px 0 0}
.btns{display:flex;flex-wrap:wrap;gap:10px;margin:22px 0 0}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 24px;background:var(--accent);color:var(--on-accent);border:1px solid var(--accent);font:600 12px var(--mono);text-transform:uppercase;letter-spacing:.08em;text-decoration:none;cursor:pointer}
.btn:hover,.btn:active{background:var(--ink);border-color:var(--ink);color:var(--bg)}
.btn.alt{background:none;color:var(--ink);border-color:var(--ink)}
.btn.alt:hover,.btn.alt:active{background:var(--ink);color:var(--bg)}
.btn:disabled{opacity:.5;cursor:default}
.btn[hidden]{display:none}
.more{margin:32px 0 0}
.empty{margin:28px 0 48px}
.ph{position:relative;display:block;overflow:hidden;aspect-ratio:4/5;background:var(--card)}
.ph img,.ph .blank{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover}
.r-43{aspect-ratio:4/3}
.r-closely{aspect-ratio:3/2}
.r-hero{aspect-ratio:100/78}
.ph.mat{background:var(--mat)}
.ph.mat img{top:9%;left:9%;width:82%;height:82%;object-fit:contain;background:none;filter:drop-shadow(0 8px 12px rgba(20,18,15,.3))}
.hero{margin:0}
.hero .ph{background:var(--line)}
.filters{display:flex;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;gap:0 18px;margin:0 0 4px;padding:0;list-style:none}
.filters li{margin:0;flex:none}
.filters a{display:inline-flex;align-items:center;min-height:44px;color:var(--ink);text-decoration:none;font:500 14px var(--body);border-bottom:2px solid transparent}
.filters a:hover,.filters a[aria-current]{border-bottom-color:var(--accent)}
.filters .lbl{display:inline-flex;align-items:center;min-height:44px;margin-right:2px}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:32px 16px;list-style:none;margin:0;padding:0}
.grid>li{margin:0;min-width:0}
.grid.top{margin-top:20px}
.card{display:block;color:var(--ink);text-decoration:none}
.card>img,.card>.blank{width:100%;aspect-ratio:4/5;object-fit:cover}
.blank{background:var(--card)}
.card .meta{display:flex;flex-direction:column;gap:3px;padding-top:12px}
.card .ttl{font:400 21px/1.25 var(--serif);letter-spacing:-.01em}
.card:hover .ttl{color:var(--accent)}
.card .sz{font-size:13px;color:var(--muted)}
.chip{display:inline-block;align-self:flex-start;margin-top:4px;padding:3px 8px;border:1px solid var(--muted);font:400 11px/1.4 var(--mono);text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.chip.price{color:var(--ink);border-color:var(--ink)}
.tiles{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;gap:16px;margin-left:calc(var(--gut) * -1);margin-right:calc(var(--gut) * -1);padding:0 var(--gut) 8px;scroll-padding:0 var(--gut)}
.tiles>li{flex:0 0 78%;scroll-snap-align:start}
.tile .meta{padding-top:14px}
.tile .ttl{font:400 22px/1.2 var(--serif)}
.pane{background:var(--pane);color:var(--pane-ink);margin-top:56px;padding:56px 0 60px}
.pane h2{color:var(--pane-ink)}
.pane .prose{color:var(--pane-muted);margin-bottom:28px}
.pane a{color:var(--pane-ink)}
.pane :focus-visible{outline-color:var(--pane-accent)}
.pane .tiles>li{flex-basis:72%}
.pane .ph{background:var(--pane-line)}
.pane .tile .ttl{font-size:26px;letter-spacing:-.01em}
.pane .card:hover .ttl{color:var(--pane-accent)}
.pane .tile .no{color:var(--pane-muted);font-weight:400}
.pane-h{margin-bottom:28px}
.split{display:grid;gap:20px}
.split img{width:100%;aspect-ratio:4/3;object-fit:cover}
.split.p-tall img{aspect-ratio:4/5}
.split .ph img{aspect-ratio:auto}
.closely h2{margin-bottom:28px}
.closely .split{gap:0;padding:28px 0;border-top:1px solid var(--line);margin:0}
.closely .lab{font:500 11px/1.5 var(--mono);text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:18px 0 10px}
.closely .text .lab{margin-top:0}
.closely .lab b{font-weight:500;color:var(--accent)}
.closely .it{font:400 23px/1.28 var(--serif);letter-spacing:-.01em;color:var(--ink);margin:0 0 12px}
.closely .sm{font-size:14.5px;line-height:1.7;color:var(--soft);margin:0 0 .6em}
.spec{list-style:none;padding:0;margin:18px 0 0;border-top:1px solid var(--line);font:400 12px/1.5 var(--mono);color:var(--muted)}
.spec li{margin:0;padding:9px 0;border-bottom:1px solid var(--line)}
.rooms .tile .sz{font-size:13px}
.seen{border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:22px 0 14px}
.seen-h{font:500 10px/1.4 var(--mono);text-transform:uppercase;letter-spacing:.14em;color:var(--muted);margin:0 0 12px}
.seen-l{list-style:none;padding:0;margin:0}
.seen-l li{display:inline-block;border:1px solid var(--line);background:var(--card);padding:8px 18px;margin:0 8px 8px 0;font:400 15px/1.3 var(--serif);color:var(--soft)}
.seen p{margin:0 0 8px;color:var(--soft)}
.convo{border-top:1px solid var(--ink);padding-top:32px}
.convo h2{margin-bottom:14px}
.piece{display:grid;gap:24px;padding-top:20px}
.piece-media a{display:block}
.piece-media img{width:100%}
.pics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;list-style:none;padding:0;margin:12px 0 0}
.pics li{margin:0}
.facts{display:grid;grid-template-columns:auto 1fr;gap:6px 18px;margin:1em 0}
.facts dt{font:400 11px/2 var(--mono);text-transform:uppercase;letter-spacing:.12em;color:var(--muted)}
.facts dd{margin:0}
.avail{font-size:1.1rem;margin:1em 0}
.avail strong{font:400 1.6rem var(--serif);margin-right:.4em}
.prevnext{display:flex;justify-content:space-between;gap:16px;margin-top:40px;padding-top:12px;border-top:1px solid var(--line)}
.prevnext a{display:inline-flex;align-items:center;min-height:44px;color:var(--ink);text-decoration:none;font-weight:500}
.prevnext a:hover{color:var(--accent)}
.steps{list-style:none;padding:0;margin:0}
.step{display:grid;gap:14px;padding:28px 0;border-top:1px solid var(--line);margin:0}
.step .n{font:500 12px var(--mono);color:var(--accent);letter-spacing:.12em}
.step h2,.step h3{margin-bottom:.3em}
.step h2+p{font:400 19px/1.4 var(--serif)}
.step.nophoto{grid-template-columns:60px 1fr}
.step img{width:100%;aspect-ratio:4/3;object-fit:cover}
.gap{margin-top:8px}
.after{margin-top:40px}
.site-ftr{margin-top:80px;border-top:1px solid var(--line);padding-top:26px;padding-bottom:max(36px,env(safe-area-inset-bottom))}
.ftr-name{font:700 16px var(--name);text-transform:uppercase;letter-spacing:.015em;margin:0 0 4px}
.ftr-contact{display:flex;flex-wrap:wrap;gap:0 20px;margin:0}
.ftr-contact a{display:inline-flex;align-items:center;min-height:44px;font-weight:600}
.hours,.ftr-ver{font:400 12px/1.5 var(--mono);color:var(--muted)}
.hours{margin:0 0 8px}
.site-ftr nav{display:flex;flex-wrap:wrap;gap:0 20px}
.site-ftr nav a{display:inline-flex;align-items:center;min-height:44px;font:600 13px var(--body);color:var(--ink);text-decoration:none;border-bottom:2px solid transparent}
.site-ftr nav a:hover,.site-ftr nav a[aria-current]{border-bottom-color:var(--accent)}
.ftr-ver{margin:12px 0 0}
.inq-bar{position:fixed;left:0;right:0;bottom:0;z-index:5;display:flex;flex-wrap:wrap;align-items:center;gap:4px 14px;padding:8px var(--gut) max(8px,env(safe-area-inset-bottom));background:var(--ink);color:var(--bg);font-weight:600}
.inq-bar a,.inq-bar button{display:inline-flex;align-items:center;min-height:44px;color:var(--bg);background:none;border:0;font:600 14px var(--body);text-decoration:underline;cursor:pointer;padding:0 4px}
.inq-bar button{margin-left:auto;font-weight:400}
.inq-bar span a{margin-left:0}
.inq-bar[hidden]{display:none}
.lb{position:fixed;inset:0;z-index:10;display:flex;align-items:center;justify-content:center;background:var(--pane);padding:56px 12px}
.lb img{max-width:100%;max-height:100%;object-fit:contain;background:none}
.lb button{position:absolute;width:48px;height:48px;border:0;border-radius:50%;background:var(--pane-line);color:var(--pane-ink);font-size:26px;cursor:pointer}
.lb .x{top:4px;right:8px}.lb .pv{left:6px;top:50%}.lb .nx{right:6px;top:50%}
.lb-open{overflow:hidden}
@media(min-width:760px){
:root{--gut:max(40px,env(safe-area-inset-left))}
.wrap,.site-hdr,.site-ftr{padding-right:max(40px,env(safe-area-inset-right))}
section{margin-top:104px}
h1{font-size:64px}
h2{font-size:46px}
.site-name{font-size:20px}
.site-hdr{padding-bottom:8px}
.site-hdr nav{order:0;width:auto;margin-left:auto;gap:0 28px}
.hdr-tools{order:2}
.intro{padding-top:64px}
.intro-home{display:grid;grid-template-columns:minmax(0,8fr) minmax(0,4fr);gap:48px;align-items:end;padding-top:48px}
.tag{font-size:56px;margin:0}
.r-hero{aspect-ratio:5/2}
.grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:52px 28px}
.tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:28px;overflow:visible;margin-left:0;margin-right:0;padding:0}
.pane{margin-top:72px;padding:88px 0 96px}
.pane .prose{margin-bottom:40px}
.closely h2{margin-bottom:40px}
.split{grid-template-columns:1fr 1fr;gap:40px;align-items:start}
.split.flip>:first-child{order:2}
.closely .split{grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:56px;padding:40px 0}
.closely .lab{margin-top:0}
.closely .it{font-size:27px}
.closely .text .spec{margin-top:0}
.seen{display:flex;align-items:center;padding:26px 0 18px}
.seen-h{flex:none;margin:0 24px 8px 0}
.convo{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:0 56px;padding-top:44px}
.convo h2{grid-row:1 / span 2}
.convo>:not(h2){grid-column:2}
.step{grid-template-columns:60px 1fr 1fr;gap:28px;align-items:start}
}
@media(min-width:900px){
.piece{grid-template-columns:7fr 5fr;gap:48px;align-items:start}
.piece-info{position:sticky;top:16px}
}
@media(prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
`.replace(/\n/g, ''),
].join('\n');

export const gallery: Template = {
  id: 'gallery',
  label: 'Gallery',
  css: CSS,
  preloadFonts: PRELOAD_FONTS,
  options: {
    heroFirst: true,
    pane: true,
    frames: true,
    closelyRoles: true,
    proofChips: true,
    barSuffix: ' Art',
    themeSwitch: false,
  },
};
