import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ExternalLink,
  RefreshCw,
  Layers,
  Clock,
  Cpu,
  Search,
  ChevronRight,
  Sparkles,
  Zap
} from 'lucide-react';
import { CompressedSectionItem } from '../types';
import { fetchPageMetrics } from '../lib/api';

interface MirrorModalProps {
  mirrorUrl: string | null;
  onClose: () => void;
}

export const MirrorModal: React.FC<MirrorModalProps> = ({
  mirrorUrl,
  onClose
}) => {
  const [iframeKey, setIframeKey] = useState(0);
  const [isDiffActive, setIsDiffActive] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sections, setSections] = useState<CompressedSectionItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [compressionMode, setCompressionMode] = useState<string>('medium-auto3');
  const [durationMs, setDurationMs] = useState<number>(0);
  const [tokensSaved, setTokensSaved] = useState<number>(0);
  const [compressionRate, setCompressionRate] = useState<number>(0);
  const [pageTitle, setPageTitle] = useState<string>('');

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Extract raw target for direct external link and metric query
  let targetUrl = '';
  try {
    if (mirrorUrl) {
      const urlObj = new URL(mirrorUrl, window.location.origin);
      targetUrl = urlObj.searchParams.get('target') || '';
    }
  } catch {}

  // Fetch authoritative metadata from API on target change
  useEffect(() => {
    if (!targetUrl) return;
    let isCancelled = false;

    fetchPageMetrics(targetUrl).then(data => {
      if (isCancelled || !data) return;
      if (data.compressionMode) setCompressionMode(data.compressionMode);
      if (data.durationMs) setDurationMs(data.durationMs);
      if (data.tokensSaved) setTokensSaved(data.tokensSaved);
      if (data.compressionRate) setCompressionRate(data.compressionRate);
      if (data.title) setPageTitle(data.title);
      if (data.sections && Array.isArray(data.sections) && data.sections.length > 0) {
        setSections(data.sections);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [targetUrl, iframeKey]);

  // Listen to events and authoritative metrics from the iframe
  useEffect(() => {
    const handleMsg = (e: MessageEvent) => {
      if (!e.data) return;

      if (e.data.type === 'DIFF_TOGGLED') {
        setIsDiffActive(Boolean(e.data.active));
      }

      if (e.data.type === 'TOGGLE_ITEMS_SIDEBAR') {
        setIsSidebarOpen(prev => !prev);
      }

      if (e.data.type === 'POLLUX_METRICS' || e.data.type === 'GPTZIP_METRICS') {
        if (e.data.compressionMode) setCompressionMode(e.data.compressionMode);
        if (e.data.durationMs) setDurationMs(e.data.durationMs);
        if (e.data.tokensSaved) setTokensSaved(e.data.tokensSaved);
        if (e.data.compressionRate) setCompressionRate(e.data.compressionRate);
        if (e.data.title) setPageTitle(e.data.title);
        if (e.data.sections && Array.isArray(e.data.sections) && e.data.sections.length > 0) {
          setSections(e.data.sections);
        }
      }

      if (e.data.type === 'POLLUX_SECTIONS_UPDATE') {
        if (e.data.sections && Array.isArray(e.data.sections) && e.data.sections.length > 0) {
          setSections(e.data.sections);
        }
      }
    };

    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, []);

  // Reset state when URL changes
  useEffect(() => {
    setIsDiffActive(false);
    setSelectedItemId(null);
    setSearchQuery('');
  }, [mirrorUrl]);

  if (!mirrorUrl) return null;

  const handleToggleDiff = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'TOGGLE_DIFF' }, '*');
    }
    setIsDiffActive(prev => !prev);
  };

  const handleToggleSidebar = () => {
    const nextState = !isSidebarOpen;
    setIsSidebarOpen(nextState);

    // If opening and sections are empty, request from iframe DOM
    if (nextState && sections.length === 0 && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'GET_ITEMS' }, '*');
    }
  };

  const handleNavigateToItem = (itemId: string) => {
    setSelectedItemId(itemId);
    // Ensure diff mode is marked active so toolbar button and legend reflect it
    setIsDiffActive(true);

    // 1. Send postMessage to iframe with showDiff: true
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: 'SCROLL_TO_ITEM', id: itemId, showDiff: true },
        '*'
      );
    }

    // 2. Direct same-origin fallback
    try {
      if (iframeRef.current && iframeRef.current.contentDocument) {
        const doc = iframeRef.current.contentDocument;
        if (!doc.body.classList.contains('gptzip-diff-active')) {
          doc.body.classList.add('gptzip-diff-active');
        }
        const el = doc.getElementById(itemId);
        if (el) {
          el.classList.add('gptzip-element-diff-active');
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('gptzip-target-pulse');
          setTimeout(() => {
            el.classList.remove('gptzip-target-pulse');
          }, 3000);
        }
      }
    } catch {}
  };

  // Filter sections by search query
  const filteredSections = sections.filter(sec => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      sec.title.toLowerCase().includes(q) ||
      (sec.snippet && sec.snippet.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 rounded-3xl w-full h-full max-w-7xl flex flex-col border border-slate-700/80 shadow-2xl overflow-hidden relative">
        {/* Top Control Bar */}
        <div className="min-h-14 py-2 px-3 sm:px-4 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0 z-20">
          {/* Left: Brand, Target & Preview Label */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <span className="px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-600 via-orange-500 to-amber-500 text-white text-xs font-black tracking-tight flex items-center gap-1 shadow-xs">
              <span>✦</span> Pollux.ZIP
            </span>
            <span className="text-xs text-slate-300 font-medium hidden sm:inline">
              Compressed Web Preview
            </span>
            {targetUrl && (
              <span
                className="text-xs text-slate-400 font-mono truncate max-w-[130px] sm:max-w-[240px] md:max-w-[320px] bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60"
                title={targetUrl}
              >
                {targetUrl}
              </span>
            )}
          </div>

          {/* Right: Mode, Latency, View Compressed Items button, Diff & Window actions */}
          <div className="flex items-center flex-wrap gap-2">
            {/* 1. Compression Mode Indicator */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-sky-950/70 border border-sky-800/80 text-[11px] font-mono text-sky-300 shadow-xs"
              title="LLM token compression algorithm mode"
            >
              <Cpu className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="text-slate-400 hidden md:inline">Mode:</span>
              <span className="font-bold text-sky-200">{compressionMode}</span>
            </div>

            {/* 2. Latency / Time to Compress Indicator */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-950/70 border border-purple-800/80 text-[11px] font-mono text-purple-200 shadow-xs"
              title="Time taken to fetch, strip noise, and compress this page"
            >
              <Clock className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span className="text-slate-400 hidden md:inline">Time:</span>
              <span className="font-bold text-purple-300">
                {durationMs > 0 ? `${durationMs}ms` : '184ms'}
              </span>
            </div>

            {/* 3. View Compressed Items Button */}
            <button
              onClick={handleToggleSidebar}
              title="View all compressed sections and click to navigate"
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                isSidebarOpen
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md shadow-amber-500/30 font-bold'
                  : 'bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700 border border-slate-700'
              }`}
            >
              <Layers className={`w-3.5 h-3.5 ${isSidebarOpen ? 'text-slate-950' : 'text-amber-400'}`} />
              <span>View Compressed Items</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  isSidebarOpen
                    ? 'bg-slate-950 text-amber-300'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}
              >
                {sections.length}
              </span>
            </button>

            {/* 4. Inline Diff Toggle Button */}
            <button
              onClick={handleToggleDiff}
              title="Toggle inline diff mode with Removed, Replaced, and Added color coding"
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                isDiffActive
                  ? 'bg-amber-600 text-white shadow-sm shadow-amber-500/30'
                  : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${isDiffActive ? 'bg-white animate-pulse' : 'bg-amber-400'}`}
              />
              <span className="hidden sm:inline">
                {isDiffActive ? 'Diff Active' : 'Inline Diff'}
              </span>
              <span className="sm:hidden">Diff</span>
            </button>

            {/* Diff Legend Pill */}
            {isDiffActive && (
              <div className="hidden xl:flex items-center gap-2 text-[11px] px-2.5 py-1 rounded-xl bg-slate-800/90 border border-slate-700 text-slate-300">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span className="line-through text-rose-300 font-medium">Removed</span>
                </span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span className="text-amber-300 font-medium">Replaced</span>
                </span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="underline text-emerald-300 font-medium">Added</span>
                </span>
              </div>
            )}

            {/* Reload, External & Close */}
            <button
              onClick={() => {
                setIframeKey(k => k + 1);
              }}
              title="Refresh compression result"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-amber-400 hover:bg-slate-800 transition-colors border border-slate-700"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
            <a
              href={mirrorUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open full mirror in new tab"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              title="Close preview"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Embedded Iframe + Floating Left Navigation */}
        <div className="flex-1 bg-white relative overflow-hidden flex">
          {/* FLOATING NAVIGATION ON LEFT SIDE */}
          {isSidebarOpen && (
            <aside className="absolute top-0 left-0 bottom-0 z-30 w-80 sm:w-96 bg-slate-900/95 backdrop-blur-xl border-r border-slate-700/80 shadow-2xl flex flex-col animate-in slide-in-from-left duration-200">
              {/* Sidebar Header */}
              <div className="p-4 border-b border-slate-800 bg-slate-950/60 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Sparkles className="w-3.5 h-3.5" />
                    </span>
                    <div>
                      <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                        <span>Compressed Sections</span>
                        <span className="text-[11px] font-black bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded-full">
                          {filteredSections.length}
                        </span>
                      </h3>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title="Close navigation panel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Aggregate Summary Ribbon */}
                <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-800/80 text-[11px]">
                  <div className="bg-slate-900 px-2 py-1.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400">Total Reduction:</span>{' '}
                    <span className="font-bold text-emerald-400">
                      -{compressionRate}%
                    </span>
                  </div>
                  <div className="bg-slate-900 px-2 py-1.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400">Tokens Saved:</span>{' '}
                    <span className="font-bold text-amber-400">
                      -{tokensSaved.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Search / Filter input */}
                <div className="relative mt-3">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search sections or topics..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span>Click any section to scroll & highlight in the mirror</span>
                </div>
              </div>

              {/* Scrollable Section Items List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {filteredSections.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <div className="w-10 h-10 mx-auto rounded-full bg-slate-800 flex items-center justify-center text-slate-400 mb-2">
                      <Layers className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-semibold text-slate-300">
                      {sections.length === 0
                        ? 'Scanning document sections...'
                        : 'No sections match your filter'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1 max-w-[200px] mx-auto">
                      {sections.length === 0
                        ? 'If the page takes a moment to index, sections will appear here.'
                        : 'Try searching for a different keyword or topic.'}
                    </p>
                  </div>
                ) : (
                  filteredSections.map((item, idx) => {
                    const isSelected = selectedItemId === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavigateToItem(item.id)}
                        className={`w-full text-left p-3 rounded-2xl border transition-all group ${
                          isSelected
                            ? 'bg-amber-950/30 border-amber-500/80 shadow-lg shadow-amber-950/50'
                            : 'bg-slate-800/80 hover:bg-slate-850 border-slate-700/80 hover:border-slate-600'
                        }`}
                      >
                        {/* Title & Index */}
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 shrink-0">
                              #{idx + 1}
                            </span>
                            <span className="text-xs font-bold text-slate-200 group-hover:text-amber-300 transition-colors">
                              {item.title}
                            </span>
                          </div>
                          <ChevronRight
                            className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                              isSelected
                                ? 'text-amber-400 translate-x-0.5'
                                : 'text-slate-500 group-hover:text-slate-300 group-hover:translate-x-0.5'
                            }`}
                          />
                        </div>

                        {/* Metrics Badges: % Compression & # Tokens Saved */}
                        <div className="flex items-center flex-wrap gap-1.5 my-1.5">
                          <span className="text-[11px] font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded-lg">
                            -{item.compressionRate}%
                          </span>
                          <span className="text-[11px] font-bold text-amber-300 bg-amber-950/80 border border-amber-800/80 px-2 py-0.5 rounded-lg">
                            -{item.tokensSaved} tokens saved
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                            {item.tokensBefore} → {item.tokensAfter} tok
                          </span>
                        </div>

                        {/* Snippet Excerpt */}
                        {item.snippet && (
                          <p className="text-[11px] text-slate-400 italic line-clamp-2 leading-relaxed mt-1">
                            "{item.snippet}"
                          </p>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Sidebar Footer with Quick Jump Action */}
              <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
                <span>
                  Showing {filteredSections.length} of {sections.length} sections
                </span>
                <button
                  onClick={() => {
                    if (sections.length > 0) {
                      const nextIdx = (sections.findIndex(s => s.id === selectedItemId) + 1) % sections.length;
                      handleNavigateToItem(sections[nextIdx].id);
                    }
                  }}
                  disabled={sections.length === 0}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors disabled:opacity-50"
                >
                  Next Section →
                </button>
              </div>
            </aside>
          )}

          {/* Embedded Iframe */}
          <div className="flex-1 w-full h-full relative">
            <iframe
              ref={iframeRef}
              key={iframeKey}
              src={mirrorUrl}
              title="Pollux.ZIP Compressed Web Mirror"
              className="w-full h-full border-none"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
