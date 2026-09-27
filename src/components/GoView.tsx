import React, { useState } from 'react';
import { Globe, ArrowRight, Loader2, AlertCircle, Trash2, ExternalLink, Sparkles, CheckCircle2, History } from 'lucide-react';
import { UsageState, HistoryItem } from '../types';
import { createCrawlIntent, saveLocalHistoryItem, removeLocalHistoryItem } from '../lib/api';

interface GoViewProps {
  usage: UsageState | null;
  history: HistoryItem[];
  onRefreshUsage: () => void;
  onUpdateHistory: (history: HistoryItem[]) => void;
  onOpenAuth: () => void;
  onOpenMirror: (url: string) => void;
}

const SAMPLE_PRESETS = [
  {
    name: 'Wikipedia: Transformer',
    url: 'https://en.wikipedia.org/wiki/Transformer_(deep_learning_architecture)'
  },
  {
    name: 'arXiv: Attention Is All You Need',
    url: 'https://arxiv.org/html/1706.03762v7'
  },
  {
    name: 'arXiv: BERT',
    url: 'https://arxiv.org/html/1810.04805v2'
  },
  {
    name: 'arXiv: GPT-3',
    url: 'https://arxiv.org/html/2005.14165v9'
  },
  {
    name: 'arXiv: AlphaGeometry',
    url: 'https://arxiv.org/html/2309.05669v1'
  },
  {
    name: 'arXiv: Gemini',
    url: 'https://arxiv.org/html/2312.11805v3'
  },
  {
    name: 'arXiv: AlphaFold 3',
    url: 'https://arxiv.org/html/2405.14088v1'
  }
];

