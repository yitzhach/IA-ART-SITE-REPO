// Text, email and call, with the piece written in (D-120). Nothing goes through the platform. The studio's phone number is
// never written whole in a page (D-133, against spam bots): pages carry it in two reversed halves that the contact
// sheet assembles on a tap, and `/contact` shows it only after a one-question check.
import type {PublicStudio} from './types';

export interface About {
  /** The piece's slug, so /contact can write it into the message. */
  slug?: string;
  /** The piece's address on this site, for the sheet's message. */
  url?: string;
  /** e.g. 'Heron at Dusk' or '3 works'. */
  subject?: string;
  /** The lines of the message, e.g. each work's title and link. */
  lines?: string[];
}

const message = (s: PublicStudio, a: About): string =>
  a.subject || a.lines?.length
    ? [`Hello ${s.name}, I'm interested in ${a.subject ?? 'these works'}.`, ...(a.lines ?? [])].join('\n')
    : `Hello ${s.name}, `;

export const messageText = message;

const reverse = (t: string) => [...t].reverse().join('');

/** The number as two reversed halves for data attributes; the script reverses and joins them. Null without a phone. */
export function phoneParts(s: PublicStudio): {a: string; b: string} | null {
  if (!s.phone) return null;
  const mid = Math.ceil(s.phone.length / 2);
  return {a: reverse(s.phone.slice(0, mid)), b: reverse(s.phone.slice(mid))};
}

/** Where a Text / Call link goes without scripts: the one-question page. */
export const contactHref = (a: About = {}): string =>
  a.slug ? `/contact?w=${encodeURIComponent(a.slug)}` : '/contact';

/** sms: link with the number: only for the /contact answer after a right answer; null when the studio has no phone.
 * iOS and Android both read `?&body=`. */
export const unlockedSmsHref = (s: PublicStudio, a: About = {}): string | null =>
  s.phone ? `sms:${s.phone}?&body=${encodeURIComponent(message(s, a))}` : null;

export const mailHref = (s: PublicStudio, a: About = {}): string | null =>
  s.email
    ? `mailto:${s.email}?subject=${encodeURIComponent(a.subject ? `About ${a.subject}` : `Hello from your site`)}&body=${encodeURIComponent(message(s, a))}`
    : null;

export const unlockedTelHref = (s: PublicStudio): string | null => (s.phone ? `tel:${s.phone}` : null);

/** The no-script check on /contact: one simple question, chosen by its index in the form. */
export const QUESTIONS: {q: string; a: string[]}[] = [
  {q: 'What is four plus three?', a: ['7', 'seven']},
  {q: 'What is nine minus five?', a: ['4', 'four']},
  {q: 'What is two times three?', a: ['6', 'six']},
  {q: 'What colour is a clear daytime sky?', a: ['blue']},
  {q: 'How many days are in a week?', a: ['7', 'seven']},
  {q: 'What is ten minus eight?', a: ['2', 'two']},
];

export const rightAnswer = (i: number, answer: string): boolean =>
  !!QUESTIONS[i] && QUESTIONS[i]!.a.includes(answer.trim().toLowerCase());

/** "Calls 9am–6pm Pacific time" from the studio's hours and time zone; null without hours. */
export function hoursLine(s: PublicStudio): string | null {
  if (!s.hours) return null;
  const t = (hhmm: string) => {
    const [h = 0, m = 0] = hhmm.split(':').map(Number);
    const ap = h < 12 ? 'am' : 'pm';
    const h12 = h % 12 || 12;
    return m ? `${h12}:${String(m).padStart(2, '0')}${ap}` : `${h12}${ap}`;
  };
  let zone = s.timezone;
  try {
    zone =
      new Intl.DateTimeFormat('en-US', {timeZone: s.timezone, timeZoneName: 'long'})
        .formatToParts(new Date())
        .find(p => p.type === 'timeZoneName')
        ?.value.replace(/ (Standard|Daylight) Time$/, ' time') ?? s.timezone;
  } catch {
    /* unknown zone: show its name */
  }
  return `Calls ${t(s.hours.from)}–${t(s.hours.to)} ${zone}`;
}
