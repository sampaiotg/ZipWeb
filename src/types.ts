export interface UsageState {
  completed: number;
  limit: number;
  remaining: number;
  allowed: boolean;
  anonId: string;
  bonusCredits?: number;
  user?: {
    id: string;
    email: string;
    credits: number;
    referralCode: string;
  } | null;
  completedUrls: string[];
}

export interface CompressedSectionItem {
  id: string;
  title: string;
  snippet?: string;
  tokensBefore: number;
  tokensAfter: number;
  tokensSaved: number;
  compressionRate: number;
}

export interface CachedMetrics {
  tokensBefore: number;
  tokensAfter: number;
  tokensSaved: number;
  compressionRate: number;
  estimatedSavings: number;
  siteName?: string;
  pageTitle?: string;
  favicon?: string;
  compressionMode?: string;
  durationMs?: number;
  sections?: CompressedSectionItem[];
}

export interface CrawlIntentResponse {
  allowed: boolean;
  intentId?: string;
  isRepeat?: boolean;
  usage: {
    completed: number;
    limit: number;
    remaining: number;
  };
  redirectUrl?: string;
  error?: string;
  cachedMetrics?: CachedMetrics | null;
}

export interface IndexOverview {
  totals: {
    pagesTotal: number;
    tokensSavedTotal: number;
    estimatedSavingsUsdTotal: number;
  };
  topCountries: Array<{
    countryCode: string;
    countryName: string;
    pageCount: number;
    tokensSaved: number;
    estimatedSavings: number;
  }>;
  topSites: Array<{
    host: string;
    displayName: string;
    favicon: string;
    pageCount: number;
    tokensSaved: number;
    estimatedSavings: number;
  }>;
}

export interface IndexFeedItem {
  id: string;
  timestamp: number;
  publicUrl: string;
  siteHost: string;
  siteName: string;
  pageTitle: string;
  favicon: string;
  countryCode?: string;
  tokensBefore: number;
  tokensAfter: number;
  tokensSaved: number;
  compressionRate: number;
  estimatedSavings: number;
  durationMs: number;
  tokensPerSec?: number;
}

export interface HistoryItem {
  id: string;
  url: string;
  title: string;
  siteName: string;
  favicon: string;
  tokensSaved: number;
  estimatedUsdSaved: number;
  compressionRate: number;
  timestamp: number;
}
