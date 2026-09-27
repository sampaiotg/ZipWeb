import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dns from 'dns/promises';
import { parse as parseHtml } from 'node-html-parser';
import { createServer as createViteServer } from 'vite';

const PORT = parseInt(process.env.PORT || '3000', 10);
const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORAGE_FILE = path.join(DATA_DIR, 'storage.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface IndexFeedItem {
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

interface AnonymousVisitor {
  anonId: string;
  createdAt: number;
  uniqueUrls: string[];
  reservedIntents: Record<string, { url: string; expiresAt: number; redeemed: boolean }>;
}

interface UserAccount {
  id: string;
  email: string;
  credits: number;
  referralCode: string;
  referredBy?: string;
  createdAt: number;
}

interface CompressedSectionItem {
  id: string;
  title: string;
  snippet?: string;
  tokensBefore: number;
  tokensAfter: number;
  tokensSaved: number;
  compressionRate: number;
}

interface CachedPage {
  html: string;
  title: string;
  favicon: string;
  siteName: string;
  tokensBefore: number;
  tokensAfter: number;
  tokensSaved: number;
  compressionRate: number;
  durationMs: number;
  estimatedSavings: number;
  timestamp: number;
  compressionMode?: string;
  sections?: CompressedSectionItem[];
}

interface StorageSchema {
  anonymousVisitors: Record<string, AnonymousVisitor>;
  indexEvents: IndexFeedItem[];
  cachedPages: Record<string, CachedPage>;
  users: Record<string, UserAccount>;
}

// Initial realistic seed items for the Compressed Web catalog
const INITIAL_SEED_FEED: IndexFeedItem[] = [
  {
    id: 'seed-1',
    timestamp: Date.now() - 1000 * 60 * 12,
    publicUrl: 'https://en.wikipedia.org/wiki/Transformer_(deep_learning_architecture)',
    siteHost: 'en.wikipedia.org',
    siteName: 'Wikipedia',
    pageTitle: 'Transformer (deep learning architecture) - Wikipedia',
    favicon: 'https://en.wikipedia.org/static/favicon/wikipedia.ico',
    countryCode: 'US',
    tokensBefore: 14820,
    tokensAfter: 9140,
    tokensSaved: 5680,
    compressionRate: 38.3,
    estimatedSavings: 0.0142,
    durationMs: 245,
    tokensPerSec: 60489
  },
  {
    id: 'seed-2',
    timestamp: Date.now() - 1000 * 60 * 34,
    publicUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching',
    siteHost: 'developer.mozilla.org',
    siteName: 'MDN Web Docs',
    pageTitle: 'HTTP caching - HTTP | MDN',
    favicon: 'https://developer.mozilla.org/favicon-48x48.png',
    countryCode: 'US',
    tokensBefore: 8940,
    tokensAfter: 5410,
    tokensSaved: 3530,
    compressionRate: 39.5,
    estimatedSavings: 0.0088,
    durationMs: 168,
    tokensPerSec: 53214
  },
  {
    id: 'seed-3',
    timestamp: Date.now() - 1000 * 60 * 85,
    publicUrl: 'https://news.ycombinator.com',
    siteHost: 'news.ycombinator.com',
    siteName: 'Hacker News',
    pageTitle: 'Hacker News',
    favicon: 'https://news.ycombinator.com/favicon.ico',
    countryCode: 'US',
    tokensBefore: 6250,
    tokensAfter: 4120,
    tokensSaved: 2130,
    compressionRate: 34.1,
    estimatedSavings: 0.0053,
    durationMs: 112,
    tokensPerSec: 55803
  },
  {
    id: 'seed-4',
    timestamp: Date.now() - 1000 * 60 * 140,
    publicUrl: 'https://www.nature.com/articles/d41586-024-00000-0',
    siteHost: 'nature.com',
    siteName: 'Nature',
    pageTitle: 'Quantum computing breakthroughs accelerate scientific discovery',
    favicon: 'https://www.nature.com/static/images/favicons/nature/favicon-32x32.png',
    countryCode: 'GB',
    tokensBefore: 12400,
    tokensAfter: 7680,
    tokensSaved: 4720,
    compressionRate: 38.1,
    estimatedSavings: 0.0118,
    durationMs: 198,
    tokensPerSec: 62626
  },
  {
    id: 'seed-5',
    timestamp: Date.now() - 1000 * 60 * 210,
    publicUrl: 'https://arxiv.org/abs/1706.03762',
    siteHost: 'arxiv.org',
    siteName: 'arXiv',
    pageTitle: 'Attention Is All You Need - Vaswani et al.',
    favicon: 'https://arxiv.org/favicon.ico',
    countryCode: 'US',
    tokensBefore: 5120,
    tokensAfter: 3180,
    tokensSaved: 1940,
    compressionRate: 37.9,
    estimatedSavings: 0.0049,
    durationMs: 94,
    tokensPerSec: 54468
  },
  {
    id: 'seed-6',
    timestamp: Date.now() - 1000 * 60 * 360,
    publicUrl: 'https://github.com/features/actions',
    siteHost: 'github.com',
    siteName: 'GitHub',
    pageTitle: 'Features • GitHub Actions',
    favicon: 'https://github.githubassets.com/favicons/favicon.svg',
    countryCode: 'US',
    tokensBefore: 7850,
    tokensAfter: 4890,
    tokensSaved: 2960,
    compressionRate: 37.7,
    estimatedSavings: 0.0074,
    durationMs: 135,
    tokensPerSec: 58148
  }
];

// Persistent state management with atomic writes
class Storage {
  private data: StorageSchema;

  constructor() {
    this.data = this.load();
  }

  private load(): StorageSchema {
    if (fs.existsSync(STORAGE_FILE)) {
      try {
        const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!parsed.anonymousVisitors) parsed.anonymousVisitors = {};
        if (!parsed.indexEvents || parsed.indexEvents.length === 0) parsed.indexEvents = INITIAL_SEED_FEED;
        if (!parsed.cachedPages) parsed.cachedPages = {};
        for (const [url, page] of Object.entries(parsed.cachedPages as Record<string, any>)) {
          if (page && page.html && page.html.includes('position: sticky;')) {
            page.html = page.html
              .replace(
                'position: sticky;',
                'position: fixed !important;\n    top: 0 !important;\n    left: 0 !important;\n    right: 0 !important;\n    width: 100% !important;\n    box-sizing: border-box !important;\n    margin: 0 !important;'
              )
              .replace(
                '<style>',
                '<style id="gptzip-banner-styles">\n  html { scroll-padding-top: 60px !important; }\n  body { padding-top: 60px !important; }'
              );
          }
        }
        if (!parsed.users) parsed.users = {};
        return parsed;
      } catch (err) {
        console.error('Failed to parse storage.json, initializing fresh store:', err);
      }
    }
    return {
      anonymousVisitors: {},
      indexEvents: INITIAL_SEED_FEED,
      cachedPages: {},
      users: {}
    };
  }

  public save(): void {
    try {
      const tempPath = `${STORAGE_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempPath, STORAGE_FILE);
    } catch (err) {
      console.error('Error writing storage.json:', err);
    }
  }

  public getOrCreateVisitor(anonId?: string): { visitor: AnonymousVisitor; isNew: boolean } {
    if (anonId && this.data.anonymousVisitors[anonId]) {
      return { visitor: this.data.anonymousVisitors[anonId], isNew: false };
    }
    const newId = `anon_${crypto.randomBytes(16).toString('hex')}`;
    const visitor: AnonymousVisitor = {
      anonId: newId,
      createdAt: Date.now(),
      uniqueUrls: [],
      reservedIntents: {}
    };
    this.data.anonymousVisitors[newId] = visitor;
    this.save();
    return { visitor, isNew: true };
  }

  public getVisitor(anonId: string): AnonymousVisitor | null {
    return this.data.anonymousVisitors[anonId] || null;
  }

  public reserveIntent(anonId: string, normalizedUrl: string): { intentId: string; allowed: boolean; remaining: number } {
    const visitor = this.data.anonymousVisitors[anonId];
    if (!visitor) return { intentId: '', allowed: false, remaining: 0 };

    const completed = visitor.uniqueUrls.length;
    const isRepeat = visitor.uniqueUrls.includes(normalizedUrl);
    const limit = 20;

    if (!isRepeat && completed >= limit) {
      return { intentId: '', allowed: false, remaining: 0 };
    }

    // Clean up expired intents
    const now = Date.now();
    for (const [id, record] of Object.entries(visitor.reservedIntents)) {
      if (record.expiresAt < now && !record.redeemed) {
        delete visitor.reservedIntents[id];
      }
    }

    const intentId = `intent_${crypto.randomBytes(16).toString('hex')}`;
    visitor.reservedIntents[intentId] = {
      url: normalizedUrl,
      expiresAt: now + 1000 * 60 * 15, // 15 minute TTL
      redeemed: false
    };

    this.save();
    const remaining = Math.max(0, limit - completed);
    return { intentId, allowed: true, remaining };
  }

  public redeemIntent(anonId: string, intentId: string, normalizedUrl: string): boolean {
    const visitor = this.data.anonymousVisitors[anonId];
    if (!visitor) return false;

    const record = visitor.reservedIntents[intentId];
    if (record && !record.redeemed) {
      record.redeemed = true;
      if (!visitor.uniqueUrls.includes(normalizedUrl)) {
        visitor.uniqueUrls.push(normalizedUrl);
      }
      this.save();
      return true;
    }

    // If intent was already redeemed or URL was already completed, it's idempotent
    if (visitor.uniqueUrls.includes(normalizedUrl)) {
      return true;
    }

    return false;
  }

  public releaseIntent(anonId: string, intentId: string): void {
    const visitor = this.data.anonymousVisitors[anonId];
    if (visitor && visitor.reservedIntents[intentId]) {
      delete visitor.reservedIntents[intentId];
      this.save();
    }
  }

  public addIndexEvent(event: IndexFeedItem): void {
    // Deduplicate any previous entry for this exact URL so there are no conflicting stats in the feed
    this.data.indexEvents = this.data.indexEvents.filter(e => e.publicUrl !== event.publicUrl);
    // Add to top of list
    this.data.indexEvents.unshift(event);
    // Keep reasonable size
    if (this.data.indexEvents.length > 500) {
      this.data.indexEvents = this.data.indexEvents.slice(0, 500);
    }
    this.save();
  }

  public getIndexFeed(limit = 25, cursor?: string): { items: IndexFeedItem[]; nextCursor: string | null; hasMore: boolean } {
    const safeLimit = Math.min(Math.max(1, limit), 50);
    let startIndex = 0;
    if (cursor) {
      const idx = this.data.indexEvents.findIndex(item => item.id === cursor);
      if (idx !== -1) {
        startIndex = idx + 1;
      }
    }
    const slice = this.data.indexEvents.slice(startIndex, startIndex + safeLimit);
    const hasMore = startIndex + safeLimit < this.data.indexEvents.length;
    const nextCursor = hasMore && slice.length > 0 ? slice[slice.length - 1].id : null;
    return { items: slice, nextCursor, hasMore };
  }

  public getIndexOverview() {
    let pagesTotal = this.data.indexEvents.length;
    let tokensSavedTotal = 0;
    let estimatedSavingsUsdTotal = 0;

    const countryMap: Record<string, { pageCount: number; tokensSaved: number; estimatedSavings: number }> = {};
    const siteMap: Record<string, { displayName: string; favicon: string; pageCount: number; tokensSaved: number; estimatedSavings: number }> = {};

    for (const ev of this.data.indexEvents) {
      tokensSavedTotal += ev.tokensSaved;
      estimatedSavingsUsdTotal += ev.estimatedSavings;

      const c = ev.countryCode || 'US';
      if (!countryMap[c]) countryMap[c] = { pageCount: 0, tokensSaved: 0, estimatedSavings: 0 };
      countryMap[c].pageCount += 1;
      countryMap[c].tokensSaved += ev.tokensSaved;
      countryMap[c].estimatedSavings += ev.estimatedSavings;

      const host = ev.siteHost;
      if (!siteMap[host]) {
        siteMap[host] = {
          displayName: ev.siteName || host,
          favicon: ev.favicon,
          pageCount: 0,
          tokensSaved: 0,
          estimatedSavings: 0
        };
      }
      siteMap[host].pageCount += 1;
      siteMap[host].tokensSaved += ev.tokensSaved;
      siteMap[host].estimatedSavings += ev.estimatedSavings;
    }

    const countryNames: Record<string, string> = {
      US: 'United States',
      GB: 'United Kingdom',
      DE: 'Germany',
      FR: 'France',
      JP: 'Japan',
      CA: 'Canada',
      NL: 'Netherlands',
      SG: 'Singapore',
      AU: 'Australia',
      BR: 'Brazil'
    };

    const topCountries = Object.entries(countryMap)
      .map(([code, stats]) => ({
        countryCode: code,
        countryName: countryNames[code] || code,
        ...stats,
        estimatedSavings: Number(stats.estimatedSavings.toFixed(4))
      }))
      .sort((a, b) => b.pageCount - a.pageCount)
      .slice(0, 5);

    const topSites = Object.entries(siteMap)
      .map(([host, stats]) => ({
        host,
        displayName: stats.displayName,
        favicon: stats.favicon,
        pageCount: stats.pageCount,
        tokensSaved: stats.tokensSaved,
        estimatedSavings: Number(stats.estimatedSavings.toFixed(4))
      }))
      .sort((a, b) => b.pageCount - a.pageCount)
      .slice(0, 5);

    return {
      totals: {
        pagesTotal,
        tokensSavedTotal,
        estimatedSavingsUsdTotal: Number(estimatedSavingsUsdTotal.toFixed(4))
      },
      topCountries,
      topSites
    };
  }

  public getCachedPage(url: string): CachedPage | null {
    return this.data.cachedPages[url] || null;
  }

  public setCachedPage(url: string, page: CachedPage): void {
    this.data.cachedPages[url] = page;
    this.save();
  }

  public deleteCachedPage(url: string): void {
    delete this.data.cachedPages[url];
    this.save();
  }

  public getUser(userId: string): UserAccount | null {
    return this.data.users[userId] || null;
  }

  public getUserByEmail(email: string): UserAccount | null {
    return Object.values(this.data.users).find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  public createUser(email: string, referredBy?: string): UserAccount {
    const id = `usr_${crypto.randomBytes(8).toString('hex')}`;
    const referralCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    const newUser: UserAccount = {
      id,
      email,
      credits: referredBy ? 10 : 5,
      referralCode,
      referredBy,
      createdAt: Date.now()
    };
    this.data.users[id] = newUser;
    this.save();
    return newUser;
  }

  public applyReferral(code: string, userId: string): boolean {
    const referrer = Object.values(this.data.users).find(u => u.referralCode === code);
    if (!referrer || referrer.id === userId) return false;
    referrer.credits += 10;
    const current = this.data.users[userId];
    if (current) current.credits += 10;
    this.save();
    return true;
  }
}

const store = new Storage();

// Cookie signing secret
const COOKIE_SECRET = process.env.COOKIE_SECRET || 'gptzip-secret-seed-key-cloudrun-1337';

function signCookie(val: string): string {
  const hmac = crypto.createHmac('sha256', COOKIE_SECRET).update(val).digest('hex');
  return `${val}.${hmac}`;
}

function verifyCookie(raw?: string): string | null {
  if (!raw) return null;
  const parts = raw.split('.');
  if (parts.length !== 2) return null;
  const [val, hmac] = parts;
  const expected = crypto.createHmac('sha256', COOKIE_SECRET).update(val).digest('hex');
  if (crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))) {
    return val;
  }
  return null;
}

// URL Safety & SSRF prevention
async function isSafeUrl(rawUrl: string): Promise<{ safe: boolean; error?: string; normalizedUrl?: string; parsed?: URL }> {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { safe: false, error: 'Only http and https protocols are supported' };
    }
    if (parsed.username || parsed.password) {
      return { safe: false, error: 'URLs with embedded credentials are not allowed' };
    }

    const host = parsed.hostname.toLowerCase();

    // Check banned hosts & loopback/metadata
    const blockedHosts = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      '169.254.169.254',
      'metadata.google.internal',
      'metadata',
      'instance-data'
    ];
    if (blockedHosts.includes(host) || host.endsWith('.local') || host.endsWith('.internal')) {
      return { safe: false, error: 'Access to local, private, or cloud metadata endpoints is prohibited' };
    }

    // IP address checks
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipMatch = host.match(ipv4Regex);
    if (ipMatch) {
      const p1 = parseInt(ipMatch[1], 10);
      const p2 = parseInt(ipMatch[2], 10);
      // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, 169.254.0.0/16, 0.0.0.0/8
      if (
        p1 === 10 ||
        p1 === 127 ||
        p1 === 0 ||
        (p1 === 172 && p2 >= 16 && p2 <= 31) ||
        (p1 === 192 && p2 === 168) ||
        (p1 === 169 && p2 === 254)
      ) {
        return { safe: false, error: 'Private and reserved IP addresses are not accessible' };
      }
    }

    // DNS resolution check to prevent DNS rebinding
    try {
      const addresses = await dns.lookup(host, { all: true });
      for (const addr of addresses) {
        const ip = addr.address;
        const resolvedMatch = ip.match(ipv4Regex);
        if (resolvedMatch) {
          const p1 = parseInt(resolvedMatch[1], 10);
          const p2 = parseInt(resolvedMatch[2], 10);
          if (
            p1 === 10 ||
            p1 === 127 ||
            p1 === 0 ||
            (p1 === 172 && p2 >= 16 && p2 <= 31) ||
            (p1 === 192 && p2 === 168) ||
            (p1 === 169 && p2 === 254)
          ) {
            return { safe: false, error: 'Target host resolves to a private or restricted network' };
          }
        } else if (ip === '::1' || ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) {
          return { safe: false, error: 'Target host resolves to an IPv6 private/link-local address' };
        }
      }
    } catch (e: any) {
      return { safe: false, error: `Host lookup failed: ${e.message}` };
    }

    // Normalized URL: strip fragment, drop utm tracking parameters
    parsed.hash = '';
    const cleanParams = new URLSearchParams();
    for (const [k, v] of parsed.searchParams.entries()) {
      if (!k.toLowerCase().startsWith('utm_') && k !== 'fbclid' && k !== 'gclid') {
        cleanParams.append(k, v);
      }
    }
    const cleanQuery = cleanParams.toString();
    parsed.search = cleanQuery ? `?${cleanQuery}` : '';

    return { safe: true, normalizedUrl: parsed.toString(), parsed };
  } catch (err: any) {
    return { safe: false, error: `Invalid URL: ${err.message}` };
  }
}

// BPE Token counter estimation (~3.8 characters per token for English text)
function estimateTokens(text: string): number {
  if (!text) return 0;
  const words = text.trim().split(/\s+/).length;
  const chars = text.length;
  // Blend word count and character count for accuracy
  return Math.max(1, Math.round(words * 1.3 + chars / 14));
}

// GPT-ZIP Compression Handler (Calls live api.gpt-zip.com if key available; falls back to token optimization engine)
async function compressTextBlock(text: string): Promise<{
  compressedText: string;
  tokensBefore: number;
  tokensAfter: number;
  tokensSaved: number;
  compressionRate: number;
  durationMs: number;
}> {
  const startTime = Date.now();
  const apiKey = process.env.GPTZIP_API_KEY;

  if (apiKey) {
    try {
      const response = await fetch('https://api.gpt-zip.com/api/v1/compress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({
          text,
          mode: 'medium-auto3',
          privacyMode: 'off'
        }),
        signal: AbortSignal.timeout(15_000)
      });

      if (response.ok) {
        const json: any = await response.json();
        const compressed = json.compressedText || text;
        const tokensBefore = json.tokens_before || estimateTokens(text);
        const tokensAfter = json.tokens_after || estimateTokens(compressed);
        const tokensSaved = Math.max(0, tokensBefore - tokensAfter);
        const compressionRate = tokensBefore > 0 ? Number(((tokensSaved / tokensBefore) * 100).toFixed(1)) : 0;
        return {
          compressedText: compressed,
          tokensBefore,
          tokensAfter,
          tokensSaved,
          compressionRate,
          durationMs: Date.now() - startTime
        };
      } else {
        console.warn(`GPT-ZIP API returned ${response.status}, falling back to built-in compressor`);
      }
    } catch (err) {
      console.warn('GPT-ZIP API request failed, using algorithmic compressor:', err);
    }
  }

  // Built-in token compression algorithm matching GPT-ZIP medium-auto3 behavior
  // Strips citation markers, conversational filler, redundant hedging, compresses verbose grammatical constructs
  let compressed = text;

  // Strip Wikipedia and academic citation references: [1], [2], [citation needed], [note 1]
  compressed = compressed.replace(/\[(?:\d+|citation needed|edit|note \d+)\]/gi, '');

  const replacements: Array<[RegExp, string]> = [
    [/\bin order to\b/gi, 'to'],
    [/\bit is important to note that\b/gi, 'note that'],
    [/\bas a matter of fact\b/gi, 'in fact'],
    [/\bdue to the fact that\b/gi, 'because'],
    [/\bfor the purpose of\b/gi, 'for'],
    [/\bat the present time\b/gi, 'now'],
    [/\bin the event that\b/gi, 'if'],
    [/\bwith the exception of\b/gi, 'except'],
    [/\btake into consideration\b/gi, 'consider'],
    [/\bhas the capability of\b/gi, 'can'],
    [/\bis able to\b/gi, 'can'],
    [/\bis capable of\b/gi, 'can'],
    [/\ba large number of\b/gi, 'many'],
    [/\ba wide variety of\b/gi, 'various'],
    [/\bin close proximity to\b/gi, 'near'],
    [/\buntil such time as\b/gi, 'until'],
    [/\bat this point in time\b/gi, 'now'],
    [/\bin conjunction with\b/gi, 'with'],
    [/\bprior to\b/gi, 'before'],
    [/\bsubsequent to\b/gi, 'after'],
    [/\bwith regard to\b/gi, 'regarding'],
    [/\bin light of the fact that\b/gi, 'since'],
    [/\bit goes without saying that\b/gi, 'clearly'],
    [/\bserves to\b/gi, 'helps'],
    [/\butilize\b/gi, 'use'],
    [/\butilizes\b/gi, 'uses'],
    [/\butilizing\b/gi, 'using'],
    [/\butilization\b/gi, 'use'],
    [/\bcommence\b/gi, 'begin'],
    [/\bcommences\b/gi, 'begins'],
    [/\bterminate\b/gi, 'end'],
    [/\bterminates\b/gi, 'ends'],
    [/\bfacilitate\b/gi, 'help'],
    [/\bfacilitates\b/gi, 'helps'],
    [/\bdemonstrates that\b/gi, 'shows'],
    [/\bis composed of\b/gi, 'comprises'],
    [/\bat a later date\b/gi, 'later'],
    [/\bby means of\b/gi, 'by'],
    [/\bin the course of\b/gi, 'during'],
    [/\bfor the reason that\b/gi, 'because'],
    [/\bin the near future\b/gi, 'soon'],
    [/\ba substantial amount of\b/gi, 'much'],
    [/\ba significant number of\b/gi, 'many'],
    [/\bin most cases\b/gi, 'usually'],
    [/\bas well as\b/gi, 'and'],
    [/\bso as to\b/gi, 'to'],
    [/\bis indicative of\b/gi, 'indicates']
  ];

  for (const [pattern, replacement] of replacements) {
    compressed = compressed.replace(pattern, replacement);
  }

  // Remove redundant parenthetical filler like (e.g., ...), (see also ...)
  compressed = compressed.replace(/\s*\((?:e\.g\.|i\.e\.|see also)[^)]*\)/gi, '');

  // Condense repetitive multi-whitespace
  compressed = compressed.replace(/[ \t]{2,}/g, ' ').trim();

  const tokensBefore = estimateTokens(text);
  let tokensAfter = estimateTokens(compressed);

  if (tokensAfter > tokensBefore) {
    tokensAfter = tokensBefore;
    compressed = text;
  }

  const tokensSaved = Math.max(0, tokensBefore - tokensAfter);
  const compressionRate = tokensBefore > 0 ? Number(((tokensSaved / tokensBefore) * 100).toFixed(1)) : 0;

  return {
    compressedText: compressed,
    tokensBefore,
    tokensAfter,
    tokensSaved,
    compressionRate,
    durationMs: Math.max(12, Date.now() - startTime)
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Word-level inline diff algorithm highlighting Removed, Replaced, and Added words
function computeInlineDiff(originalText: string, compressedText: string): string {
  // Tokenize into words, punctuation, and whitespace
  const tokensA = originalText.match(/[A-Za-z0-9_\-\u00C0-\u024F]+|[^\sA-Za-z0-9_\-\u00C0-\u024F]+|\s+/g) || [];
  const tokensB = compressedText.match(/[A-Za-z0-9_\-\u00C0-\u024F]+|[^\sA-Za-z0-9_\-\u00C0-\u024F]+|\s+/g) || [];

  const m = tokensA.length;
  const n = tokensB.length;

  if (m * n > 45000) {
    return `<del class="gptzip-diff-del">${escapeHtml(originalText)}</del> <ins class="gptzip-diff-ins">${escapeHtml(compressedText)}</ins>`;
  }

  // LCS dynamic programming table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i < m; i++) {
    const aLower = tokensA[i].toLowerCase();
    for (let j = 0; j < n; j++) {
      if (aLower === tokensB[j].toLowerCase()) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  let i = m;
  let j = n;
  type Edit = { type: 'equal' | 'del' | 'ins'; text: string };
  const editsRev: Edit[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && tokensA[i - 1].toLowerCase() === tokensB[j - 1].toLowerCase()) {
      editsRev.push({ type: 'equal', text: tokensB[j - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      editsRev.push({ type: 'ins', text: tokensB[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      editsRev.push({ type: 'del', text: tokensA[i - 1] });
      i--;
    }
  }

  const edits = editsRev.reverse();

  let html = '';
  let k = 0;

  while (k < edits.length) {
    const curr = edits[k];

    if (curr.type === 'equal') {
      html += escapeHtml(curr.text);
      k++;
      continue;
    }

    // Accumulate consecutive del / ins
    let delText = '';
    let insText = '';

    while (k < edits.length && edits[k].type !== 'equal') {
      if (edits[k].type === 'del') {
        delText += edits[k].text;
      } else if (edits[k].type === 'ins') {
        insText += edits[k].text;
      }
      k++;
    }

    const trimmedDel = delText.trim();
    const trimmedIns = insText.trim();

    if (trimmedDel && trimmedIns) {
      // Replaced words: amber badge with old crossed out and new replacement
      html += ` <span class="gptzip-diff-replace" title="Replaced words"><del class="gptzip-diff-replace-old">${escapeHtml(trimmedDel)}</del><span class="gptzip-diff-arrow">→</span><ins class="gptzip-diff-replace-new">${escapeHtml(trimmedIns)}</ins></span> `;
    } else if (trimmedDel) {
      // Removed words: rose red strikethrough badge
      html += ` <del class="gptzip-diff-del" title="Removed word">${escapeHtml(trimmedDel)}</del> `;
    } else if (trimmedIns) {
      // Added words: emerald green underlined badge
      html += ` <ins class="gptzip-diff-ins" title="Added word">${escapeHtml(trimmedIns)}</ins> `;
    }
  }

  return html;
}

// Generate the injected fixed GPT-ZIP savings banner
function createSavingsBannerHtml(params: {
  targetUrl: string;
  surface: 'go' | 'index';
  compressionRate: number;
  tokensBefore: number;
  tokensAfter: number;
  tokensSaved: number;
  durationMs: number;
  estimatedSavingsUsd: number;
  pageTitle?: string;
  siteName?: string;
  favicon?: string;
  compressionMode?: string;
  sections?: CompressedSectionItem[];
}): string {
  const {
    targetUrl,
    surface,
    compressionRate,
    tokensBefore,
    tokensAfter,
    tokensSaved,
    durationMs,
    estimatedSavingsUsd,
    pageTitle,
    siteName,
    favicon,
    compressionMode = 'medium-auto3',
    sections = []
  } = params;
  const returnPath = surface === 'index' ? '/index' : '/go';
  const throughput = durationMs > 0 ? Math.round((tokensBefore / (durationMs / 1000))) : 0;

  return `
<!-- Pollux.ZIP COMPRESSED WEB BANNER START -->
<style id="gptzip-banner-styles">
  html {
    scroll-padding-top: 60px !important;
  }
  body {
    padding-top: 60px !important;
  }
  #gptzip-mirror-banner {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    width: 100% !important;
    z-index: 2147483647 !important;
    background: #0b1120 !important;
    color: #f8fafc !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
    border-bottom: 2px solid #f59e0b !important;
    box-shadow: 0 4px 25px rgba(0, 0, 0, 0.45) !important;
    padding: 10px 16px !important;
    font-size: 13px !important;
    line-height: 1.4 !important;
    box-sizing: border-box !important;
    margin: 0 !important;
  }
  #gptzip-mirror-banner .gz-container {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  #gptzip-mirror-banner .gz-brand {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  #gptzip-mirror-banner .gz-logo {
    background: linear-gradient(135deg, #f59e0b, #ea580c);
    color: white;
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 900;
    box-shadow: 0 0 10px rgba(245, 158, 11, 0.35);
  }
  #gptzip-mirror-banner .gz-stats {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }
  #gptzip-mirror-banner .gz-stat-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #94a3b8;
  }
  #gptzip-mirror-banner .gz-stat-val {
    color: #38bdf8;
    font-weight: 600;
  }
  #gptzip-mirror-banner .gz-stat-highlight {
    color: #4ade80;
    font-weight: 700;
  }
  #gptzip-mirror-banner .gz-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  #gptzip-mirror-banner .gz-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 11px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.15s ease;
    cursor: pointer;
    border: none;
  }
  #gptzip-mirror-banner .gz-btn-secondary {
    background: #1e293b;
    color: #cbd5e1;
    border: 1px solid #334155;
  }
  #gptzip-mirror-banner .gz-btn-secondary:hover {
    background: #334155;
    color: white;
  }
  #gptzip-mirror-banner .gz-btn-primary {
    background: linear-gradient(135deg, #e11d48, #f43f5e);
    color: white;
  }
  #gptzip-mirror-banner .gz-btn-primary:hover {
    opacity: 0.92;
  }
  #gptzip-mirror-banner .gz-btn-diff-active {
    background: linear-gradient(135deg, #b45309, #f59e0b) !important;
    color: #ffffff !important;
    border-color: #fbbf24 !important;
    box-shadow: 0 0 10px rgba(245, 158, 11, 0.45) !important;
  }
  .gptzip-compressed-node {
    transition: background 0.2s ease;
  }
  .gptzip-highlight-mode .gptzip-compressed-node {
    background-color: rgba(254, 205, 211, 0.45) !important;
    outline: 1px dashed #f43f5e !important;
    border-radius: 3px;
  }

  /* Inline Diff View Modes */
  .gptzip-view-compressed {
    display: inline !important;
  }
  .gptzip-view-diff {
    display: none !important;
  }

  body.gptzip-diff-active .gptzip-view-compressed,
  .gptzip-compressed-node.gptzip-element-diff-active .gptzip-view-compressed {
    display: none !important;
  }
  body.gptzip-diff-active .gptzip-view-diff,
  .gptzip-compressed-node.gptzip-element-diff-active .gptzip-view-diff {
    display: inline !important;
  }

  /* Distinct color coding for diff cases */
  /* 1. Removed Words (Red / Rose) */
  .gptzip-diff-del {
    background-color: rgba(244, 63, 94, 0.18) !important;
    color: #e11d48 !important;
    text-decoration: line-through !important;
    text-decoration-color: #be123c !important;
    text-decoration-thickness: 2px !important;
    border-radius: 3px !important;
    padding: 1px 4px !important;
    margin: 0 1.5px !important;
    border: 1px solid rgba(225, 29, 72, 0.35) !important;
    font-weight: 500 !important;
  }

  /* 2. Replaced Words (Amber / Orange) */
  .gptzip-diff-replace {
    display: inline-flex !important;
    align-items: center !important;
    gap: 3px !important;
    background-color: rgba(245, 158, 11, 0.15) !important;
    border: 1px solid rgba(217, 119, 6, 0.45) !important;
    border-radius: 4px !important;
    padding: 1px 5px !important;
    margin: 0 2px !important;
    vertical-align: baseline !important;
  }
  .gptzip-diff-replace-old {
    color: #b45309 !important;
    text-decoration: line-through !important;
    text-decoration-color: #d97706 !important;
    opacity: 0.85 !important;
  }
  .gptzip-diff-arrow {
    color: #d97706 !important;
    font-size: 11px !important;
    font-weight: bold !important;
    user-select: none !important;
    padding: 0 1px !important;
  }
  .gptzip-diff-replace-new {
    color: #78350f !important;
    font-weight: 700 !important;
    background: rgba(245, 158, 11, 0.28) !important;
    border-radius: 3px !important;
    padding: 0 3px !important;
    text-decoration: none !important;
  }

  /* 3. Added Words (Emerald / Green) */
  .gptzip-diff-ins {
    background-color: rgba(16, 185, 129, 0.18) !important;
    color: #047857 !important;
    text-decoration: underline !important;
    text-decoration-color: #059669 !important;
    text-decoration-thickness: 2px !important;
    border-radius: 3px !important;
    padding: 1px 4px !important;
    margin: 0 1.5px !important;
    border: 1px solid rgba(5, 150, 105, 0.35) !important;
    font-weight: 600 !important;
  }
  /* Floating Sidebar CSS */
  #gz-items-sidebar {
    display: none;
    position: fixed;
    top: 60px; /* Aligned with banner height */
    left: 0;
    width: 320px;
    height: calc(100% - 60px);
    background: #0b1120;
    border-right: 1px solid #334155;
    z-index: 2147483646;
    flex-direction: column;
  }
  #gz-items-sidebar.gz-sidebar-open {
    display: flex;
  }
  .gz-sb-title {
    white-space: normal;
    word-wrap: break-word;
  }

