import type {HashedFile} from './group.mjs';
import type {PageSlot} from './parse-pages.mjs';
import type {ManifestWork} from '../../src/import/types';

export type LibrarySlot = Partial<PageSlot> & {id: string; page: string; number?: number};
export function assemble(opts: {
  files: (HashedFile & {bytes: number})[];
  slots: (PageSlot | LibrarySlot)[];
  sha: string;
  repo?: string;
}): {works: ManifestWork[]; skipped: {path: string; reason: string}[]};
export function stemOf(path: string): string;
