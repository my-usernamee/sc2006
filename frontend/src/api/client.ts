/**
 * One small wrapper around fetch, used by every other file in src/api.
 * It attaches the saved login token and turns error responses into thrown
 * Errors carrying the backend's message, so pages can just try/catch.
 */
async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; isFormData?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = { "X-Requested-With": "FoundIt" };

  // FormData sets its own Content-Type (with the multipart boundary), so we
  // only set it ourselves for plain JSON.
  if (!options.isFormData && options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    method: options.method ?? "GET",
    headers,
    body: options.isFormData
      ? (options.body as FormData)
      : options.body !== undefined
        ? JSON.stringify(options.body)
        : undefined,
  });

  if (!response.ok) {
    if (
      response.status === 401 &&
      path !== "/auth/login" &&
      path !== "/auth/register"
    )
      window.dispatchEvent(new Event("foundit:unauthorized"));
    const data = await response.json().catch(() => ({}));
    throw new Error(
      (data as { error?: string }).error ?? "Something went wrong.",
    );
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),

  /** For the report forms, which send a photo alongside the text fields. */
  postForm: <T>(path: string, form: FormData) =>
    request<T>(path, { method: "POST", body: form, isFormData: true }),
  putForm: <T>(path: string, form: FormData) =>
    request<T>(path, { method: "PUT", body: form, isFormData: true }),
};
