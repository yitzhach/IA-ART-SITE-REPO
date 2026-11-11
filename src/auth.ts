// Sign-in with the studio's emailed code (or password), against studio-api. The session is a 30-day cookie.
import {ApiError, get, post} from './api';

export type Membership = {
  studioId: string;
  studioName: string;
  studioSlug?: string;
  role: 'owner' | 'staff' | 'client';
  clientId: string | null;
};
export type Me = {
  user: {id: string; email: string; name: string | null};
  memberships: Membership[];
  activeStudioId: string | null;
  hasPassword: boolean;
};

export const studioName = (me: Me): string | undefined =>
  me.memberships.find(m => m.studioId === me.activeStudioId)?.studioName;

/** The signed-in person, or null when there is no session. */
export async function currentUser(): Promise<Me | null> {
  try {
    return await get<Me>('/me');
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}
export const requestCode = (email: string) => post<void>('/auth/code', {email});
export const verifyCode = (email: string, code: string) => post<Me>('/auth/verify', {email, code});
export const passwordLogin = (email: string, password: string) => post<Me>('/auth/password/login', {email, password});
export const signOut = () => post<void>('/auth/logout');