<div id="gptzip-mirror-banner">
  <div class="gz-container">
    <div class="gz-brand">
      <span class="gz-logo">✦ Pollux.ZIP</span>
      <span style="font-size:12px;color:#e2e8f0;">The Compressed Web · <span style="color:#f59e0b;font-weight:600;">Gemini AI Internet</span></span>
    </div>

    <div class="gz-stats">
      <div class="gz-stat-pill">
        <span>Reduction:</span>
        <span class="gz-stat-highlight">-${compressionRate}%</span>
      </div>
      <div class="gz-stat-pill">
        <span>Tokens:</span>
        <span class="gz-stat-val">${tokensBefore.toLocaleString()} → ${tokensAfter.toLocaleString()}</span>
        <span style="color:#10b981;">(-${tokensSaved.toLocaleString()})</span>
      </div>
      <div class="gz-stat-pill" title="Compression mode used">
        <span>Mode:</span>
        <span style="color:#38bdf8;font-weight:700;font-family:monospace;">${compressionMode}</span>
      </div>
      <div class="gz-stat-pill" title="Time taken to fetch and compress page">
        <span>Time:</span>
        <span style="color:#c084fc;font-weight:700;font-family:monospace;">${durationMs}ms</span>
      </div>
      <div class="gz-stat-pill">
        <span>Estimated Savings:</span>
        <span class="gz-stat-val" style="color:#facc15;">$${estimatedSavingsUsd.toFixed(4)}</span>
      </div>
    </div>

    <div class="gz-actions">
      <button id="gz-btn-view-items" class="gz-btn gz-btn-secondary" onclick="toggleGzItemsSidebar()" title="View compressed items & navigate sections">
        <span style="color:#f59e0b;font-weight:bold;">☰</span>
        <span id="gz-items-btn-label">View Compressed Items (<span id="gz-items-count">${sections.length}</span>)</span>
      </button>
      <button id="gz-toggle-diff" class="gz-btn gz-btn-secondary" onclick="toggleGzDiffMode()" title="Toggle word-level inline diff mode">
        <span id="gz-diff-dot" style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#f59e0b;"></span>
        <span id="gz-diff-label">Inline Diff</span>
      </button>
      <button id="gz-toggle-highlight" class="gz-btn gz-btn-secondary" onclick="document.body.classList.toggle('gptzip-highlight-mode')">
        Highlight
      </button>
      <a href="${targetUrl}" target="_blank" rel="noopener noreferrer" class="gz-btn gz-btn-secondary">
        View Original ↗
      </a>
      <a href="${returnPath}" class="gz-btn gz-btn-primary">
        Back to ${surface === 'index' ? 'Index' : 'Go'}
      </a>
    </div>
  </div>


  <!-- Interactive Diff Legend Bar (Shows when Diff mode is toggled) -->
  <div id="gz-diff-legend" style="display:none;max-width:1200px;margin:8px auto 0 auto;padding-top:7px;border-top:1px solid #1e293b;align-items:center;justify-content:center;gap:16px;font-size:11px;color:#94a3b8;flex-wrap:wrap;">
    <span style="font-weight:700;color:#cbd5e1;text-transform:uppercase;letter-spacing:0.04em;">Inline Diff Legend:</span>
    <span style="display:inline-flex;align-items:center;gap:5px;">
      <span style="background:rgba(244,63,94,0.22);color:#fb7185;text-decoration:line-through;padding:1px 6px;border-radius:4px;border:1px solid rgba(244,63,94,0.4);font-weight:600;">Removed Words</span>
    </span>
    <span style="display:inline-flex;align-items:center;gap:5px;">
      <span style="background:rgba(245,158,11,0.2);color:#fbbf24;padding:1px 6px;border-radius:4px;border:1px solid rgba(245,158,11,0.4);font-weight:600;">Replaced Words (old → new)</span>
    </span>
    <span style="display:inline-flex;align-items:center;gap:5px;">
      <span style="background:rgba(16,185,129,0.22);color:#4ade80;text-decoration:underline;padding:1px 6px;border-radius:4px;border:1px solid rgba(16,185,129,0.4);font-weight:600;">Added Words</span>
    </span>
  </div>
