/** API prefix. Absolute on Vercel→Railway; relative `/api/v1` in local Vite proxy. */
export function apiBaseUrl() {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  // If only VITE_SOCKET_URL was set on Vercel, derive the API base from it
  // so login does not POST to teakflow.vercel.app/api/v1 (404).
  const socket = import.meta.env.VITE_SOCKET_URL?.trim();
  if (socket) {
    return `${socket.replace(/\/$/, '')}/api/v1`;
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
