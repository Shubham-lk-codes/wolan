export const LEGACY_ADMIN_ORIGIN = 'https://wolan-backend-hp9z.onrender.com';

export const migrateLegacyEndpoint = (configuredValue, replacement) => {
  const value = configuredValue?.trim();
  if (!value) return replacement;

  try {
    if (new URL(value).origin === LEGACY_ADMIN_ORIGIN) return replacement;
  } catch {
    // Relative URLs are valid for local development and same-origin deployments.
  }

  return value.replace(/\/+$/, '');
};
