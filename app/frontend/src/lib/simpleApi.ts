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
};
