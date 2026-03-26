import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Mail, Lock } from 'lucide-react';
import { signInWithEmail, signUpWithEmail } from '@/hooks/useAuth';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AuthModal({ open, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const reset = () => { setEmail(''); setPassword(''); setError(''); setSuccess(''); };

  const handleSubmit = async () => {
    if (!email || !password) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const fn = mode === 'signin' ? signInWithEmail : signUpWithEmail;
      const { error: authErr } = await fn(email, password);
      if (authErr) {
        setError(authErr.message);
      } else if (mode === 'signup') {
        setSuccess('Check your email for a confirmation link.');
      } else {
        onClose();
        reset();
      }
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full h-10 bg-s2 border border-tv-border rounded-lg px-3 text-[13px] text-tv-text placeholder:text-tv-text-m focus:outline-none focus:border-tv-primary transition-colors";

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0"
            style={{ backgroundColor: 'rgba(28,25,23,0.5)', backdropFilter: 'blur(6px)' }}
            onClick={() => { onClose(); reset(); }}
          />
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            className="relative z-10 w-full max-w-sm bg-surface border border-tv-border rounded-2xl shadow-card overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-tv-border">
              <span className="text-[11px] font-mono text-tv-text-m uppercase tracking-widest">
                {mode === 'signin' ? 'Sign in to ToolScribe' : 'Create your account'}
              </span>
              <button onClick={() => { onClose(); reset(); }} className="p-1 rounded hover:bg-s2 text-tv-text-s">
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-3">
              {/* Email */}
              <div className="relative">
                <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-tv-text-m" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputClass + ' pl-9'}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                />
              </div>

              {/* Password */}
              <div className="relative">
                <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-tv-text-m" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password"
                  className={inputClass + ' pl-9'}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                />
              </div>

              {/* Error / success */}
              {error && (
                <p className="text-[12px] font-mono text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              {success && (
                <p className="text-[12px] font-mono text-tv-primary bg-tv-primary-g border border-tv-primary/20 rounded-lg px-3 py-2">
                  {success}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-tv-border bg-s2 flex items-center gap-3">
              <button
                onClick={handleSubmit}
                disabled={loading || !email || !password}
                className="flex-1 flex items-center justify-center gap-2 h-9 bg-tv-primary text-white rounded-lg text-[13px] font-medium hover:bg-tv-primary-dark disabled:opacity-40 transition-colors"
              >
                {loading ? <Loader2 size={13} className="animate-spin" /> : null}
                {mode === 'signin' ? 'Sign in' : 'Create account'}
              </button>
              <button
                onClick={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError(''); setSuccess(''); }}
                className="text-[12px] font-mono text-tv-text-s hover:text-tv-text transition-colors whitespace-nowrap"
              >
                {mode === 'signin' ? 'New here?' : 'Sign in instead'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
