// Pages that exist only once the artist has saved their words (final pass, D-175): the footer and the sitemap list
// them only then, and each page answers 404 until then. Nothing here is invented: every word comes from the studio.
import type {PublicAssistant, PublicStudio} from './types';

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

/** The footer's extra links, in order: only pages that have words. */
export function morePages(_studio: PublicStudio, assistant: PublicAssistant | null): MoreLink[] {
  const out: MoreLink[] = [];
  if (savedAnswers(assistant).length) out.push({href: '/questions', label: 'Questions'});
  return out;
}
