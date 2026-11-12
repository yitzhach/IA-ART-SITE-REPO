// The Site screen's Assistant section: topic labels, dollars <-> cents, and what gets saved.
import {centsToDollars, parseDollars} from './work-logic';

export const TOPICS: {key: string; label: string}[] = [
  {key: 'commissionPrice', label: 'Commission prices'},
  {key: 'commissionTimeline', label: 'Commission timeline'},
  {key: 'deposit', label: 'Deposit and payments'},
  {key: 'shipping', label: 'Shipping'},
  {key: 'returns', label: 'Returns'},
  {key: 'trade', label: 'Trade / designer pricing'},
  {key: 'visits', label: 'Studio visits'},
  {key: 'whereToSee', label: 'Where to see the work'},
  {key: 'materials', label: 'Materials'},
  {key: 'outdoorUse', label: 'Outdoor use'},
  {key: 'weight', label: 'Weight'},
  {key: 'hanging', label: 'Hanging'},
  {key: 'care', label: 'Care and cleaning'},
  {key: 'other', label: 'Anything else'},
];

export interface Assistant {
  enabled?: boolean;
  artistName?: string;
  greeting?: string;
  suggestions?: string[];
  replyTime?: string;
  budgetCents?: number;
  answers?: Record<string, string>;
}

export interface AssistantFields {
  enabled: boolean;
  artistName: string;
  greeting: string;
  suggestions: string[];
  replyTime: string;
  budgetDollars: string;
  answers: Record<string, string>;
}

/** What the form shows; a missing switch means on, a missing budget the default $10. */
export function toFields(a: Assistant | undefined): AssistantFields {
  const sug = [...(a?.suggestions ?? [])].slice(0, 3);
  while (sug.length < 3) sug.push('');
  return {
    enabled: a?.enabled !== false,
    artistName: a?.artistName ?? '',
    greeting: a?.greeting ?? '',
    suggestions: sug,
    replyTime: a?.replyTime ?? '',
    budgetDollars: centsToDollars(a?.budgetCents ?? 1000),
    answers: Object.fromEntries(TOPICS.map(t => [t.key, a?.answers?.[t.key] ?? ''])),
  };
}

/** The `assistant` object to save: blanks are dropped (a blank topic goes to the artist). `error` for a bad budget. */
export function fromFields(f: AssistantFields): {value: Assistant} | {error: string} {
  const cents = parseDollars(f.budgetDollars);
  if (cents === undefined) return {error: 'Type the budget in dollars, like 10 or 12.50.'};
  const a: Assistant = {enabled: f.enabled};
  if (f.artistName.trim()) a.artistName = f.artistName.trim();
  if (f.greeting.trim()) a.greeting = f.greeting.trim();
  const sug = f.suggestions.map(s => s.trim()).filter(Boolean);
  if (sug.length) a.suggestions = sug;
  if (f.replyTime.trim()) a.replyTime = f.replyTime.trim();
  a.budgetCents = cents ?? 0;
  const answers: Record<string, string> = {};
  for (const t of TOPICS) if (f.answers[t.key]?.trim()) answers[t.key] = f.answers[t.key]!.trim();
  if (Object.keys(answers).length) a.answers = answers;
  return {value: a};
}

export interface Usage {
  month: string;
  turns: number;
  spentCents: number;
  budgetCents: number;
  capped: boolean;
}

const money = (cents: number) => '$' + (cents / 100).toFixed(2);

/** "$0.42 of $10.00 this month, 312 answers" */
export function usageLine(u: Usage): string {
  const n = u.turns === 1 ? '1 answer' : `${u.turns} answers`;
  const line = `${money(u.spentCents)} of ${money(u.budgetCents)} this month, ${n}`;
  return u.capped ? `${line}. The budget is used up, so the chat is paused until next month.` : line;
}
