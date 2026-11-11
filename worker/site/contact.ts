// Text, email and call are plain links with the piece written in (D-120). Nothing goes through the platform.
import type {PublicStudio} from './types';

export interface About {
  /** e.g. 'Heron at Dusk' or '3 works'. */
  subject?: string;
  /** The lines of the message, e.g. each work's title and link. */
  lines?: string[];
}

const message = (s: PublicStudio, a: About): string =>
  a.subject || a.lines?.length
    ? [`Hello ${s.name}, I'm interested in ${a.subject ?? 'these works'}.`, ...(a.lines ?? [])].join('\n')
    : `Hello ${s.name}, `;

/** sms: link; null when the studio has no phone. iOS and Android both read `?&body=`. */
export const smsHref = (s: PublicStudio, a: About = {}): string | null =>
  s.phone ? `sms:${s.phone}?&body=${encodeURIComponent(message(s, a))}` : null;

export const mailHref = (s: PublicStudio, a: About = {}): string | null =>
  s.email
    ? `mailto:${s.email}?subject=${encodeURIComponent(a.subject ? `About ${a.subject}` : `Hello from your site`)}&body=${encodeURIComponent(message(s, a))}`
    : null;

export const telHref = (s: PublicStudio): string | null => (s.phone ? `tel:${s.phone}` : null);

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
