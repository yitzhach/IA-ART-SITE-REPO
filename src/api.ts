// Typed client for the studio platform's API, same origin under /v1 (the Worker forwards it to studio-api).
// The studio always comes from the session cookie, never from a request body.
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Called on any 401, so the app can show sign-in. */
let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => (onUnauthorized = fn);

async function request<T>(method: string, path: string, body?: unknown, version?: number): Promise<T> {
  const headers: Record<string, string> = {accept: 'application/json'};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (version !== undefined) headers['if-match'] = String(version);
  const res = await fetch('/v1' + path, {
    method,
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = undefined;
  }
  if (!res.ok) {
    const e = data?.error ?? {};
    const err = new ApiError(res.status, e.code ?? 'error', e.message ?? res.statusText ?? 'Request failed', e.details);
    if (res.status === 401) onUnauthorized();
    throw err;
  }
  return data as T;
}

export const get = <T>(path: string) => request<T>('GET', path);
export const post = <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {});
export const patch = <T>(path: string, body: unknown, version: number) => request<T>('PATCH', path, body, version);
export const del = <T>(path: string, version: number) => request<T>('DELETE', path, undefined, version);
