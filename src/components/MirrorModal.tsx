import React, { useState, useEffect, useRef } from 'react';
import { X, ExternalLink, RefreshCw } from 'lucide-react';

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
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Listen to diff state changes from inside the iframe
  useEffect(() => {
    const handleMsg = (e: MessageEvent) => {
      if (e.data && e.data.type === 'DIFF_TOGGLED') {
        setIsDiffActive(Boolean(e.data.active));
      }
    };
    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, []);

  // Reset diff state when URL changes
  useEffect(() => {
    setIsDiffActive(false);
  }, [mirrorUrl]);

  if (!mirrorUrl) return null;

  // Extract raw target for direct external link
  let targetUrl = '';
  try {
    const urlObj = new URL(mirrorUrl, window.location.origin);
    targetUrl = urlObj.searchParams.get('target') || '';
  } catch {}

  const handleToggleDiff = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'TOGGLE_DIFF' }, '*');
    }
    setIsDiffActive(prev => !prev);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 rounded-3xl w-full h-full max-w-6xl flex flex-col border border-slate-700/80 shadow-2xl overflow-hidden">
        {/* Top Control Bar */}
        <div className="h-14 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <span className="px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-600 to-orange-500 text-white text-xs font-black tracking-tight flex items-center gap-1">
              <span>✦</span> Pollux.ZIP
            </span>
            <span className="text-xs text-slate-300 font-medium hidden sm:inline">
              Compressed Web Preview · Gemini AI Mirror
            </span>
            {targetUrl && (
              <span className="text-xs text-slate-400 font-mono truncate max-w-[160px] sm:max-w-[320px]">
                {targetUrl}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Inline Diff Toggle Button */}
            <button
              onClick={handleToggleDiff}
              title="Toggle inline diff mode with Removed, Replaced, and Added color coding"
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                isDiffActive
                  ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-sm shadow-amber-500/30'
                  : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${isDiffActive ? 'bg-white animate-pulse' : 'bg-amber-400'}`}
              />
              <span>{isDiffActive ? 'Diff Mode Active' : 'Inline Diff'}</span>
            </button>

            {/* Diff Legend Pill */}
            {isDiffActive && (
              <div className="hidden lg:flex items-center gap-2 text-[11px] px-2.5 py-1 rounded-xl bg-slate-800/90 border border-slate-700 text-slate-300">
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

            <button
              onClick={() => setIframeKey(k => k + 1)}
              title="Reload preview"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
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

        {/* Embedded Iframe */}
        <div className="flex-1 bg-white relative">
          <iframe
            ref={iframeRef}
            key={iframeKey}
            src={mirrorUrl}
            title="GPT-ZIP Compressed Web Mirror"
            className="w-full h-full border-none"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          />
        </div>
      </div>
    </div>
  );
};
