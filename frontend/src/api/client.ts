/**
 * One small wrapper around fetch, used by every other file in src/api.
 * It attaches the saved login token and turns error responses into thrown
 * Errors carrying the backend's message, so pages can just try/catch.
 */
const TOKEN_KEY = 'foundit_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; isFormData?: boolean } = {},
): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  // FormData sets its own Content-Type (with the multipart boundary), so we
  // only set it ourselves for plain JSON.
  if (!options.isFormData && options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.isFormData
      ? (options.body as FormData)
      : options.body !== undefined
        ? JSON.stringify(options.body)
        : undefined,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? 'Something went wrong.');
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),

  /** For the report forms, which send a photo alongside the text fields. */
  postForm: <T>(path: string, form: FormData) =>
    request<T>(path, { method: 'POST', body: form, isFormData: true }),
  putForm: <T>(path: string, form: FormData) =>
    request<T>(path, { method: 'PUT', body: form, isFormData: true }),
};
