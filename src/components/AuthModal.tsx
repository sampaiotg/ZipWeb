import React, { useState } from 'react';
import { X, ShieldCheck, Gift, Copy, Check, LogOut, ArrowRight, Loader2, Sparkles, User } from 'lucide-react';
import { UsageState } from '../types';
import { registerOrLogin, logoutUser, claimReferral } from '../lib/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  usage: UsageState | null;
  onRefreshUsage: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  usage,
  onRefreshUsage
}) => {
  const [email, setEmail] = useState('');
  const [referralInput, setReferralInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [claimStatus, setClaimStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const user = usage?.user;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !email.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await registerOrLogin(email.trim());
      onRefreshUsage();
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logoutUser();
      onRefreshUsage();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    setClaimStatus(null);
    if (!referralInput.trim()) return;

    setLoading(true);
    try {
      const res = await claimReferral(referralInput.trim());
      setClaimStatus(`Success! +10 bonus credits credited. Total: ${res.credits}`);
      setReferralInput('');
      onRefreshUsage();
    } catch (err: any) {
      setClaimStatus(err.message || 'Failed to claim referral code');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyReferral = () => {
    if (!user) return;
    const shareUrl = `${window.location.origin}/go?ref=${user.referralCode}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
              <User className="w-4 h-4" />
            </span>
            <h3 className="font-bold text-base text-slate-900">
              {user ? 'Account & Bonus Credits' : 'Sign in / Bonus Credits'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {user ? (
            <div className="space-y-5">
              {/* User Identity info */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-800">
                      Verified Identity
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                    Active
                  </span>
                </div>
                <div className="text-sm font-semibold text-slate-900 mt-2 truncate">
                  {user.email}
                </div>
                <div className="mt-3 pt-3 border-t border-slate-200/70 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Bonus Credits:</span>
                  <span className="font-black text-amber-600 text-sm font-mono">
                    +{user.credits} pages
                  </span>
                </div>
              </div>

              {/* Referral share */}
              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/70">
                <div className="flex items-center gap-2 mb-2">
                  <Gift className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-bold text-amber-950">
                    Earn +10 pages per referral
                  </span>
                </div>
                <p className="text-xs text-amber-900/80 mb-3">
                  Share your referral link. When colleagues compress pages, both of you earn 10 additional page compressions.
                </p>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/go?ref=${user.referralCode}`}
                    className="flex-1 px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-mono text-slate-700"
                  />
                  <button
                    onClick={handleCopyReferral}
                    className="px-3 py-2 bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Claim friend's code */}
              <form onSubmit={handleClaimReferral} className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 block">
                  Have a friend's referral code?
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={referralInput}
                    onChange={e => setReferralInput(e.target.value.toUpperCase())}
                    placeholder="e.g. 8F2A1C"
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono uppercase text-slate-800"
                  />
                  <button
                    type="submit"
                    disabled={loading || !referralInput.trim()}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                  >
                    Claim
                  </button>
                </div>
                {claimStatus && (
                  <p className="text-xs text-slate-600 mt-1">{claimStatus}</p>
                )}
              </form>

              {/* Logout */}
              <div className="pt-2">
                <button
                  onClick={handleLogout}
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 text-xs font-semibold text-slate-600 hover:text-red-600 flex items-center justify-center gap-2 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-xs text-slate-500">
                You can compress up to <strong>20 pages anonymously without an account</strong>.
                Sign in optionally to link devices, unlock higher limits, or invite team members.
              </div>

              <form onSubmit={handleAuth} className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    disabled={loading}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                {error && (
                  <p className="text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-600 text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-500/20 flex items-center justify-center gap-2 transition-all"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Continue with Email</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>New accounts automatically start with +5 bonus crawl slots.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
