export function isBrowserOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

export function readOfflineCache<T>(path: string): T | null {
  try {
    const raw = localStorage.getItem(`teakflow-offline:${path}`);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeOfflineCache(path: string, data: unknown) {
  try {
    localStorage.setItem(`teakflow-offline:${path}`, JSON.stringify(data));
  } catch {
    // Quota or private mode — ignore.
  }
}
