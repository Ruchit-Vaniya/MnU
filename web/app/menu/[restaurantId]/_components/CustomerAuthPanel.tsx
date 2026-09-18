'use client';

import { useState } from 'react';
import { customerAuthApi } from '@/lib/api';
import { setCustomerToken } from '@/lib/customerAuth';

type Method = 'mobile' | 'email';
type Step = 'method' | 'otp';

interface CustomerAuthPanelProps {
  // Optional as of the group-ordering work: the Review page knows the
  // restaurant's name (it already fetched the menu), but the group entry
  // screen doesn't fetch the menu at all, and making it do so purely for
  // one line of intro copy would be a wasted request. Falls back to
  // generic wording instead.
  restaurantName?: string;
  onVerified: () => void;
  // Lets the caller reframe the intro for a non-checkout context
  // (joining a group isn't "placing an order"). Defaults to the original
  // checkout wording so the Review page is unchanged.
  title?: string;
  description?: string;
}

// Self-contained: choose method → enter mobile/email → enter OTP →
// verified. All the "screens" the task calls for (Login/Continue,
// Mobile option, Email option, OTP screen, Loading, Error, Success) are
// states of this one component rather than separate routes — simpler,
// and it means Part 6 (preserve table/cart context) needs zero extra
// work: the customer never navigates away from the Review page at all.
export function CustomerAuthPanel({ restaurantName, onVerified, title, description }: CustomerAuthPanelProps) {
  const [method, setMethod] = useState<Method>('mobile');
  const [step, setStep] = useState<Step>('method');
  const [value, setValue] = useState('');
  const [otp, setOtp] = useState('');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [destination, setDestination] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendOtp = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await customerAuthApi.requestOtp(method, value.trim());
      setRequestId(res.requestId);
      setDestination(res.destination);
      // See lib/api.ts's OtpRequestResponse comment — no real SMS/email
      // provider is wired up yet, so the code is surfaced here for
      // testing rather than actually delivered.
      setDevOtp(res.devOtp);
      setOtp('');
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const requestOtp = (e: React.FormEvent) => {
    e.preventDefault();
    void sendOtp();
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestId) return;
    setError(null);
    setLoading(true);
    try {
      const res = await customerAuthApi.verifyOtp(requestId, otp.trim());
      setCustomerToken(res.token);
      onVerified();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incorrect code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-card border border-hairline bg-surface p-6">
      {step === 'method' && (
        <>
          <h2 className="text-lg font-bold text-carbon-900">{title ?? 'Verify to place your order'}</h2>
          <p className="mt-1 text-sm text-carbon-400">
            {description ??
              `${restaurantName ?? 'This restaurant'} needs to verify it's really you before sending your order to the kitchen.`}
          </p>

          <div className="mt-5 flex rounded-xl bg-canvas p-1">
            <button
              type="button"
              onClick={() => {
                setMethod('mobile');
                setValue('');
                setError(null);
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                method === 'mobile' ? 'bg-surface text-carbon-900 shadow-sm' : 'text-carbon-400'
              }`}
            >
              Mobile number
            </button>
            <button
              type="button"
              onClick={() => {
                setMethod('email');
                setValue('');
                setError(null);
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                method === 'email' ? 'bg-surface text-carbon-900 shadow-sm' : 'text-carbon-400'
              }`}
            >
              Email
            </button>
          </div>

          <form onSubmit={requestOtp} className="mt-4 space-y-3">
            <div>
              <label className="text-sm font-semibold text-carbon-700">
                {method === 'mobile' ? 'Mobile number' : 'Email address'}
              </label>
              <input
                type={method === 'mobile' ? 'tel' : 'email'}
                required
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={method === 'mobile' ? '+91 98765 43210' : 'you@example.com'}
                className="mt-1.5 w-full rounded-xl border border-hairline px-3 py-2.5 text-sm outline-none focus:border-brand-400"
              />
            </div>

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading || !value.trim()}
              className="w-full rounded-xl bg-terracotta-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? 'Sending code...' : 'Send verification code'}
            </button>
          </form>
        </>
      )}

      {step === 'otp' && (
        <>
          <button
            type="button"
            onClick={() => {
              setStep('method');
              setError(null);
            }}
            className="text-xs font-semibold text-carbon-400"
          >
            ← Change {method === 'mobile' ? 'number' : 'email'}
          </button>

          <h2 className="mt-2 text-lg font-bold text-carbon-900">Enter verification code</h2>
          <p className="mt-1 text-sm text-carbon-400">We sent a 6-digit code to {destination}.</p>

          {devOtp && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Dev mode — no SMS/email provider is connected yet, so here&apos;s the code directly: <strong>{devOtp}</strong>
            </p>
          )}

          <form onSubmit={verifyOtp} className="mt-4 space-y-3">
            <div>
              <label className="text-sm font-semibold text-carbon-700">6-digit code</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                autoFocus
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="mt-1.5 w-full rounded-xl border border-hairline px-3 py-2.5 text-center text-lg tracking-[0.5em] outline-none focus:border-brand-400"
              />
            </div>

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full rounded-xl bg-terracotta-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify & continue'}
            </button>

            <button
              type="button"
              onClick={() => void sendOtp()}
              disabled={loading}
              className="w-full text-center text-xs font-semibold text-carbon-400"
            >
              Resend code
            </button>
          </form>
        </>
      )}
    </div>
  );
}