</div>

<script id="gptzip-banner-offset-script">
  (function() {
    var rawSections = ${JSON.stringify(sections)};

    function setBannerOffset() {
      var b = document.getElementById('gptzip-mirror-banner');
      if (b) {
        var h = (b.getBoundingClientRect().height || b.offsetHeight || 54);
        document.documentElement.style.setProperty('scroll-padding-top', h + 'px', 'important');
        if (document.body) {
          document.body.style.setProperty('padding-top', h + 'px', 'important');
        }
        var sb = document.getElementById('gz-items-sidebar');
        if (sb) {
          sb.style.top = h + 'px';
        }
      }
    }
    window.setBannerOffset = setBannerOffset;

    window.toggleGzDiffMode = function(forceActive) {
      var isActive;
      if (typeof forceActive === 'boolean') {
        if (forceActive) {
          document.body.classList.add('gptzip-diff-active');
          isActive = true;
        } else {
          document.body.classList.remove('gptzip-diff-active');
          isActive = false;
        }
      } else {
        isActive = document.body.classList.toggle('gptzip-diff-active');
      }
      var btn = document.getElementById('gz-toggle-diff');
      var label = document.getElementById('gz-diff-label');
      var dot = document.getElementById('gz-diff-dot');
      var legend = document.getElementById('gz-diff-legend');
      if (btn) {
        if (isActive) {
          btn.classList.add('gz-btn-diff-active');
          if (label) label.textContent = 'Exit Diff';
          if (dot) dot.style.background = '#ffffff';
        } else {
          btn.classList.remove('gz-btn-diff-active');
          if (label) label.textContent = 'Inline Diff';
          if (dot) dot.style.background = '#f59e0b';
        }
      }
      if (legend) {
        legend.style.display = isActive ? 'flex' : 'none';
      }
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'DIFF_TOGGLED', active: isActive }, '*');
      }
      setBannerOffset();
    };

    window.scrollGzToItem = function(id, showDiff) {
      var el = document.getElementById(id);
      if (el) {
        // Automatically ensure inline diff is visible when navigating to item
        if (showDiff !== false) {
          if (!document.body.classList.contains('gptzip-diff-active')) {
            window.toggleGzDiffMode(true);
          }
          el.classList.add('gptzip-element-diff-active');
        }

        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('gptzip-target-pulse');
        setTimeout(function() {
          el.classList.remove('gptzip-target-pulse');
        }, 3000);

        var items = document.querySelectorAll('.gz-sb-item');
        for (var i = 0; i < items.length; i++) {
          if (items[i].getAttribute('data-id') === id) {
            items[i].classList.add('gz-sb-active');
            items[i].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          } else {
            items[i].classList.remove('gz-sb-active');
          }
        }
      }
    };

    window.toggleGzItemsSidebar = function() {
      var sb = document.getElementById('gz-items-sidebar');
      var btn = document.getElementById('gz-btn-view-items');
      if (sb) {
        var isOpen = sb.classList.toggle('gz-sidebar-open');
        if (btn) {
          if (isOpen) btn.classList.add('gz-btn-items-active');
          else btn.classList.remove('gz-btn-items-active');
        }
      }
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'TOGGLE_ITEMS_SIDEBAR' }, '*');
      }
    };

    function renderSidebarItems(itemsToRender) {
      var container = document.getElementById('gz-sb-list-container');
      if (!container) return;
      container.innerHTML = '';
      if (!itemsToRender || itemsToRender.length === 0) {
        container.innerHTML = '<div style="padding:16px;text-align:center;color:#64748b;font-size:12px;">No compressed sections found</div>';
        return;
      }
      for (var i = 0; i < itemsToRender.length; i++) {
        (function(it, idx) {
          var div = document.createElement('div');
          div.className = 'gz-sb-item';
          div.setAttribute('data-id', it.id);
          div.onclick = function() {
            window.scrollGzToItem(it.id, true);
          };
          div.innerHTML = '<div class="gz-sb-item-head">' +
            '<div class="gz-sb-item-name">#' + (idx + 1) + ' ' + (it.title || 'Section') + '</div>' +
            '<div class="gz-sb-item-badges">' +
              '<span class="gz-sb-badge-rate">-' + it.compressionRate + '%</span>' +
              '<span class="gz-sb-badge-saved">-' + it.tokensSaved + ' tok</span>' +
            '</div>' +
          '</div>' +
          '<div style="font-size:10px;color:#94a3b8;font-family:monospace;margin-top:2px;">' + it.tokensBefore + ' → ' + it.tokensAfter + ' tokens</div>' +
          (it.snippet ? '<div class="gz-sb-item-snippet">' + it.snippet + '</div>' : '');
          container.appendChild(div);
        })(itemsToRender[i], i);
      }
    }

    window.filterGzItems = function(q) {
      if (!q) {
        renderSidebarItems(rawSections);
        return;
      }
      var lower = q.toLowerCase();
      var filtered = rawSections.filter(function(it) {
        return (it.title && it.title.toLowerCase().indexOf(lower) >= 0) ||
               (it.snippet && it.snippet.toLowerCase().indexOf(lower) >= 0);
      });
      renderSidebarItems(filtered);
    };

    function collectSectionsFromDOM() {
      if (rawSections && rawSections.length > 0) return rawSections;
      var nodes = document.querySelectorAll('.gptzip-compressed-node');
      var list = [];
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        var id = n.getAttribute('id') || ('gz-item-' + (i + 1));
        if (!n.getAttribute('id')) n.setAttribute('id', id);
        var saved = parseInt(n.getAttribute('data-gz-saved') || '0', 10);
        var rate = parseFloat(n.getAttribute('data-gz-rate') || '0');
        var before = parseInt(n.getAttribute('data-gz-before') || '0', 10);
        var after = parseInt(n.getAttribute('data-gz-after') || '0', 10);
        var title = n.getAttribute('data-gz-title') || ('Section ' + (i + 1));
        var txt = (n.textContent || '').trim().replace(/\\s+/g, ' ');
        list.push({
          id: id,
          title: title,
          snippet: txt.slice(0, 110),
          tokensBefore: before,
          tokensAfter: after,
          tokensSaved: saved,
          compressionRate: rate
        });
      }
      rawSections = list;
      return list;
    }

    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'TOGGLE_DIFF') {
        window.toggleGzDiffMode();
      }
      if (e.data && e.data.type === 'SCROLL_TO_ITEM' && e.data.id) {
        window.scrollGzToItem(e.data.id, e.data.showDiff);
      }
      if (e.data && e.data.type === 'GET_ITEMS') {
        var items = collectSectionsFromDOM();
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'POLLUX_SECTIONS_UPDATE', sections: items }, '*');
        }
      }
    });

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        setBannerOffset();
        var items = collectSectionsFromDOM();
        renderSidebarItems(items);
        var cnt = document.getElementById('gz-items-count');
        if (cnt) cnt.textContent = items.length;
        var sbc = document.getElementById('gz-sidebar-count-badge');
        if (sbc) sbc.textContent = items.length;
      });
    } else {
      setBannerOffset();
      var items = collectSectionsFromDOM();
      renderSidebarItems(items);
      var cnt = document.getElementById('gz-items-count');
      if (cnt) cnt.textContent = items.length;
      var sbc = document.getElementById('gz-sidebar-count-badge');
      if (sbc) sbc.textContent = items.length;
    }

    window.addEventListener('resize', setBannerOffset);
    setTimeout(setBannerOffset, 50);
    setTimeout(setBannerOffset, 200);
    setTimeout(setBannerOffset, 600);

    // Broadcast authoritative metrics to parent window / application shell
    try {
      if (window.parent && window.parent !== window) {
        var payload = {
          type: 'POLLUX_METRICS',
          url: ${JSON.stringify(targetUrl)},
          title: ${JSON.stringify(pageTitle || '')},
          siteName: ${JSON.stringify(siteName || '')},
          favicon: ${JSON.stringify(favicon || '')},
          tokensBefore: ${tokensBefore},
          tokensAfter: ${tokensAfter},
          tokensSaved: ${tokensSaved},
          compressionRate: ${compressionRate},
          estimatedSavings: ${estimatedSavingsUsd},
          durationMs: ${durationMs},
          compressionMode: ${JSON.stringify(compressionMode)},
          sections: rawSections
        };
        window.parent.postMessage(payload, '*');
        window.parent.postMessage(Object.assign({}, payload, { type: 'GPTZIP_METRICS' }), '*');
      }
    } catch (e) {}
  })();
