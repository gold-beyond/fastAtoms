import { createClient } from '@metagptx/web-sdk';

const TOKEN_KEY = 'auth_token';

const client = createClient({
  getAuthToken: () => localStorage.getItem(TOKEN_KEY),
});

export default client;

export function setClientToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}
