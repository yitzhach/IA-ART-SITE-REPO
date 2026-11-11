export interface Caption {
  title?: string;
  width?: number;
  height?: number;
  sizeUnit?: 'in' | 'cm';
  year?: number;
}
export interface PageSlot extends Caption {
  page: string;
  id: string;
  /** "abstract" | "figurative" | "sculptural", or null on the Available page. */
  collection: string | null;
  number: number;
  label: string;
  placeholder: string | null;
  src: string | null;
  hiresTarget: string | null;
  sold: boolean;
  caption: string | null;
}
export function decodeEntities(s: string): string;
export function parseAttrs(tagBody: string): Record<string, string>;
export function parseCaption(raw: string | null | undefined): Caption | null;
export function parsePage(html: string, page: string): PageSlot[];
export function visibleBlocks(html: string): string[];
