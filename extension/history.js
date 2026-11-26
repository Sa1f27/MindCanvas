// Shared by the popup (to count) and the service worker (to send), so the number the popup shows
// is exactly the number that gets sent.

export const DEFAULT_SERVER_URL = 'http://localhost:8090';
const MAX_ITEMS = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Pages that are about finding or scrolling, not reading.
const SKIP_DOMAINS = [
  'google.', 'bing.com', 'duckduckgo.com', 'facebook.com', 'twitter.com', 'x.com', 'instagram.com',
  'linkedin.com', 'tiktok.com', 'reddit.com', 'youtube.com', 'mail.', 'localhost', '127.0.0.1',
];
const SKIP_PATHS = [/\/search\?/, /\/results\?/, /\/feed/, /\/login/, /\/signin/, /\/signup/, /\/cart/, /\/checkout/,
  /\.(pdf|jpe?g|png|gif|mp4|zip)$/i];

export function isReadablePage(item) {
  if (!item.url || !item.title) return false;
  try {
    const url = new URL(item.url);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    if (SKIP_DOMAINS.some(d => host.includes(d))) return false;
    return !SKIP_PATHS.some(p => p.test(item.url));
  } catch {
    return false;
  }
}

/** Visited pages from the last `days` days: { all, pages } where pages are the ones worth mapping. */
export async function readHistory(days) {
  const all = await chrome.history.search({ text: '', startTime: Date.now() - days * DAY_MS, maxResults: MAX_ITEMS });
  const pages = all
    .filter(isReadablePage)
    .map(item => ({ url: item.url.trim(), title: item.title.trim(), lastVisitTime: item.lastVisitTime ?? Date.now() }));
  return { all: all.length, pages };
}

export async function getServerUrl() {
  const { serverUrl } = await chrome.storage.local.get('serverUrl');
  return (serverUrl || DEFAULT_SERVER_URL).replace(/\/$/, '');
}
