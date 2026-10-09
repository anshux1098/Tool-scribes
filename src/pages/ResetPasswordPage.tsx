import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Loader2, Eye, EyeOff, Check } from 'lucide-react';
import { useAuth, updatePassword } from '@/hooks/useAuth';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const { error: authErr } = await updatePassword(password);
      if (authErr) {
        setError(authErr.message);
      } else {
        setDone(true);
        setTimeout(() => navigate('/'), 2000);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-tv-text-m" />
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <Check size={32} className="mx-auto text-tv-primary mb-3" />
          <p className="text-[14px] text-tv-text font-mono">Password updated successfully.</p>
          <p className="text-[12px] text-tv-text-s font-mono mt-1">Redirecting...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center py-24 px-6">
        <h2 className="font-syne text-xl text-tv-text mb-2">Invalid or expired link</h2>
        <p className="text-[13px] text-tv-text-s font-mono mb-4 text-center max-w-sm">
          This password reset link is invalid or has expired. Please request a new one.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-tv-primary text-white rounded-lg text-[13px] font-medium hover:bg-tv-primary-dark transition-colors"
        >
          Back to Home
        </button>
      </div>
    );
  }

  const inputClass = "w-full h-10 bg-s2 border border-tv-border rounded-lg px-3 text-[13px] text-tv-text placeholder:text-tv-text-m focus:outline-none focus:border-tv-primary transition-colors";

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-surface border border-tv-border rounded-2xl shadow-card overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-tv-border">
          <span className="text-[11px] font-mono text-tv-text-m uppercase tracking-widest">Set new password</span>
        </div>

        <div className="px-6 py-5 space-y-3">
          <div className="relative">
            <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-tv-text-m" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="New password"
              aria-label="New password"
              className={inputClass + ' pl-9 pr-9'}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
            <button
              onClick={() => setShowPassword(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-tv-text-m hover:text-tv-text transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          <div className="relative">
            <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-tv-text-m" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              aria-label="Confirm new password"
              className={inputClass + ' pl-9'}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          {error && (
            <p role="alert" className="text-[12px] font-mono text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-tv-border bg-s2">
          <button
            onClick={handleSubmit}
            disabled={submitting || !password || !confirm}
            className="w-full flex items-center justify-center gap-2 h-9 bg-tv-primary text-white rounded-lg text-[13px] font-medium hover:bg-tv-primary-dark disabled:opacity-40 transition-colors"
          >
            {submitting ? <Loader2 size={13} className="animate-spin" /> : null}
            Update password
          </button>
        </div>
      </motion.div>
    </div>
  );
}
