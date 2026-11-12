// Collectors (stage 6, D-163…D-168): the studio-api calls the Collectors screens make, and the small rules they show.
// Everything goes through /v1; the studio comes from the session.
import qrcode from 'qrcode-generator';
import {del, get, patch, post} from '../api';

export type CommissionStage = 'surface' | 'layering' | 'color' | 'erosion' | 'finished';
export const STAGES: [CommissionStage, string][] = [
  ['surface', 'Surface'],
  ['layering', 'Layering'],
  ['color', 'Color'],
  ['erosion', 'Erosion'],
  ['finished', 'Finished'],
];
export const stageLabel = (s: CommissionStage) => STAGES.find(([k]) => k === s)?.[1] ?? s;

export interface CollectorLink {
  path: string;
  invitedAt: string | null;
  createdAt: string;
}
export interface CollectorSummary {
  id: string;
  version: number;
  name: string;
  kind: string;
  email: string | null;
  phone: string | null;
  workCount: number;
  commissionCount: number;
  link: CollectorLink | null;
  following: boolean;
  from: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface Commission {
  id: string;
  version: number;
  clientId: string;
  title: string;
  size: string | null;
  priceCents: number | null;
  currency: string;
  stage: CommissionStage;
  status: 'open' | 'done' | 'cancelled';
  notes: Partial<Record<CommissionStage, string>>;
  dueOn: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface CollectorDetail extends CollectorSummary {
  notes: string | null;
  works: {
    id: string;
    version: number;
    slug: string | null;
    title: string;
    year: number | null;
    status: string;
    soldAt: string | null;
    certificate: string;
  }[];
  commissions: Commission[];
}
export interface Follower {
  id: string;
  email: string;
  clientId: string | null;
  showId: string | null;
  showName: string | null;
  verifiedAt: string | null;
  unsubscribedAt: string | null;
  createdAt: string;
}
export interface Show {
  id: string;
  name: string;
  city?: string | null;
  startsOn?: string | null;
}

const enc = encodeURIComponent;
export const listCollectors = (q = '') =>
  get<{items: CollectorSummary[]}>(`/collectors${q ? `?q=${enc(q)}` : ''}`).then(r => r.items);
export const getCollector = (id: string) => get<CollectorDetail>(`/collectors/${enc(id)}`);
export const addCollector = (name: string, email: string | null) =>
  post<{id: string}>('/clients', {name, email, kind: 'collector'});
export const makeLink = (id: string) => post<CollectorDetail>(`/collectors/${enc(id)}/link`);
export const stopLink = (id: string) => post<CollectorDetail>(`/collectors/${enc(id)}/unlink`);
export const emailInvite = (id: string) =>
  post<CollectorDetail & {sent: boolean}>(`/collectors/${enc(id)}/invite`, {origin: location.origin});
export const setOwner = (artworkId: string, clientId: string | null, version?: number) =>
  post<{id: string; version: number; status: string; ownerId: string | null}>(
    `/artworks/${enc(artworkId)}/owner`,
    {clientId},
    version,
  );
export const setFirstLook = (artworkId: string, until: string | null | undefined, version?: number) =>
  post<{id: string; version: number; publicFrom: string | null}>(
    `/artworks/${enc(artworkId)}/first-look`,
    until === undefined ? {} : {until},
    version,
  );
export const announceFirstLook = () =>
  post<{works: number; emailed: number}>('/first-look/announce', {origin: location.origin});
export const listFollowers = () => get<{items: Follower[]}>('/followers').then(r => r.items);
export const listShows = () => get<{items: Show[]}>('/shows').then(r => r.items);
export const addCommission = (clientId: string, title: string, size: string | null, priceCents: number | null) =>
  post<Commission>('/commissions', {clientId, title, size, priceCents});
export const updateCommission = (c: Commission, p: Partial<Pick<Commission, 'stage' | 'status' | 'notes'>>) =>
  patch<Commission>(`/commissions/${enc(c.id)}`, p, c.version);
export const deleteCommission = (c: Commission) => del<Commission>(`/commissions/${enc(c.id)}`, c.version);

/** The full address of a collector's page on this site. */
export const linkUrl = (path: string, origin = location.origin) => origin.replace(/\/$/, '') + path;
/** The follow page a show's QR code opens. */
export const showFollowUrl = (showId: string, origin = location.origin) =>
  `${origin.replace(/\/$/, '')}/follow/${showId}`;

/** What the work screen says about first look. */
export function firstLookState(publicFrom: string | null | undefined, now = Date.now()): 'off' | 'on' | 'ended' {
  if (!publicFrom) return 'off';
  return Date.parse(publicFrom) > now ? 'on' : 'ended';
}

/** The next stage on the five-stage line, or null at the end. */
export function nextStage(s: CommissionStage): CommissionStage | null {
  const i = STAGES.findIndex(([k]) => k === s);
  return i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1]![0] : null;
}

/** A QR code as an SVG string (dark squares on white, a quiet margin), for a show's follow page. */
export function qrSvg(text: string, cell = 8): string {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const m = 4;
  const size = (n + m * 2) * cell;
  let d = '';
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (qr.isDark(r, c)) d += `M${(c + m) * cell} ${(r + m) * cell}h${cell}v${cell}h-${cell}z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

/** A starting draft of the care notes, from the Process page's materials, for the artist to edit before saving. */
export const CARE_DRAFT = [
  'Your piece is plaster, pigment and metal leaf on a wood panel. It is sturdier than a canvas, and its surface is part of the work.',
  '',
  '• Hang it out of direct sun, and away from heaters, vents and damp walls.',
  '• Dust it now and then with a soft, dry brush. No water, cloths or cleaners: plaster and gilding can mark.',
  '• Lift it by the panel’s edges, never by the surface.',
  '• The copper and brass may darken slowly with time. That is expected.',
  '• For a chip, a crack or anything you’re unsure about, contact the studio before trying a repair.',
].join('\n');

interface Settings {
  version: number;
  meta: {site?: {collectors?: {care?: string | null; firstLookDays?: number}} & Record<string, unknown>} & Record<
    string,
    unknown
  >;
}
export const getSettings = () => get<Settings>('/settings');
/** Saves the care notes into the site's settings, keeping everything else as it is. */
export function saveCare(s: Settings, care: string) {
  const site = s.meta.site ?? {};
  return patch<Settings>(
    '/settings',
    {meta: {...s.meta, site: {...site, collectors: {...(site.collectors ?? {}), care: care.trim() || undefined}}}},
    s.version,
  );
}
