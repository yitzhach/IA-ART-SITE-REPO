// Leads (D-133, D-140): the owner's inquiry list. Pure labels and rules, plus the three calls.
import {get, post} from '../api';
import {formatPrice} from './work-logic';

export type LeadKind = 'inquiry' | 'hold';
export type LeadStatus = 'new' | 'held' | 'declined' | 'closed';
export interface LeadWork {
  id: string;
  slug: string | null;
  title: string;
  status: string;
  priceCents: number | null;
  currency: string | null;
}
export interface Lead {
  id: string;
  version: number;
  kind: LeadKind;
  source: string;
  status: LeadStatus;
  name: string | null;
  email: string | null;
  phone: string | null;
  note: string | null;
  works: LeadWork[];
  fileIds: string[];
  clientId: string | null;
  threadId: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  works: string[];
  at: string;
}
export interface LeadDetail extends Lead {
  chat: ChatMessage[];
}
export type LeadAction = 'approve-hold' | 'decline' | 'close';

export const listLeads = (filter: 'open' | 'all') => get<{items: Lead[]}>(`/leads?status=${filter}`).then(r => r.items);
export const getLead = (id: string) => get<LeadDetail>(`/leads/${encodeURIComponent(id)}`);
/** Each action is sent with the version the owner saw (If-Match). */
export const runLeadAction = (lead: Pick<Lead, 'id' | 'version'>, action: LeadAction) =>
  post<Lead>(`/leads/${encodeURIComponent(lead.id)}/${action}`, undefined, lead.version);

/** Who: name, else email, else phone. */
export const leadWho = (l: Pick<Lead, 'name' | 'email' | 'phone'>): string =>
  l.name?.trim() || l.email?.trim() || l.phone?.trim() || 'Someone';

export const kindLabel = (k: LeadKind) => (k === 'hold' ? 'Hold request' : 'Inquiry');

export const piecesLabel = (n: number) => (n === 1 ? '1 piece' : `${n} pieces`);

export function statusLabel(l: Pick<Lead, 'status' | 'kind'>): string {
  switch (l.status) {
    case 'new':
      return 'New';
    case 'held':
      return 'Held';
    case 'declined':
      return 'Declined';
    case 'closed':
      return 'Done';
  }
}

/** Only new and held leads need the owner. */
export const isOpen = (l: Pick<Lead, 'status'>) => l.status === 'new' || l.status === 'held';
export const countNew = (leads: Pick<Lead, 'status'>[]) => leads.filter(l => l.status === 'new').length;

/** "Held until Thu, Nov 14, 3:00 PM" for a held lead, else null. */
export function heldUntil(l: Pick<Lead, 'status' | 'expiresAt'>, locale?: string): string | null {
  if (l.status !== 'held' || !l.expiresAt) return null;
  const d = new Date(l.expiresAt);
  if (Number.isNaN(d.getTime())) return null;
  return `Held until ${d.toLocaleString(locale, {weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'})}`;
}

/** "Nov 12" (this year) or "Nov 12, 2025". */
export function when(iso: string, now = new Date(), locale?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleString(locale, {month: 'short', day: 'numeric', ...(sameYear ? {} : {year: 'numeric'})});
}

export interface LeadButton {
  action: LeadAction;
  label: string;
  primary: boolean;
  confirm: string;
  confirmLabel: string;
  done: string;
}

const first = (l: Pick<Lead, 'works'>) => l.works[0]?.title || 'this piece';
const them = (l: Pick<Lead, 'name' | 'email' | 'phone'>) => leadWho(l);

/** Which buttons a lead shows, with the plain words of each confirm sheet. */
export function leadButtons(l: Pick<Lead, 'status' | 'kind' | 'works' | 'name' | 'email' | 'phone'>): LeadButton[] {
  const doneBtn: LeadButton = {
    action: 'close',
    label: 'Done',
    primary: false,
    confirm: 'Mark this one done? It leaves your open list.',
    confirmLabel: 'Done',
    done: 'Marked done.',
  };
  if (l.status === 'new' && l.kind === 'hold') {
    return [
      {
        action: 'approve-hold',
        label: 'Approve hold (48 hours)',
        primary: true,
        confirm: `Reserve ‘${first(l)}’ for ${them(l)} for 48 hours? It goes back on sale by itself after that.`,
        confirmLabel: 'Reserve it',
        done: 'Held for 48 hours.',
      },
      {
        action: 'decline',
        label: 'Decline',
        primary: false,
        confirm: `Decline this hold request? ‘${first(l)}’ stays as it is.`,
        confirmLabel: 'Decline',
        done: 'Declined.',
      },
    ];
  }
  if (l.status === 'new') return [{...doneBtn, primary: true}];
  if (l.status === 'held') {
    return [
      {
        action: 'decline',
        label: 'Decline (put back on sale)',
        primary: false,
        confirm: `Put ‘${first(l)}’ back on sale now? ${them(l)} will no longer have it held.`,
        confirmLabel: 'Put back on sale',
        done: 'Back on sale.',
      },
      doneBtn,
    ];
  }
  return [];
}

export const mailtoHref = (email: string) => `mailto:${email}`;
const digits = (p: string) => p.trim().replace(/[^\d+]/g, '');
export const smsHref = (phone: string) => `sms:${digits(phone)}`;
export const telHref = (phone: string) => `tel:${digits(phone)}`;

export const priceLabel = (w: Pick<LeadWork, 'priceCents'>): string =>
  w.priceCents == null ? 'Price on request' : formatPrice(w.priceCents);
