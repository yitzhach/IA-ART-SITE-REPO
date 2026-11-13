// Pages that exist only once the artist has saved their words (final pass, D-175): the footer and the sitemap list
// them only then, and each page answers 404 until then. Nothing here is invented: every word comes from the studio.
import type {PublicAssistant, PublicStudio, SitePage, SitePageKey} from './types';

/** The assistant's saved answers as a visitor would ask them, in the Site screen's order (src/lib/assistant-form.ts). */
export const QUESTIONS: {key: string; q: string}[] = [
  {key: 'commissionPrice', q: 'How much does a commission cost?'},
  {key: 'commissionTimeline', q: 'How long does a commission take?'},
  {key: 'deposit', q: 'Is there a deposit, and how do I pay?'},
  {key: 'shipping', q: 'How does shipping work?'},
  {key: 'returns', q: 'Can I return a piece?'},
  {key: 'trade', q: 'Do you offer trade pricing for designers?'},
  {key: 'visits', q: 'Can I visit the studio?'},
  {key: 'whereToSee', q: 'Where can I see the work in person?'},
  {key: 'materials', q: 'What materials do you use?'},
  {key: 'outdoorUse', q: 'Can a piece go outdoors?'},
  {key: 'weight', q: 'How heavy are the pieces?'},
  {key: 'hanging', q: 'How do I hang a piece?'},
  {key: 'care', q: 'How do I care for a piece?'},
  {key: 'other', q: 'Anything else I should know?'},
];

export interface Answered {
  key: string;
  q: string;
  a: string;
}

/** The saved answers, known topics only, empty ones left out. */
export function savedAnswers(a: PublicAssistant | null): Answered[] {
  const saved = a?.answers ?? {};
  return QUESTIONS.flatMap(({key, q}) => {
    const text = typeof saved[key] === 'string' ? saved[key]!.trim() : '';
    return text ? [{key, q, a: text}] : [];
  });
}

export interface MoreLink {
  href: string;
  label: string;
}

/** A saved page with any words in it, or null: an unsaved page (or one saved empty) stays off the site. */
export function savedPage(studio: PublicStudio, key: SitePageKey): SitePage | null {
  const p = studio.pages[key];
  if (!p) return null;
  const words = !!p.title?.trim() || !!p.lede?.trim() || !!p.sections?.some(s => s.heading?.trim() || s.body?.trim());
  return words ? p : null;
}

/** The trade page's answers, under plain headings, in this order (card C). */
export const TRADE_TOPICS: {key: string; heading: string}[] = [
  {key: 'trade', heading: 'Trade pricing'},
  {key: 'commissionTimeline', heading: 'Commissions to size and lead time'},
  {key: 'hanging', heading: 'Installation'},
  {key: 'shipping', heading: 'Shipping'},
];

/** The footer's extra links, in order: only pages that have words. */
export function morePages(studio: PublicStudio, assistant: PublicAssistant | null): MoreLink[] {
  const out: MoreLink[] = [];
  if (savedAnswers(assistant).length) out.push({href: '/questions', label: 'Questions'});
  if (savedPage(studio, 'trade')) out.push({href: '/trade', label: 'For designers'});
  if (savedPage(studio, 'privacy')) out.push({href: '/privacy', label: 'Privacy'});
  if (savedPage(studio, 'terms')) out.push({href: '/terms', label: 'Terms'});
  return out;
}
