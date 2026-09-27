import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Globe2,
  DollarSign,
  TrendingDown,
  Layers,
  ArrowRight,
  Loader2,
  ExternalLink,
  Trash2,
  RefreshCw,
  Search,
  Sparkles
} from 'lucide-react';
import { IndexOverview, IndexFeedItem, HistoryItem, UsageState } from '../types';
import { fetchIndexOverview, fetchIndexFeed, createCrawlIntent, saveLocalHistoryItem, removeLocalHistoryItem } from '../lib/api';

interface IndexViewProps {
  usage: UsageState | null;
  history: HistoryItem[];
  onRefreshUsage: () => void;
  onUpdateHistory: (history: HistoryItem[]) => void;
  onOpenMirror: (url: string) => void;
}

export const IndexView: React.FC<IndexViewProps> = ({
  usage,
  history,
  onRefreshUsage,
  onUpdateHistory,
  onOpenMirror
}) => {
  const [overview, setOverview] = useState<IndexOverview | null>(null);
  const [feedItems, setFeedItems] = useState<IndexFeedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeTab, setActiveTab] = useState<'global' | 'history'>('global');

  // Compress now card input
  const [quickUrl, setQuickUrl] = useState('');
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);

  // Load overview and feed
  const loadData = useCallback(async () => {
    try {
      const [ovData, feedData] = await Promise.all([
        fetchIndexOverview(),
        fetchIndexFeed(20)
      ]);
      setOverview(ovData);
      setFeedItems(feedData.items);
      setNextCursor(feedData.pageInfo.nextCursor);
      setHasMore(feedData.pageInfo.hasMore);
    } catch (err) {
      console.error('Failed to load Index data:', err);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Auto-refresh when tab gains focus
    const handleFocus = () => loadData();
    window.addEventListener('focus', handleFocus);
    // Periodic refresh every 45s
    const timer = setInterval(loadData, 45000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(timer);
    };
  }, [loadData]);

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const moreData = await fetchIndexFeed(20, nextCursor);
      setFeedItems(prev => [...prev, ...moreData.items]);
      setNextCursor(moreData.pageInfo.nextCursor);
      setHasMore(moreData.pageInfo.hasMore);
    } catch (err) {
      console.error('Failed to load more feed items:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleQuickCompress = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuickError(null);
    let target = quickUrl.trim();
    if (!target) return;
    if (!/^https?:\/\//i.test(target)) {
      target = `https://${target}`;
    }

    setQuickLoading(true);
    try {
      const res = await createCrawlIntent(target);
      const parsedHost = new URL(target).hostname;
      const cm = res.cachedMetrics;
      const historyEntry: HistoryItem = {
        id: `hist_${Date.now()}`,
        url: target,
        title: cm?.pageTitle || parsedHost,
        siteName: cm?.siteName || parsedHost.replace(/^www\./, ''),
        favicon: cm?.favicon || `https://www.google.com/s2/favicons?domain=${parsedHost}&sz=64`,
        tokensSaved: cm ? cm.tokensSaved : 0,
        estimatedUsdSaved: cm ? cm.estimatedSavings : 0,
        compressionRate: cm ? cm.compressionRate : 0,
        timestamp: Date.now()
      };
      const updated = saveLocalHistoryItem(historyEntry);
      onUpdateHistory(updated);
      onRefreshUsage();

      onOpenMirror(`/index/mirror?target=${encodeURIComponent(target)}&intentId=${res.intentId}`);
    } catch (err: any) {
      setQuickError(err.message || 'Compression request failed');
    } finally {
      setQuickLoading(false);
    }
  };

  const handleDeleteHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = removeLocalHistoryItem(id);
    onUpdateHistory(updated);
  };

  const remaining = usage ? usage.remaining : 20;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {/* Title */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-200/90 text-amber-800 text-xs font-semibold mb-3 shadow-xs">
          <span className="text-amber-500">✦</span>
          <span>Pollux Catalog</span>
          <span className="text-amber-300">·</span>
          <span className="text-amber-900 font-bold">The Internet for AI Agents (like Gemini)</span>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600 bg-clip-text text-transparent">
          The Compressed Web Index
        </h1>
        <p className="mt-2 text-slate-600 text-sm sm:text-base max-w-3xl">
          Live catalog of public websites compressed for Gemini and autonomous AI agents.
          Preserves semantic structure, code blocks, and citations while drastically reducing token footprint.
        </p>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-8">
        {/* All-time totals (Wider: col-span-5) */}
        <div className="md:col-span-5 bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-amber-500" />
              All-Time Pollux Index Totals
            </span>
            <button
              onClick={loadData}
              title="Refresh statistics"
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                ${overview ? overview.totals.estimatedSavingsUsdTotal.toFixed(2) : '0.00'}
              </div>
              <div className="text-xs text-slate-500 mt-1 font-medium">USD Saved</div>
            </div>

            <div>
              <div className="text-2xl sm:text-3xl font-black text-amber-600 tracking-tight">
                {overview ? (overview.totals.tokensSavedTotal > 1000 ? `${(overview.totals.tokensSavedTotal / 1000).toFixed(1)}k` : overview.totals.tokensSavedTotal) : '0'}
              </div>
              <div className="text-xs text-slate-500 mt-1 font-medium">Tokens Saved</div>
            </div>

            <div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {overview ? overview.totals.pagesTotal : '0'}
              </div>
              <div className="text-xs text-slate-500 mt-1 font-medium">Pages Compressed</div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Gemini context cost basis: $2.50 / 1M input</span>
            <span className="text-emerald-600 font-semibold">Avg -38.2% reduction</span>
          </div>
        </div>

        {/* Top Countries (col-span-3 or 4) */}
        <div className="md:col-span-3 bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-3">
            <Globe2 className="w-3.5 h-3.5 text-blue-500" />
            Top Countries
          </div>

          <div className="space-y-2">
            {overview?.topCountries.map((c, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-400 w-3">{idx + 1}</span>
                  <span className="font-bold bg-slate-100 px-1.5 py-0.5 rounded text-[11px] text-slate-700">
                    {c.countryCode}
                  </span>
                  <span className="text-slate-700 truncate max-w-[90px]">{c.countryName}</span>
                </div>
                <span className="font-semibold text-slate-600">{c.pageCount} pages</span>
              </div>
            ))}
            {(!overview || overview.topCountries.length === 0) && (
              <div className="text-xs text-slate-400 py-2">Cataloging countries...</div>
            )}
          </div>

          <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-400 text-right">
            Geographic coverage
          </div>
        </div>

        {/* Top Sites (col-span-4) */}
        <div className="md:col-span-4 bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-3">
            <Layers className="w-3.5 h-3.5 text-amber-500" />
            Top Sites Compressed
          </div>

          <div className="space-y-2">
            {overview?.topSites.map((s, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono font-bold text-slate-400 w-3">{idx + 1}</span>
                  {s.favicon && (
                    <img
                      src={s.favicon}
                      alt=""
                      onError={(e: any) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = 'https://www.google.com/s2/favicons?domain=example.com&sz=64';
                      }}
                      className="w-3.5 h-3.5 rounded-sm object-contain"
                    />
                  )}
                  <span className="text-slate-800 font-medium truncate max-w-[130px]" title={s.host}>
                    {s.displayName}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 font-semibold">{s.pageCount}</span>
                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1 py-0.2 rounded">
                    +{(s.tokensSaved / 1000).toFixed(0)}k
                  </span>
                </div>
              </div>
            ))}
            {(!overview || overview.topSites.length === 0) && (
              <div className="text-xs text-slate-400 py-2">Cataloging sites...</div>
            )}
          </div>

          <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-400 text-right">
            By frequency & tokens saved
          </div>
        </div>
      </div>

      {/* Compress A Page Now Card */}
      <div className="bg-gradient-to-r from-rose-50 via-white to-rose-50/50 rounded-3xl p-6 border border-rose-200/80 shadow-sm mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-rose-500" />
              Compress a public page now
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Instant compression without login. <strong>{remaining} of 20</strong> anonymous slots available.
            </p>
          </div>

          <form onSubmit={handleQuickCompress} className="flex items-center gap-2 max-w-md w-full">
            <input
              type="text"
              value={quickUrl}
              onChange={e => setQuickUrl(e.target.value)}
              placeholder="https://example.com/article"
              disabled={quickLoading}
              className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <button
              type="submit"
              disabled={quickLoading}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-500 text-white font-bold text-xs sm:text-sm shadow-sm hover:from-rose-500 hover:to-red-600 disabled:opacity-50 flex items-center gap-1.5 shrink-0"
            >
              {quickLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Compress</span>}
            </button>
          </form>
        </div>

        {quickError && (
          <div className="mt-3 text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">
            {quickError}
          </div>
        )}
      </div>

      {/* Recent Activity Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        {/* Header & Tabs */}
        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Recent Activity</h2>
          </div>

          {/* Segmented Tab Control */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/60 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('global')}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                activeTab === 'global'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Global Feed
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                activeTab === 'history'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              My History ({history.length})
            </button>
          </div>
        </div>

        {/* Tab 1: Global Feed */}
        {activeTab === 'global' && (
          <div>
            <div className="divide-y divide-slate-100">
              {feedItems.map(item => {
                const timeAgo = Math.round((Date.now() - item.timestamp) / 60000);
                const timeStr = timeAgo < 1 ? 'Just now' : timeAgo < 60 ? `${timeAgo}m ago` : `${Math.round(timeAgo / 60)}h ago`;

                return (
                  <div
                    key={item.id}
                    onClick={() => onOpenMirror(`/index/mirror?target=${encodeURIComponent(item.publicUrl)}`)}
                    className="p-4 sm:p-5 hover:bg-rose-50/30 transition-colors flex items-center justify-between gap-4 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      {item.favicon && (
                        <img
                          src={item.favicon}
                          alt=""
                          onError={(e: any) => {
                            e.target.src = 'https://www.google.com/s2/favicons?domain=example.com&sz=64';
                          }}
                          className="w-6 h-6 rounded-md object-contain shrink-0 bg-slate-50 p-0.5 border border-slate-100"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-slate-900 truncate">
                            {item.siteName}
                          </span>
                          {item.countryCode && (
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {item.countryCode}
                            </span>
                          )}
                          <span className="text-xs text-slate-400">·</span>
                          <span className="text-xs text-slate-400">{timeStr}</span>
                          <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                            -{item.compressionRate}%
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 font-medium truncate mt-0.5">
                          {item.pageTitle}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono truncate mt-0.5">
                          {item.publicUrl}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right hidden sm:block">
                        <div className="text-xs font-semibold text-slate-800">
                          {item.tokensSaved.toLocaleString()} tokens saved
                        </div>
                        <div className="text-[11px] text-slate-400">
                          ~${item.estimatedSavings.toFixed(4)} saved · {item.durationMs}ms
                        </div>
                      </div>

                      <div className="p-2 rounded-xl text-slate-300 group-hover:text-rose-600 group-hover:bg-rose-100/60 transition-colors">
                        <ExternalLink className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Load More / Caught Up State */}
            <div className="p-6 border-t border-slate-100 text-center">
              {hasMore ? (
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors inline-flex items-center gap-2"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                      <span>Loading more activity...</span>
                    </>
                  ) : (
                    <span>Load more entries</span>
                  )}
                </button>
              ) : (
                <p className="text-xs text-slate-400">
                  Caught up with newest compressed web entries
                </p>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: My History */}
        {activeTab === 'history' && (
          <div>
            {history.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <p className="text-sm font-medium text-slate-600">No browser history recorded</p>
                <p className="text-xs text-slate-400 mt-1">
                  Compress pages in Go or Index to build your local mirror catalog.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {history.map(item => (
                  <div
                    key={item.id}
                    onClick={() => onOpenMirror(`/index/mirror?target=${encodeURIComponent(item.url)}`)}
                    className="p-4 sm:p-5 hover:bg-rose-50/30 transition-colors flex items-center justify-between gap-4 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      {item.favicon && (
                        <img
                          src={item.favicon}
                          alt=""
                          onError={(e: any) => {
                            e.target.src = 'https://www.google.com/s2/favicons?domain=example.com&sz=64';
                          }}
                          className="w-6 h-6 rounded-md object-contain shrink-0 bg-slate-50 p-0.5 border border-slate-100"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-900 truncate">
                            {item.siteName}
                          </span>
                          {item.compressionRate > 0 ? (
                            <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                              -{item.compressionRate}%
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-500 font-medium bg-slate-100 px-1.5 py-0.5 rounded">
                              Mirrored
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 font-mono truncate mt-0.5">
                          {item.url}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right hidden sm:block">
                        {item.compressionRate > 0 ? (
                          <>
                            <div className="text-xs font-semibold text-slate-800">
                              {item.tokensSaved.toLocaleString()} tokens saved
                            </div>
                            <div className="text-[11px] text-slate-400">
                              ~${item.estimatedUsdSaved.toFixed(4)} saved
                            </div>
                          </>
                        ) : (
                          <div className="text-xs text-slate-400">
                            View mirror metrics
                          </div>
                        )}
                      </div>

                      <button
                        onClick={e => handleDeleteHistory(item.id, e)}
                        title="Delete from local history"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-100 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
