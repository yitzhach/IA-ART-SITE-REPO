// What a template is (D-121, D-180): its CSS (colours and fonts only in its token block), the font files it preloads,
// and a few named options the pages ask when a look needs different markup. Pages ask options, never the id.

export interface TemplateOptions {
  /** Home: the photograph first (full-bleed, under the bar), then the note, then the line and description; the
   * page's <h1> stays in the markup but is visually hidden. */
  heroFirst?: boolean;
  /** Home: the bodies of work sit in a full-width charcoal band. */
  pane?: boolean;
  /** Pictures in fixed-shape frames (every picture in a row the same height); available works whole on a mat. */
  frames?: boolean;
  /** "The work, closely": heading as a small label, first paragraph as the large sentence, the list as hairline rows. */
  closelyRoles?: boolean;
  /** "Seen in": the items as chips in one strip, the heading as a small label. */
  proofChips?: boolean;
  /** Words after the studio's name in the bar only (" Art"); titles, footer and emails keep the name as it is. */
  barSuffix?: string;
  /** false: light only for now (no dark theme yet): the switch is left out and the page asks for light. */
  themeSwitch?: boolean;
}

export interface Template {
  id: string;
  /** The name shown to the owner. */
  label: string;
  css: string;
  /** Font files preloaded on every page: only the faces above the fold. */
  preloadFonts: string[];
  options: TemplateOptions;
}
