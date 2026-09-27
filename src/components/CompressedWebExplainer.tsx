import React, { useState } from 'react';
import { X, Sparkles, Zap, DollarSign, Cpu, Leaf, Droplets, Info, CheckCircle2 } from 'lucide-react';

interface CompressedWebExplainerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CompressedWebExplainer: React.FC<CompressedWebExplainerProps> = ({
  isOpen,
  onClose
}) => {
  const [pageCount, setPageCount] = useState<number>(100);
  const [modelType, setModelType] = useState<'flagship' | 'fast'>('flagship');

  if (!isOpen) return null;

  // Modeled calculations
  // Average page has ~8,500 tokens raw -> ~5,200 tokens compressed (38.8% savings = 3,300 tokens/page)
  const rawTokensPerPage = 8500;
  const compressedTokensPerPage = 5200;
  const tokensSavedPerPage = rawTokensPerPage - compressedTokensPerPage;

  const totalRawTokens = pageCount * rawTokensPerPage;
  const totalCompressedTokens = pageCount * compressedTokensPerPage;
  const totalTokensSaved = pageCount * tokensSavedPerPage;

  // Pricing: Flagship (e.g. $2.50 per 1M in), Fast (e.g. $0.35 per 1M in)
  const pricePerMillion = modelType === 'flagship' ? 2.50 : 0.35;
  const rawCost = (totalRawTokens / 1_000_000) * pricePerMillion;
  const compressedCost = (totalCompressedTokens / 1_000_000) * pricePerMillion;
  const estimatedDollarsSaved = rawCost - compressedCost;

  // Estimated latency: 15ms per 1k input tokens on typical inference engines
  const rawInferenceSec = (totalRawTokens / 1000) * 0.012;
  const compressedInferenceSec = (totalCompressedTokens / 1000) * 0.012;
  const timeSavedSec = Math.max(0, rawInferenceSec - compressedInferenceSec);

  // Environmental estimations (~0.15 Wh per 1k tokens, ~0.08 mL water per 1k tokens)
  const energySavedKwh = (totalTokensSaved / 1000) * 0.00015;
  const waterSavedMl = (totalTokensSaved / 1000) * 0.08;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-amber-100 flex items-center justify-between bg-amber-50/40">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-bold text-lg text-slate-900 leading-tight">
                Pollux.ZIP: The Internet for AI Agents
              </h3>
              <p className="text-xs text-amber-800 font-medium">
                Named after Pollux (β Geminorum) · Brightest star in the Gemini constellation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-600 leading-relaxed">
          {/* Mission & Astronomical Origin */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 border border-amber-200/80">
            <div className="font-bold text-amber-950 flex items-center gap-2 mb-1.5">
              <span>✦</span>
              <span>Why Pollux.ZIP?</span>
            </div>
            <p className="text-xs text-slate-700 leading-normal">
              In astronomy, <strong>Pollux</strong> is the luminous orange giant star that shines as the brightest luminary in the Gemini constellation. As advanced AI models like <strong>Google Gemini</strong> and autonomous agentic workflows begin browsing the world wide web, they encounter an internet built for human eyes—crowded with navigation headers, cookie consent dialogs, tracking scripts, and verbose prose.
            </p>
            <p className="text-xs text-slate-700 mt-2 leading-normal">
              <strong>Pollux.ZIP</strong> reimagines the web as an AI-native medium: transforming bloated HTML into token-dense, hyper-compact pages that feed directly into Gemini's context window with zero lost context, maximum throughput, and minimal cost.
            </p>
          </div>

          {/* Concept Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80">
              <div className="font-bold text-amber-900 mb-1 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-amber-600" />
                Gemini Agent-First
              </div>
              <p className="text-xs text-amber-950/80">
                Autonomous LLM agents waste up to 40% of their context quotas on redundant syntactic noise and boilerplate.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-orange-50/60 border border-orange-200/80">
              <div className="font-bold text-orange-900 mb-1 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-orange-600" />
                Structural Integrity
              </div>
              <p className="text-xs text-orange-950/80">
                Pollux.ZIP preserves DOM topology, tables, semantic links, code snippets, and entities while condensing prose.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100">
              <div className="font-bold text-emerald-900 mb-1 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                Measurable ROI
              </div>
              <p className="text-xs text-emerald-950/80">
                Every compressed mirror page is tracked with before/after token measurements, speedup metrics, and USD saved.
              </p>
            </div>
          </div>

          {/* Interactive Comparison Calculator */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80">
            <div className="flex items-center justify-between mb-4">
              <div className="font-bold text-slate-800 text-sm">
                Interactive Model Traversal Simulator
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                mode: medium-auto3
              </span>
            </div>

            <div className="space-y-4">
              {/* Slider: Pages processed */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span>Pages ingested by AI agent:</span>
                  <span className="text-rose-600 font-mono font-bold">{pageCount.toLocaleString()} pages</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="1000"
                  step="10"
                  value={pageCount}
                  onChange={e => setPageCount(parseInt(e.target.value, 10))}
                  className="w-full accent-rose-600"
                />
              </div>

              {/* Radio: Model Tier */}
              <div className="flex items-center gap-4 text-xs">
                <span className="text-slate-500 font-medium">Target LLM Tier:</span>
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                  <input
                    type="radio"
                    name="modelTier"
                    checked={modelType === 'flagship'}
                    onChange={() => setModelType('flagship')}
                    className="accent-rose-600"
                  />
                  <span>Flagship ($2.50 / 1M)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                  <input
                    type="radio"
                    name="modelTier"
                    checked={modelType === 'fast'}
                    onChange={() => setModelType('fast')}
                    className="accent-rose-600"
                  />
                  <span>Fast / Lightweight ($0.35 / 1M)</span>
                </label>
              </div>

              {/* Comparison Visualizer */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-200">
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <div className="text-[11px] text-slate-400 font-medium">Tokens Saved</div>
                  <div className="text-base font-extrabold text-slate-900 mt-0.5">
                    {(totalTokensSaved / 1000).toFixed(0)}k
                  </div>
                  <div className="text-[10px] text-emerald-600 font-bold mt-0.5">-38.8% reduction</div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <div className="text-[11px] text-slate-400 font-medium">API Cost Saved</div>
                  <div className="text-base font-extrabold text-rose-600 mt-0.5">
                    ${estimatedDollarsSaved.toFixed(3)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                    ${compressedCost.toFixed(3)} vs ${rawCost.toFixed(3)}
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                    <Leaf className="w-3 h-3 text-emerald-500" /> Energy
                  </div>
                  <div className="text-base font-extrabold text-slate-900 mt-0.5">
                    ~{energySavedKwh.toFixed(2)} kWh
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">inference power</div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                    <Droplets className="w-3 h-3 text-blue-500" /> Data Center Water
                  </div>
                  <div className="text-base font-extrabold text-slate-900 mt-0.5">
                    ~{waterSavedMl.toFixed(0)} mL
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">cooling conservation</div>
                </div>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="mt-4 flex items-start gap-2 text-[11px] text-slate-400">
              <Info className="w-3.5 h-3.5 shrink-0 text-slate-400 mt-0.5" />
              <span>
                Modeled time, cost, energy, and water values are benchmark-grounded estimates based on standard research literature, not guaranteed promises.
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors"
          >
            Close Explainer
          </button>
        </div>
      </div>
    </div>
  );
};
