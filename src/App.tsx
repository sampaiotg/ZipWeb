/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { GoView } from './components/GoView';
import { IndexView } from './components/IndexView';
import { AuthModal } from './components/AuthModal';
import { CompressedWebExplainer } from './components/CompressedWebExplainer';
import { MirrorModal } from './components/MirrorModal';
import { UsageState, HistoryItem } from './types';
import { fetchViewer, getLocalHistory, updateLocalHistoryMetrics, fetchPageMetrics } from './lib/api';

export default function App() {
  // Determine surface from URL path or hostname
  const getInitialSurface = (): 'go' | 'index' => {
    const host = window.location.hostname.toLowerCase();
    if (host.startsWith('index.')) return 'index';
    if (host.startsWith('go.')) return 'go';
    const path = window.location.pathname.toLowerCase();
    if (path.startsWith('/index')) return 'index';
    return 'go';
  };

  const [currentSurface, setCurrentSurface] = useState<'go' | 'index'>(getInitialSurface);
  const [usage, setUsage] = useState<UsageState | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [explainerOpen, setExplainerOpen] = useState(false);
  const [mirrorModalUrl, setMirrorModalUrl] = useState<string | null>(null);

  // Sync route and surface
  const handleSurfaceChange = (surface: 'go' | 'index') => {
    setCurrentSurface(surface);
    const newPath = surface === 'index' ? '/index' : '/go';
    window.history.pushState({}, '', newPath);
  };

  // Check URL query parameters (e.g., if navigated directly to mirror or had ref code)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const targetParam = urlParams.get('target');
    const intentParam = urlParams.get('intentId');
    if (window.location.pathname.includes('/mirror') && targetParam) {
      setMirrorModalUrl(`/api/mirror?target=${encodeURIComponent(targetParam)}&intentId=${intentParam || ''}&surface=${currentSurface}`);
    }

    // Listen to browser popstate (back/forward)
    const handlePopState = () => {
      setCurrentSurface(getInitialSurface());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentSurface]);

  // Load viewer allowance and local history on mount, and reconcile with authoritative server metrics
  const refreshUsage = useCallback(async () => {
    try {
      const viewerData = await fetchViewer();
      setUsage(viewerData);
    } catch (err) {
      console.error('Failed to load viewer allowance:', err);
    }
  }, []);

  useEffect(() => {
    refreshUsage();
    const stored = getLocalHistory();
    setHistory(stored);

    // Sync any historical items with authoritative server metrics to eliminate conflicting values
    stored.forEach(async item => {
      const serverMetrics = await fetchPageMetrics(item.url);
      if (serverMetrics) {
        const updated = updateLocalHistoryMetrics(item.url, {
          tokensSaved: serverMetrics.tokensSaved,
          estimatedUsdSaved: serverMetrics.estimatedSavings,
          compressionRate: serverMetrics.compressionRate,
          title: serverMetrics.title,
          siteName: serverMetrics.siteName,
          favicon: serverMetrics.favicon
        });
        setHistory([...updated]);
      }
    });
  }, [refreshUsage]);

  // Framebuster protection: if App is ever loaded inside an iframe, break out or request close
  useEffect(() => {
    try {
      if (window.self !== window.top) {
        window.top?.postMessage({ type: 'CLOSE_MIRROR' }, '*');
      }
    } catch {}
  }, []);

  // Synchronize authoritative metrics from mirror banner iframe directly
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (!e.data) return;

      if (e.data.type === 'CLOSE_MIRROR') {
        setMirrorModalUrl(null);
        return;
      }

      if (e.data.type === 'OPEN_MIRROR' && e.data.url) {
        setMirrorModalUrl(e.data.url);
        return;
      }

      if (e.data.type === 'POLLUX_METRICS' || e.data.type === 'GPTZIP_METRICS') {
        const { url, tokensSaved, compressionRate, estimatedSavings, title, siteName, favicon } = e.data;
        if (url) {
          const updated = updateLocalHistoryMetrics(url, {
            tokensSaved,
            estimatedUsdSaved: estimatedSavings,
            compressionRate,
            title,
            siteName,
            favicon
          });
          setHistory([...updated]);
          refreshUsage();
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [refreshUsage]);

  const handleOpenMirror = (url: string) => {
    setMirrorModalUrl(url);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_100%_90%_at_50%_-15%,rgba(254,243,199,0.7),rgba(255,255,255,1))] text-slate-800 flex flex-col font-sans selection:bg-amber-500 selection:text-white">
      {/* Soft blurred ambient stellar glows */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-amber-300/15 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed top-20 right-1/4 w-96 h-96 bg-orange-300/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Shared Go/Index Header Shell */}
      <Header
        currentSurface={currentSurface}
        onSurfaceChange={handleSurfaceChange}
        usage={usage}
        onOpenAuth={() => setAuthModalOpen(true)}
        onOpenExplainer={() => setExplainerOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full">
        {currentSurface === 'go' ? (
          <GoView
            usage={usage}
            history={history}
            onRefreshUsage={refreshUsage}
            onUpdateHistory={setHistory}
            onOpenAuth={() => setAuthModalOpen(true)}
            onOpenMirror={handleOpenMirror}
          />
        ) : (
          <IndexView
            usage={usage}
            history={history}
            onRefreshUsage={refreshUsage}
            onUpdateHistory={setHistory}
            onOpenMirror={handleOpenMirror}
          />
        )}
      </main>

      {/* Footnote / Shell Info */}
      <footer className="w-full border-t border-amber-200/60 bg-white/50 py-6 text-xs text-slate-400">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 flex items-center gap-1">
              <span className="text-amber-500">✦</span> Pollux.ZIP
            </span>
            <span>·</span>
            <span>The Brightest Star of Gemini · The Internet for AI Agents</span>
          </div>
          <div className="flex items-center gap-4 text-slate-500">
            <button
              onClick={() => setExplainerOpen(true)}
              className="hover:text-amber-700 transition-colors"
            >
              How it works
            </button>
            <span>·</span>
            <button
              onClick={() => handleSurfaceChange(currentSurface === 'go' ? 'index' : 'go')}
              className="hover:text-amber-700 transition-colors"
            >
              Switch to {currentSurface === 'go' ? 'Index' : 'Go'}
            </button>
            <span>·</span>
            <button
              onClick={() => setAuthModalOpen(true)}
              className="hover:text-amber-700 transition-colors"
            >
              Referral Program
            </button>
          </div>
        </div>
      </footer>

      {/* Optional Auth & Bonus Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        usage={usage}
        onRefreshUsage={refreshUsage}
      />

      {/* Concept Explainer Modal */}
      <CompressedWebExplainer
        isOpen={explainerOpen}
        onClose={() => setExplainerOpen(false)}
      />

      {/* In-App Mirror Viewer Modal */}
      <MirrorModal
        mirrorUrl={mirrorModalUrl}
        onClose={() => setMirrorModalUrl(null)}
      />
    </div>
  );
}
