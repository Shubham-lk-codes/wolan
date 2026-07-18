import api from './api';
import { tokenStorage } from './tokenStorage';

export const authService = {
  async login(credentials) { const { data } = await api.post('/auth/login', { identifier: credentials.identifier || credentials.email, password: credentials.password }); tokenStorage.set(data.accessToken || data.token, data.csrfToken); return data; },
  async me() { const { data } = await api.get('/auth/me'); return data; },
  logout() { const csrfToken = tokenStorage.getCsrf(), accessToken = tokenStorage.get(); if (csrfToken) api.post('/auth/logout', {}, { headers: { Authorization: `Bearer ${accessToken}`, 'x-csrf-token': csrfToken } }).catch(() => {}); tokenStorage.clear(); },
  hasSession() { return Boolean(tokenStorage.get()); },
};
