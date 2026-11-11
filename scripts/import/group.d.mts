export interface HashedFile {
  path: string;
  hash: string;
  width: number;
  height: number;
  [k: string]: unknown;
}
export const MAX_DISTANCE: number;
export const ASPECT_TOLERANCE: number;
export function hamming(a: string, b: string): number;
export function dhashFromGrey(buf: ArrayLike<number>): string;
export function cluster<T extends HashedFile>(
  files: T[],
  opts?: {maxDistance?: number; aspectTolerance?: number},
): {members: T[]; reasons: string[]}[];
