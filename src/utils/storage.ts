export const USER_BOOKMARKS_KEY = 'shine-nav-user-bookmarks';
export const SORT_ORDERS_KEY = 'shine-nav-sort-orders';
export const SETTINGS_KEY = 'shine-nav-settings';

const LEGACY_USER_BOOKMARKS_KEY = 'shine-nav:user-bookmarks';

export function normalizeUrl(url: string) {
  const value = url.trim();
  if (!value) return '';
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

export function readJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function readLegacyUserBookmarks() {
  return localStorage.getItem(LEGACY_USER_BOOKMARKS_KEY);
}

export function clearLegacyUserBookmarks() {
  localStorage.removeItem(LEGACY_USER_BOOKMARKS_KEY);
}
