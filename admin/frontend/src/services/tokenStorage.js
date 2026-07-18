const ACCESS_TOKEN_KEY = 'wolan_access_token';
const CSRF_TOKEN_KEY = 'wolan_csrf_token';

export const tokenStorage = {
  get: () => sessionStorage.getItem(ACCESS_TOKEN_KEY),
  set: (token, csrfToken) => { sessionStorage.setItem(ACCESS_TOKEN_KEY, token); if (csrfToken) sessionStorage.setItem(CSRF_TOKEN_KEY, csrfToken); },
  getCsrf: () => sessionStorage.getItem(CSRF_TOKEN_KEY),
  clear: () => { sessionStorage.removeItem(ACCESS_TOKEN_KEY); sessionStorage.removeItem(CSRF_TOKEN_KEY); },
};
