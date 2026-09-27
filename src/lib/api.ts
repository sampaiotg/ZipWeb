import { UsageState, CrawlIntentResponse, IndexOverview, IndexFeedItem, HistoryItem } from '../types';

const STORAGE_HISTORY_KEY = 'gptzip_my_history_v1';

export async function fetchViewer(): Promise<UsageState> {
  const res = await fetch('/api/go/viewer');
  if (!res.ok) throw new Error('Failed to load viewer session');
  return res.json();
}

export async function createCrawlIntent(targetUrl: string): Promise<CrawlIntentResponse> {
  const res = await fetch('/api/go/crawl-intents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetUrl })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to initialize crawl intent');
  }
  return data;
}

export async function fetchIndexOverview(): Promise<IndexOverview> {
  const res = await fetch('/api/index/overview');
  if (!res.ok) throw new Error('Failed to load index overview');
  return res.json();
}

export async function fetchIndexFeed(limit = 25, cursor?: string): Promise<{
  items: IndexFeedItem[];
  pageInfo: { nextCursor: string | null; hasMore: boolean; limit: number };
}> {
  const url = new URL('/api/index/feed', window.location.origin);
  url.searchParams.set('limit', limit.toString());
  if (cursor) url.searchParams.set('cursor', cursor);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Failed to load index feed');
  return res.json();
}

export async function registerOrLogin(email: string, referralCode?: string) {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, referralCode })
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to authenticate');
  }
  return res.json();
}

export async function fetchCurrentUser() {
  const res = await fetch('/api/auth/me');
  if (!res.ok) return { user: null };
  return res.json();
}

export async function logoutUser() {
  await fetch('/api/auth/logout', { method: 'POST' });
}

export async function claimReferral(code: string) {
  const res = await fetch('/api/auth/claim-referral', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to claim referral code');
  return data;
}

// Local history helpers
export function getLocalHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalHistoryItem(item: HistoryItem): HistoryItem[] {
  try {
    const current = getLocalHistory();
    const filtered = current.filter(x => x.url.toLowerCase() !== item.url.toLowerCase());
    const updated = [item, ...filtered].slice(0, 20); // Keep max 20 entries
    localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function removeLocalHistoryItem(id: string): HistoryItem[] {
  try {
    const current = getLocalHistory();
    const updated = current.filter(x => x.id !== id);
    localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function updateLocalHistoryMetrics(url: string, metrics: {
  tokensSaved: number;
  estimatedUsdSaved: number;
  compressionRate: number;
  title?: string;
  siteName?: string;
  favicon?: string;
}): HistoryItem[] {
  try {
    const current = getLocalHistory();
    const idx = current.findIndex(x => x.url.toLowerCase() === url.toLowerCase());
    if (idx >= 0) {
      current[idx] = {
        ...current[idx],
        tokensSaved: metrics.tokensSaved,
        estimatedUsdSaved: metrics.estimatedUsdSaved,
        compressionRate: metrics.compressionRate,
        title: metrics.title || current[idx].title,
        siteName: metrics.siteName || current[idx].siteName,
        favicon: metrics.favicon || current[idx].favicon
      };
      localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(current));
    }
    return current;
  } catch {
    return [];
  }
}

export async function fetchPageMetrics(targetUrl: string) {
  try {
    const res = await fetch(`/api/go/metrics?target=${encodeURIComponent(targetUrl)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