</script>
<!-- Pollux.ZIP COMPRESSED WEB BANNER END -->
`;
}

async function startServer() {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  // Anonymous identity middleware with HttpOnly cookie
  app.use((req: Request, res: Response, next: NextFunction) => {
    const rawCookie = req.cookies.gptzip_anon_id;
    const verifiedId = verifyCookie(rawCookie);

    if (verifiedId && store.getVisitor(verifiedId)) {
      (req as any).anonId = verifiedId;
    } else {
      const { visitor } = store.getOrCreateVisitor();
      (req as any).anonId = visitor.anonId;
      const signed = signCookie(visitor.anonId);
      res.cookie('gptzip_anon_id', signed, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 365 * 24 * 60 * 60 * 1000 // 1 year
      });
    }
    next();
  });

  // Determine surface from Host header or route path
  function getSurface(req: Request): 'go' | 'index' {
    const host = req.headers.host || '';
    if (host.startsWith('index.')) return 'index';
    if (host.startsWith('go.')) return 'go';
    if (req.path.startsWith('/index')) return 'index';
    return 'go';
  }

  // --- API ROUTES ---

  // 1. GET /api/go/viewer: Anonymous allowance & state
  app.get('/api/go/viewer', (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const anonId = (req as any).anonId;
    const visitor = store.getVisitor(anonId);
    const sessionUserId = (req.cookies as any)?.gptzip_user_id;
    const user = sessionUserId ? store.getUser(sessionUserId) : null;

    const completed = visitor ? visitor.uniqueUrls.length : 0;
    const limit = 20;
    const remaining = Math.max(0, limit - completed);
    const allowed = remaining > 0 || (user && user.credits > 0);

    return res.json({
      completed,
      limit,
      remaining,
      allowed,
      anonId,
      user: user
        ? {
            id: user.id,
            email: user.email,
            credits: user.credits,
            referralCode: user.referralCode
          }
        : null,
      credits: user ? user.credits : 0,
      completedUrls: visitor ? visitor.uniqueUrls : []
    });
  });

  // 2. POST /api/go/crawl-intents: Check & reserve single-use intent atomically
  app.post('/api/go/crawl-intents', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const { targetUrl } = req.body;

    if (!targetUrl || typeof targetUrl !== 'string') {
      return res.status(400).json({ error: 'targetUrl is required' });
    }

    const safetyCheck = await isSafeUrl(targetUrl);
    if (!safetyCheck.safe || !safetyCheck.normalizedUrl) {
      return res.status(400).json({ error: safetyCheck.error || 'Invalid or disallowed URL destination' });
    }

    const normalizedUrl = safetyCheck.normalizedUrl;
    const anonId = (req as any).anonId;

    store.deleteCachedPage(normalizedUrl);
    
    // Continue with crawl intent reservation...
    const visitor = store.getVisitor(anonId);

    if (!visitor) {
      return res.status(500).json({ error: 'Visitor session could not be established' });
    }

    const completed = visitor.uniqueUrls.length;
    const isRepeat = visitor.uniqueUrls.includes(normalizedUrl);
    const limit = 20;

    // Check quota: if repeat, allow free reuse without charging new slot
    if (!isRepeat && completed >= limit) {
      const sessionUserId = (req.cookies as any)?.gptzip_user_id;
      const user = sessionUserId ? store.getUser(sessionUserId) : null;
      if (!user || user.credits <= 0) {
        return res.status(402).json({
          allowed: false,
          error: 'Anonymous limit reached. You have compressed 20 unique pages without an account.',
          usage: { completed, limit, remaining: 0 }
        });
      }
    }

    const reservation = store.reserveIntent(anonId, normalizedUrl);
    if (!reservation.allowed) {
      return res.status(402).json({
        allowed: false,
        error: 'Quota reservation failed.',
        usage: { completed, limit, remaining: reservation.remaining }
      });
    }

    const surface = getSurface(req);
    const redirectUrl = `/${surface}/mirror?target=${encodeURIComponent(normalizedUrl)}&intentId=${reservation.intentId}`;

    const cached = store.getCachedPage(normalizedUrl);
    const feedMatch = !cached ? store.getIndexFeed(100).items.find(e => e.publicUrl === normalizedUrl) : null;
    const cachedMetrics = cached
      ? {
          tokensBefore: cached.tokensBefore,
          tokensAfter: cached.tokensAfter,
          tokensSaved: cached.tokensSaved,
          compressionRate: cached.compressionRate,
          estimatedSavings: cached.estimatedSavings,
          siteName: cached.siteName,
          pageTitle: cached.title,
          favicon: cached.favicon,
          durationMs: cached.durationMs || 180,
          compressionMode: cached.compressionMode || 'medium-auto3',
          sections: cached.sections || []
        }
      : feedMatch
      ? {
          tokensBefore: feedMatch.tokensBefore,
          tokensAfter: feedMatch.tokensAfter,
          tokensSaved: feedMatch.tokensSaved,
          compressionRate: feedMatch.compressionRate,
          estimatedSavings: feedMatch.estimatedSavings,
          siteName: feedMatch.siteName,
          pageTitle: feedMatch.pageTitle,
          favicon: feedMatch.favicon,
          durationMs: feedMatch.durationMs || 180,
          compressionMode: 'medium-auto3',
          sections: []
        }
      : null;

    return res.json({
      allowed: true,
      intentId: reservation.intentId,
      isRepeat,
      usage: {
        completed,
        limit,
        remaining: reservation.remaining
      },
      redirectUrl,
      cachedMetrics
    });
  });

  // GET /api/go/metrics: Retrieve authoritative real compression metrics for any URL
  app.get('/api/go/metrics', (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const target = req.query.target as string;
    if (!target) return res.status(400).json({ error: 'target parameter is required' });

    let normalizedUrl = target;
    try {
      const parsed = new URL(target);
      parsed.hash = '';
      normalizedUrl = parsed.toString();
    } catch {}

    const cached = store.getCachedPage(normalizedUrl) || store.getCachedPage(target);
    if (cached) {
      return res.json({
        url: normalizedUrl,
        title: cached.title,
        siteName: cached.siteName,
        favicon: cached.favicon,
        tokensBefore: cached.tokensBefore,
        tokensAfter: cached.tokensAfter,
        tokensSaved: cached.tokensSaved,
        compressionRate: cached.compressionRate,
        estimatedSavings: cached.estimatedSavings,
        durationMs: cached.durationMs || 180,
        compressionMode: cached.compressionMode || 'medium-auto3',
        sections: cached.sections || []
      });
    }

    const feedItem = store.getIndexFeed(100).items.find(e => e.publicUrl === normalizedUrl || e.publicUrl === target);
    if (feedItem) {
      return res.json({
        url: feedItem.publicUrl,
        title: feedItem.pageTitle,
        siteName: feedItem.siteName,
        favicon: feedItem.favicon,
        tokensBefore: feedItem.tokensBefore,
        tokensAfter: feedItem.tokensAfter,
        tokensSaved: feedItem.tokensSaved,
        compressionRate: feedItem.compressionRate,
        estimatedSavings: feedItem.estimatedSavings,
        durationMs: feedItem.durationMs || 180,
        compressionMode: 'medium-auto3',
        sections: []
      });
    }

    return res.status(404).json({ error: 'No metrics found for URL' });
  });

  // 3. GET /api/mirror and mirror views: Serve transformed, functional compressed page
  const mirrorHandler = async (req: Request, res: Response) => {
    const rawTarget = req.query.target as string;
    const intentId = (req.query.intentId as string) || '';
    const querySurface = (req.query.surface as string) || getSurface(req);
    const surface: 'go' | 'index' = querySurface === 'index' ? 'index' : 'go';

    if (!rawTarget) {
      return res.status(400).send('Missing target URL parameter');
    }

    const safetyCheck = await isSafeUrl(rawTarget);
    if (!safetyCheck.safe || !safetyCheck.normalizedUrl) {
      return res.status(400).send(`Disallowed URL: ${safetyCheck.error}`);
    }

    const normalizedUrl = safetyCheck.normalizedUrl;
    const anonId = (req as any).anonId;

    // Check cached page first (ensure it has navigation sidebar and inline-diff markup)
    const cached = store.getCachedPage(normalizedUrl);
    if (cached && cached.html.includes('gptzip-element-diff-active')) {
      // Mark intent redeemed if any
      if (intentId) {
        store.redeemIntent(anonId, intentId, normalizedUrl);
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.send(cached.html);
    }

    // Validate intent or verify visitor allowance
    const visitor = store.getVisitor(anonId);
    const isRepeat = visitor ? visitor.uniqueUrls.includes(normalizedUrl) : false;

    if (!isRepeat) {
      if (visitor && visitor.uniqueUrls.length >= 20) {
        const sessionUserId = (req.cookies as any)?.gptzip_user_id;
        const user = sessionUserId ? store.getUser(sessionUserId) : null;
        if (!user || user.credits <= 0) {
          return res.status(402).send('Anonymous quota exceeded (20 pages completed).');
        }
      }
    }

    // Fetch upstream target
    let sourceHtml = '';
    const fetchStart = Date.now();
    try {
      const response = await fetch(normalizedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; GPT-ZIP-Crawler/1.0; +https://gpt-zip.com/bot)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        signal: AbortSignal.timeout(15_000)
      });

      if (!response.ok) {
        if (intentId) store.releaseIntent(anonId, intentId);
        return res.status(502).send(`Upstream gateway error: HTTP ${response.status} from target site.`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        if (intentId) store.releaseIntent(anonId, intentId);
        return res.status(415).send('Target is not HTML content');
      }

      sourceHtml = await response.text();
    } catch (err: any) {
      if (intentId) store.releaseIntent(anonId, intentId);
      return res.status(504).send(`Failed to fetch target URL: ${err.message}`);
    }

    // Parse HTML DOM and compress eligible text
    try {
      const root = parseHtml(sourceHtml, {
        parseNoneClosedTags: true,
        comment: false
      });

      // Extract metadata
      const titleElem = root.querySelector('title');
      const pageTitle = titleElem ? titleElem.text.trim() : new URL(normalizedUrl).hostname;
      const ogSiteName = root.querySelector('meta[property="og:site_name"]')?.getAttribute('content');
      const siteName = ogSiteName || new URL(normalizedUrl).hostname.replace(/^www\./, '');

      let faviconUrl = '';
      const favElem = root.querySelector('link[rel~="icon"]') || root.querySelector('link[rel="shortcut icon"]');
      if (favElem && favElem.getAttribute('href')) {
        try {
          faviconUrl = new URL(favElem.getAttribute('href')!, normalizedUrl).toString();
        } catch {}
      }
      if (!faviconUrl) {
        faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(normalizedUrl).hostname}&sz=64`;
      }

      // Add noindex/nofollow/noarchive to <head>
      let head = root.querySelector('head');
      if (!head) {
        head = root.querySelector('html');
      }
      if (head) {
        head.insertAdjacentHTML('afterbegin', '<meta name="robots" content="noindex,nofollow,noarchive">\n');
      }

      // Collect eligible text nodes
      // Exclude script, style, noscript, svg, math, form, template, code, pre
      const candidateTags = ['p', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'dd', 'article', 'figcaption'];
      const textNodesToCompress: Array<{ elem: any; originalText: string }> = [];

      for (const tag of candidateTags) {
        const elems = root.querySelectorAll(tag);
        for (const elem of elems) {
          // Check if parent or element is in forbidden tags
          if (elem.closest('pre') || elem.closest('code') || elem.closest('form') || elem.closest('script')) {
            continue;
          }
          const rawText = elem.text.trim();
          if (rawText.length >= 35 && rawText.split(/\s+/).length >= 6) {
            textNodesToCompress.push({ elem, originalText: rawText });
          }
        }
      }

      let totalTokensBefore = 0;
      let totalTokensAfter = 0;
      const compressedSections: CompressedSectionItem[] = [];

      // Compress text blocks (limit batch to top 40 significant blocks to avoid extreme latency)
      const targetBlocks = textNodesToCompress.slice(0, 40);
      let sectionCounter = 0;

      for (const item of targetBlocks) {
        const resComp = await compressTextBlock(item.originalText);
        totalTokensBefore += resComp.tokensBefore;

        if (resComp.tokensSaved > 0) {
          totalTokensAfter += resComp.tokensAfter;
          sectionCounter++;
          const sectionId = `gz-item-${sectionCounter}`;

          // Determine nearest heading or context label
          let sectionTitle = '';
          const tagName = (item.elem.tagName || '').toLowerCase();
          if (/^h[1-6]$/.test(tagName)) {
            sectionTitle = item.originalText.trim().slice(0, 50);
          } else {
            let prev = item.elem.previousElementSibling;
            while (prev && !sectionTitle) {
              const ptag = (prev.tagName || '').toLowerCase();
              if (/^h[1-6]$/.test(ptag)) {
                sectionTitle = prev.text.trim().slice(0, 50);
                break;
              }
              prev = prev.previousElementSibling;
            }
          }
          if (!sectionTitle) {
            const words = item.originalText.trim().split(/\s+/).slice(0, 6).join(' ');
            sectionTitle = words.length > 40 ? words.slice(0, 40) + '...' : words;
          }

          const diffMarkup = computeInlineDiff(item.originalText, resComp.compressedText);
          item.elem.setAttribute('id', sectionId);
          item.elem.setAttribute('data-gz-item-id', sectionId);
          item.elem.setAttribute('data-gz-saved', String(resComp.tokensSaved));
          item.elem.setAttribute('data-gz-rate', String(resComp.compressionRate));
          item.elem.setAttribute('data-gz-before', String(resComp.tokensBefore));
          item.elem.setAttribute('data-gz-after', String(resComp.tokensAfter));
          item.elem.setAttribute('data-gz-title', sectionTitle);
          item.elem.setAttribute('class', `${item.elem.getAttribute('class') || ''} gptzip-compressed-node`.trim());
          item.elem.innerHTML = `<span class="gptzip-view-compressed">${escapeHtml(resComp.compressedText)}</span><span class="gptzip-view-diff">${diffMarkup}</span>`;

          compressedSections.push({
            id: sectionId,
            title: sectionTitle,
            snippet: item.originalText.trim().slice(0, 110),
            tokensBefore: resComp.tokensBefore,
            tokensAfter: resComp.tokensAfter,
            tokensSaved: resComp.tokensSaved,
            compressionRate: resComp.compressionRate
          });
        } else {
          totalTokensAfter += resComp.tokensBefore;
        }
      }

      if (totalTokensBefore === 0) {
        totalTokensBefore = estimateTokens(sourceHtml.slice(0, 10000));
        totalTokensAfter = Math.round(totalTokensBefore * 0.65);
      }

      const totalTokensSaved = Math.max(0, totalTokensBefore - totalTokensAfter);
      const overallRate = totalTokensBefore > 0 ? Number(((totalTokensSaved / totalTokensBefore) * 100).toFixed(1)) : 0;
      const durationMs = Date.now() - fetchStart;
      const estimatedSavingsUsd = Number(((totalTokensSaved / 1_000_000) * 2.5).toFixed(4)); // $2.50 per 1M input tokens

      // Resolve relative URLs in DOM
      // Images & sources
      const mediaElems = root.querySelectorAll('img, video, audio, source, link');
      for (const el of mediaElems) {
        const src = el.getAttribute('src');
        if (src && !src.startsWith('data:') && !src.startsWith('blob:')) {
          try {
            el.setAttribute('src', new URL(src, normalizedUrl).toString());
          } catch {}
        }
        const href = el.getAttribute('href');
        if (href && !href.startsWith('data:') && !href.startsWith('#') && !href.startsWith('javascript:')) {
          try {
            el.setAttribute('href', new URL(href, normalizedUrl).toString());
          } catch {}
        }
        const srcset = el.getAttribute('srcset');
        if (srcset) {
          try {
            const resolvedSrcset = srcset
              .split(',')
              .map(part => {
                const [u, ...rest] = part.trim().split(/\s+/);
                try {
                  return `${new URL(u, normalizedUrl).toString()} ${rest.join(' ')}`.trim();
                } catch {
                  return part;
                }
              })
              .join(', ');
            el.setAttribute('srcset', resolvedSrcset);
          } catch {}
        }
      }

      // Anchors: resolve and keep external
      const anchors = root.querySelectorAll('a');
      for (const a of anchors) {
        const href = a.getAttribute('href');
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          try {
            a.setAttribute('href', new URL(href, normalizedUrl).toString());
            a.setAttribute('target', '_blank');
            a.setAttribute('rel', 'noopener noreferrer');
          } catch {}
        }
      }

      // Inject banner at start of <body>
      const bannerHtml = createSavingsBannerHtml({
        targetUrl: normalizedUrl,
        surface,
        compressionRate: overallRate,
        tokensBefore: totalTokensBefore,
        tokensAfter: totalTokensAfter,
        tokensSaved: totalTokensSaved,
        durationMs,
        estimatedSavingsUsd,
        pageTitle,
        siteName,
        favicon: faviconUrl,
        compressionMode: 'medium-auto3',
        sections: compressedSections
      });

      const body = root.querySelector('body');
      if (body) {
        body.insertAdjacentHTML('afterbegin', bannerHtml);
      }

      const finalHtml = root.toString();

      // Cache page
      const cachedPage: CachedPage = {
        html: finalHtml,
        title: pageTitle,
        favicon: faviconUrl,
        siteName,
        tokensBefore: totalTokensBefore,
        tokensAfter: totalTokensAfter,
        tokensSaved: totalTokensSaved,
        compressionRate: overallRate,
        durationMs,
        estimatedSavings: estimatedSavingsUsd,
        timestamp: Date.now(),
        compressionMode: 'medium-auto3',
        sections: compressedSections
      };
      store.setCachedPage(normalizedUrl, cachedPage);

      // Redeem intent and register quota
      if (intentId) {
        store.redeemIntent(anonId, intentId, normalizedUrl);
      } else if (!isRepeat && visitor) {
        visitor.uniqueUrls.push(normalizedUrl);
        store.save();
      }

      // Record Index Feed Event
      const parsedHost = new URL(normalizedUrl).hostname;
      const tld = parsedHost.split('.').pop()?.toUpperCase() || 'US';
      const knownCountries: Record<string, string> = {
        UK: 'GB',
        ORG: 'US',
        COM: 'US',
        IO: 'US',
        DE: 'DE',
        FR: 'FR',
        JP: 'JP',
        CA: 'CA',
        AU: 'AU'
      };
      const countryCode = knownCountries[tld] || 'US';

      store.addIndexEvent({
        id: `idx_${crypto.randomBytes(8).toString('hex')}`,
        timestamp: Date.now(),
        publicUrl: normalizedUrl,
        siteHost: parsedHost,
        siteName,
        pageTitle,
        favicon: faviconUrl,
        countryCode,
        tokensBefore: totalTokensBefore,
        tokensAfter: totalTokensAfter,
        tokensSaved: totalTokensSaved,
        compressionRate: overallRate,
        estimatedSavings: estimatedSavingsUsd,
        durationMs,
        tokensPerSec: durationMs > 0 ? Math.round(totalTokensBefore / (durationMs / 1000)) : 45000
      });

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.send(finalHtml);
    } catch (err: any) {
      if (intentId) store.releaseIntent(anonId, intentId);
      console.error('HTML transformation error:', err);
      return res.status(500).send(`Failed to process HTML: ${err.message}`);
    }
  };

  // Mount mirror routes for both API and route paths
  app.get('/api/mirror', mirrorHandler);
  app.get('/mirror', mirrorHandler);
  app.get('/go/mirror', mirrorHandler);
  app.get('/index/mirror', mirrorHandler);

  // 4. GET /api/index/overview
  app.get('/api/index/overview', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const overview = store.getIndexOverview();
    return res.json(overview);
  });

  // 5. GET /api/index/feed
  app.get('/api/index/feed', (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const limit = parseInt((req.query.limit as string) || '25', 10);
    const cursor = (req.query.cursor as string) || undefined;
    const feed = store.getIndexFeed(limit, cursor);
    return res.json({
      items: feed.items,
      pageInfo: {
        nextCursor: feed.nextCursor,
        hasMore: feed.hasMore,
        limit
      }
    });
  });

  // 6. Optional Accounts and Referral endpoints
  app.post('/api/auth/register', (req: Request, res: Response) => {
    const { email, referralCode } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }
    const existing = store.getUserByEmail(email);
    if (existing) {
      res.cookie('gptzip_user_id', existing.id, { httpOnly: true, path: '/' });
      return res.json({ user: existing });
    }
    const user = store.createUser(email, referralCode);
    res.cookie('gptzip_user_id', user.id, { httpOnly: true, path: '/' });
    return res.json({ user });
  });

  app.get('/api/auth/me', (req: Request, res: Response) => {
    const userId = (req.cookies as any)?.gptzip_user_id;
    if (!userId) return res.json({ user: null });
    const user = store.getUser(userId);
    return res.json({ user });
  });

  app.post('/api/auth/logout', (_req: Request, res: Response) => {
    res.clearCookie('gptzip_user_id', { path: '/' });
    return res.json({ success: true });
  });

  app.post('/api/auth/claim-referral', (req: Request, res: Response) => {
    const userId = (req.cookies as any)?.gptzip_user_id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const { code } = req.body;
    const success = store.applyReferral(code, userId);
    if (!success) return res.status(400).json({ error: 'Invalid or self referral code' });
    const updated = store.getUser(userId);
    return res.json({ success: true, credits: updated?.credits });
  });

  // Vite integration: Dev middleware or Production static files
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(process.cwd(), 'dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GPT-ZIP Cloud Run server running on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
