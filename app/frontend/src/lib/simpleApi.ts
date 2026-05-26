const TOKEN_KEY = 'auth_token';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };
}

async function handleResponse(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `API Error: ${res.status}`);
  }
  return res.json();
}

export const api = {
  get: <T = any>(url: string): Promise<T> =>
    fetch(url, { headers: authHeaders() }).then(handleResponse),

  post: <T = any>(url: string, data?: any): Promise<T> =>
    fetch(url, {
      method: 'POST',
      headers: authHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    }).then(handleResponse),

  put: <T = any>(url: string, data?: any): Promise<T> =>
    fetch(url, {
      method: 'PUT',
      headers: authHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    }).then(handleResponse),

  del: <T = any>(url: string): Promise<T> =>
    fetch(url, { method: 'DELETE', headers: authHeaders() }).then(handleResponse),

  /**
   * Read an SSE stream from a POST request.
   *
   * Two calling conventions:
   * 1. Legacy: `{onToken, onDone, onError}` — for single-agent chat streams
   * 2. Generic: `{onEvent}` — receives every parsed SSE event; caller handles
   *    type dispatch. `onDone`/`onError` may also be set for convenience.
   */
  postStream: (
    url: string,
    data: any,
    callbacks: {
      onToken?: (token: string) => void;
      onDone?: (extra?: Record<string, any>) => void;
      onError?: (error: string) => void;
      onEvent?: (event: Record<string, any>) => void;
    },
    signal?: AbortSignal,
  ): Promise<void> => {
    const { onToken, onDone, onError, onEvent } = callbacks;
    return fetch(url, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
      signal,
    }).then(async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        (onError || onEvent)?.(body.detail || `API Error: ${res.status}`);
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) {
        (onError || onEvent)?.('Response body is not readable');
        return;
      }
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(line.slice(6));
                if (onEvent) {
                  onEvent(parsed);
                  continue;
                }
                if (parsed.token) {
                  onToken?.(parsed.token);
                } else if (parsed.done) {
                  onDone?.(parsed);
                  return;
                } else if (parsed.error) {
                  onError?.(parsed.error);
                  return;
                }
              } catch {
              }
            }
          }
        }
        onDone?.();
      } catch (err: any) {
        if (err.name === 'AbortError' && onDone) {
          onDone();
        } else {
          (onError || onEvent)?.(err.message || 'Stream read error');
        }
      }
    }).catch((err: Error & { name?: string }) => {
      if (err.name === 'AbortError' && onDone) {
        onDone();
      } else {
        (onError || onEvent)?.(err.message || 'Request was aborted');
      }
    });
  },
};
