import type {Artwork} from '../types';
import {chip} from '../ui';

/** Draft / Public, and Sold when sold (a work can be Public and Sold). */
export function statusChips(w: Pick<Artwork, 'public' | 'status'>): HTMLElement[] {
  const out: HTMLElement[] = [];
  if (w.public) {
    const c = chip('Public');
    c.classList.add('solid');
    out.push(c);
  } else out.push(chip('Draft', true));
  if (w.status === 'sold') out.push(chip('Sold'));
  return out;
}
