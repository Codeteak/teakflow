/** API prefix. Absolute on Vercel→Railway; relative `/api/v1` in local Vite proxy. */
export function apiBaseUrl() {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  return '/api/v1';
}

export function apiUrl(path = '') {
  const base = apiBaseUrl();
  if (!path) {
    return base;
  }
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
