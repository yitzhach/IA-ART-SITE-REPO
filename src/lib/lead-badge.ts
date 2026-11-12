// The count of new leads on the navigation item: one read per app start, updated after Isaac acts.
import {countNew, listLeads} from './leads';

let count = 0;
export const newLeadCount = () => count;

export function setNewLeads(n: number): void {
  count = n;
  for (const b of document.querySelectorAll<HTMLElement>('.lead-badge')) {
    b.textContent = String(n);
    b.hidden = n === 0;
  }
}

/** Never throws; leaves the badge as it was on an error. */
export async function refreshLeadBadge(): Promise<void> {
  try {
    setNewLeads(countNew(await listLeads('open')));
  } catch {
    /* the badge is only a nicety */
  }
}
