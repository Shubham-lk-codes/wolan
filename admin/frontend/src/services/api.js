import axios from 'axios';
import { adminApiUrl } from '../config/endpoints';
import { tokenStorage } from './tokenStorage';

const api = axios.create({
  baseURL: adminApiUrl,
  headers: { 'Content-Type': 'application/json' },
  timeout: 12_000,
  withCredentials: true,
});

api.interceptors.request.use(config => {
  const token = tokenStorage.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(response => { if (response.data?.success === true && Object.prototype.hasOwnProperty.call(response.data, 'data')) response.data = response.data.data; return response; }, async error => {
  const original = error.config; const csrfToken = tokenStorage.getCsrf();
  if (error.response?.status === 401 && csrfToken && !original?._retried && !original?.url?.includes('/auth/refresh')) {
    original._retried = true;
    try { const response = await axios.post(`${api.defaults.baseURL}/auth/refresh`, {}, { timeout: 12_000, withCredentials: true, headers: { 'x-csrf-token': csrfToken } }); const session = response.data?.data || response.data; tokenStorage.set(session.accessToken || session.token, session.csrfToken); original.headers.Authorization = `Bearer ${session.accessToken || session.token}`; return api(original); } catch { tokenStorage.clear(); window.dispatchEvent(new CustomEvent('auth:expired')); }
  } else if (error.response?.status === 401) { tokenStorage.clear(); window.dispatchEvent(new CustomEvent('auth:expired')); }
  return Promise.reject(error);
});

export const getApiError = error => error.response?.data?.message || (error.code === 'ECONNABORTED' ? 'The server took too long to respond.' : 'Unable to reach the server.');
export default api;
