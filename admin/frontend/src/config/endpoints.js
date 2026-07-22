import { migrateLegacyEndpoint } from './endpointMigration';

const ADMIN_ORIGIN = 'https://wolan-admin.onrender.com';

const defaults = Object.freeze({
  api: `${ADMIN_ORIGIN}/api/v1/admin`,
  publicApi: `${ADMIN_ORIGIN}/api/v1/public`,
  socket: ADMIN_ORIGIN,
});

export const adminApiUrl = migrateLegacyEndpoint(
  import.meta.env.VITE_API_URL,
  import.meta.env.DEV ? '/api/v1/admin' : defaults.api,
);

export const publicApiUrl = migrateLegacyEndpoint(
  import.meta.env.VITE_PUBLIC_API_URL,
  import.meta.env.DEV ? '/api/v1/public' : defaults.publicApi,
);

export const adminSocketUrl = migrateLegacyEndpoint(
  import.meta.env.VITE_SOCKET_URL,
  import.meta.env.DEV ? globalThis.location?.origin : defaults.socket,
);
