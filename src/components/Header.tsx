import React from 'react';
import { Sparkles, Globe, User, ShieldCheck } from 'lucide-react';
import { UsageState } from '../types';

interface HeaderProps {
  currentSurface: 'go' | 'index';
  onSurfaceChange: (surface: 'go' | 'index') => void;
  usage: UsageState | null;
  onOpenAuth: () => void;
  onOpenExplainer: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentSurface,
  onSurfaceChange,
  usage,
  onOpenAuth,
  onOpenExplainer
}) => {
  const remaining = usage ? usage.remaining : 20;
  const completed = usage ? usage.completed : 0;
  const bonusCredits = usage?.user?.credits || 0;

  return (
    <header className="w-full border-b border-amber-200/80 bg-white/85 backdrop-blur-md sticky top-0 z-40 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand & Surface Segmented Switcher */}
        <div className="flex items-center gap-3 sm:gap-6">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={() => onSurfaceChange('go')}>
            <span className="h-8 w-8 rounded-lg bg-gradient-to-tr from-amber-600 via-orange-500 to-amber-400 flex items-center justify-center text-white font-black text-sm shadow-sm shadow-orange-500/25 group-hover:scale-105 transition-transform">
              ✦
            </span>
            <div className="flex flex-col">
              <span className="font-extrabold text-base sm:text-lg tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-amber-900 bg-clip-text text-transparent leading-none">
                Pollux<span className="text-amber-600">.ZIP</span>
              </span>
              <span className="text-[10px] text-amber-700/80 font-medium tracking-wide hidden sm:inline">
                Gemini's Brightest Star · AI Internet
              </span>
            </div>
          </div>

          {/* Surface switcher */}
          <nav className="flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200/70" aria-label="Surface navigation">
            <button
              onClick={() => onSurfaceChange('go')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                currentSurface === 'go'
                  ? 'bg-white text-amber-700 shadow-sm border border-slate-200/50'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Go
            </button>
            <button
              onClick={() => onSurfaceChange('index')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                currentSurface === 'index'
                  ? 'bg-white text-amber-700 shadow-sm border border-slate-200/50'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Index
            </button>
          </nav>

          <button
            onClick={onOpenExplainer}
            className="text-xs font-medium text-slate-500 hover:text-amber-700 transition-colors hidden md:flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>The Compressed Web</span>
          </button>
        </div>

        {/* Right: Anonymous Allowance & Account */}
        <div className="flex items-center gap-3">
          {/* Free Allowance Badge */}
          <div
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-950 font-medium"
            title="Anonymous quota: No login required. Repeat visits to compressed pages are free."
          >
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${remaining > 0 ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${remaining > 0 ? 'bg-emerald-500' : 'bg-amber-600'}`}></span>
              </span>
              <span className="font-semibold text-amber-900">
                {remaining} {remaining === 1 ? 'page' : 'pages'} available
              </span>
            </div>
            <span className="text-amber-300 hidden sm:inline">|</span>
            <span className="text-slate-500 hidden sm:inline">
              {completed}/20 used
            </span>
          </div>

          {/* Account / Referral Bonus button */}
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 shadow-xs transition-colors"
          >
            {usage?.user ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span className="max-w-[100px] truncate">{usage.user.email}</span>
                {bonusCredits > 0 && (
                  <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                    +{bonusCredits}
                  </span>
                )}
              </>
            ) : (
              <>
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Account & Bonus</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