export const GoView: React.FC<GoViewProps> = ({
  usage,
  history,
  onRefreshUsage,
  onUpdateHistory,
  onOpenAuth,
  onOpenMirror
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const remaining = usage ? usage.remaining : 20;
  const completed = usage ? usage.completed : 0;
  const isLimitReached = remaining <= 0 && (!usage?.user || usage.user.credits <= 0);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    const trimmed = urlInput.trim();
    if (!trimmed) {
      setErrorMessage('Please enter a website URL.');
      return;
    }

    let target = trimmed;
    if (!/^https?:\/\//i.test(target)) {
      target = `https://${target}`;
    }

    try {
      new URL(target);
    } catch {
      setErrorMessage('Please enter a valid website URL (e.g., https://example.com).');
      return;
    }

    setLoading(true);
    setStatusMessage('Checking allowance & reserving intent...');

    try {
      // Step 1: Request crawl intent from server
      const intentRes = await createCrawlIntent(target);
      setStatusMessage('Fetching target page & compressing text...');

      // Save to local history with real cached metrics if available, or initialize pending
      const parsedHost = new URL(target).hostname;
      const cm = intentRes.cachedMetrics;
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
      const updatedHistory = saveLocalHistoryItem(historyEntry);
      onUpdateHistory(updatedHistory);

      // Refresh server-side viewer quota
      onRefreshUsage();

      // Step 2: Open mirror page
      if (intentRes.redirectUrl) {
        onOpenMirror(intentRes.redirectUrl);
      } else {
        onOpenMirror(`/go/mirror?target=${encodeURIComponent(target)}&intentId=${intentRes.intentId}`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to compress this page.');
    } finally {
      setLoading(false);
      setStatusMessage(null);
    }
  };

  const handleDeleteHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = removeLocalHistoryItem(id);
    onUpdateHistory(updated);
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* Hero Section */}
      <div className="text-center mt-6 sm:mt-10 mb-8 max-w-2xl px-4">
        {/* Gemini Constellation Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-200/90 text-amber-800 text-xs font-semibold mb-4 shadow-xs">
          <span className="text-amber-500">✦</span>
          <span>Brightest Star of the Gemini Constellation</span>
          <span className="text-amber-300">·</span>
          <span className="text-amber-900 font-bold">New Internet for AI Agents</span>
        </div>

        <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight bg-gradient-to-r from-amber-600 via-orange-500 to-amber-500 bg-clip-text text-transparent pb-1">
          Pollux<span className="text-slate-900">.ZIP</span>
        </h1>
        <p className="mt-3 text-lg sm:text-xl font-bold text-slate-800">
          The Compressed Web for AI Agents, like Gemini
        </p>
        <p className="mt-2 text-sm text-slate-500 max-w-xl mx-auto">
          Strip boilerplate clutter and bloated HTML. Stream clean, token-dense, structured web mirrors directly into Gemini and LLM context windows.
        </p>
      </div>

      {/* URL Input Form Card */}
      <div className="w-full max-w-3xl px-4">
        <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-xl shadow-amber-950/5 border border-slate-200/90 backdrop-blur-sm transition-all hover:border-slate-300">
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                <Globe className="w-5 h-5 text-amber-500/80" />
              </div>
              <input
                type="text"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                placeholder="https://example.com/article"
                disabled={loading}
                className="w-full pl-11 pr-4 py-3.5 sm:py-4 bg-slate-50/70 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 text-base focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all font-mono text-sm sm:text-base"
              />
            </div>

            <button
              type="submit"
              disabled={loading || (isLimitReached && !urlInput.trim())}
              className={`px-7 py-3.5 sm:py-4 rounded-2xl font-bold text-white shadow-md flex items-center justify-center gap-2 transition-all ${
                loading
                  ? 'bg-amber-400 cursor-not-allowed'
                  : isLimitReached
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-600 via-orange-500 to-amber-500 hover:from-amber-500 hover:to-orange-600 active:scale-[0.98] shadow-amber-500/25'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Compressing</span>
                </>
              ) : (
                <>
                  <span>Compress</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Preset Quick Links */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center flex-wrap gap-2 text-xs">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" /> Agent Presets:
            </span>
            {SAMPLE_PRESETS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setUrlInput(p.url);
                  setErrorMessage(null);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-amber-50 hover:text-amber-800 text-slate-600 transition-colors font-medium"
              >
                {p.name}
              </button>
            ))}
          </div>

          {/* Feedback & Progress Status */}
          {statusMessage && (
            <div className="mt-4 p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs flex items-center gap-2 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Inline Error Message */}
          {errorMessage && (
            <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <div className="flex-1">{errorMessage}</div>
              {isLimitReached && (
                <button
                  onClick={onOpenAuth}
                  className="font-bold underline text-red-800 hover:text-red-950 shrink-0"
                >
                  Get Bonus Credits
                </button>
              )}
            </div>
          )}

          {/* Anonymous Allowance Footer */}
          <div className="mt-5 pt-4 border-t border-slate-100/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>
                <strong>{remaining} of 20</strong> anonymous new pages remaining. No login required.
              </span>
            </div>
            <div className="text-slate-400">
              Repeat visits to cached pages do not use allowance.
            </div>
          </div>
        </div>
      </div>

      {/* Compressed History Section */}
      <div className="w-full max-w-3xl px-4 mt-10 mb-16">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-rose-600" />
            <h2 className="text-base font-bold text-slate-800">
              Compressed History
            </h2>
            <span className="text-xs text-slate-400">({history.length}/20 in browser)</span>
          </div>
          {history.length > 0 && (
            <span className="text-xs text-slate-400">
              Authoritative quota tracked server-side
            </span>
          )}
        </div>

        {history.length === 0 ? (
          <div className="w-full p-8 rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 text-center flex flex-col items-center justify-center text-slate-400">
            <Globe className="w-8 h-8 text-slate-300 mb-2 stroke-1" />
            <p className="text-sm font-medium text-slate-500">No compressed pages yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Enter any public web page URL above or click a preset to compress your first page.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm divide-y divide-slate-100 overflow-hidden">
            {history.map(item => (
              <div
                key={item.id}
                onClick={() => onOpenMirror(`/go/mirror?target=${encodeURIComponent(item.url)}`)}
                className="p-3.5 sm:p-4 hover:bg-rose-50/40 transition-colors flex items-center justify-between gap-3 cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <img
                    src={item.favicon}
                    alt=""
                    onError={(e: any) => {
                      e.target.src = 'https://www.google.com/s2/favicons?domain=example.com&sz=64';
                    }}
                    className="w-5 h-5 rounded-sm object-contain shrink-0 bg-slate-100 p-0.5"
                  />
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
                    <p className="text-xs text-slate-400 truncate mt-0.5 font-mono">
                      {item.url}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-5 shrink-0">
                  <div className="text-right hidden sm:block">
                    {item.compressionRate > 0 ? (
                      <>
                        <div className="text-xs font-semibold text-slate-700">
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

                  <div className="flex items-center gap-1">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onOpenMirror(`/go/mirror?target=${encodeURIComponent(item.url)}`);
                      }}
                      title="Open Compressed Mirror"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-white transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <button
                      onClick={e => handleDeleteHistory(item.id, e)}
                      title="Delete from local history"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-white transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
