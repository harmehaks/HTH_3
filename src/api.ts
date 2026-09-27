export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isForm = options.body instanceof FormData;
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      'X-Redactor-Client': 'workspace',
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({
    error:
      response.status >= 500
        ? 'The API server is unavailable. Check the terminal startup message, then retry after the server starts.'
        : 'The server returned an unreadable response.',
  }));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}
export const send = (body: unknown, method = 'POST'): RequestInit => ({
  method,
  body: JSON.stringify(body),
});
export function downloadJSON(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
