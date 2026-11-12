// D-139: the visitor assistant's words start as Isaac's own answers (D-125, D-126), written once by the app.
import {get, patch} from '../api';

export interface AssistantDefaults {
  artistName?: string;
  greeting: string;
  suggestions: string[];
  replyTime: string;
  budgetCents: number;
  answers: Record<string, string>;
}

/** "Isaac" from "Isaac Anderson Art"; undefined when there is no usable name. */
export const firstName = (siteName: unknown): string | undefined => {
  if (typeof siteName !== 'string') return undefined;
  const w = siteName.trim().split(/\s+/)[0];
  return w ? w.slice(0, 60) : undefined;
};

/** The starting words. With no name, they say "the studio" and "the artist"; no returns, general facts or where-to-see. */
export function assistantDefaults(siteName?: unknown): AssistantDefaults {
  const name = firstName(siteName);
  const who = name ?? 'the artist';
  return {
    ...(name ? {artistName: name} : {}),
    greeting: name
      ? `I'm ${name}'s studio assistant, an AI. Ask about any piece, size, colour or commission.`
      : "I'm the studio's assistant, an AI. Ask about any piece, size, colour or commission.",
    suggestions: ["What's available now?", 'Something blue for a living room', 'How do commissions work?'],
    replyTime: name ? `${name} usually replies within a day.` : 'The artist usually replies within a day.',
    budgetCents: 1000,
    answers: {
      commissionPrice: 'Most commissions run $2,000–$15,000, depending on size and scale.',
      commissionTimeline: 'Commissions usually take 8–12 weeks.',
      deposit:
        'Usually 50% up front. Larger commissions and projects can be structured differently, with payments at set points (for example a quarter or a third of the way in).',
      shipping: 'Flat rate for small works; for large works, a quote within two working days.',
      trade: `Yes, ${who} offers trade terms for designers and architects; ask for them.`,
      visits: `Studio visits are by appointment; ask ${who} to arrange one.`,
    },
  };
}

interface SettingsLike {
  version: number;
  meta?: Record<string, unknown>;
}

/** The PATCH body that fills the defaults, or null when the studio already has an assistant. */
export function fillBody(settings: SettingsLike): {meta: Record<string, unknown>} | null {
  const site = (settings.meta?.site ?? {}) as Record<string, unknown>;
  if (site.assistant) return null;
  return {meta: {...settings.meta, site: {...site, assistant: assistantDefaults(site.name)}}};
}

/** Once per app start: write the defaults if the studio has none. Never throws, never overwrites. */
export async function fillAssistantDefaults(
  io: {get: typeof get; patch: typeof patch} = {get, patch},
): Promise<boolean> {
  try {
    const settings = await io.get<SettingsLike>('/settings');
    const body = fillBody(settings);
    if (!body) return false;
    await io.patch('/settings', body, settings.version);
    return true;
  } catch {
    return false;
  }
}
