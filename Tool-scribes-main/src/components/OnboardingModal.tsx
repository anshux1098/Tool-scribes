import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Sparkles, ChevronRight } from 'lucide-react';
import { UserRole, ROLE_LABELS, ROLE_DESCRIPTIONS, ROLE_EMOJIS, seedVaultTools } from '@/lib/seedTools';
import { useAuth } from '@/hooks/useAuth';
import FocusTrap from '@/components/FocusTrap';

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const ALL_ROLES: UserRole[] = ['developer', 'designer', 'student', 'indie_hacker', 'product_builder'];

export default function OnboardingModal({ open, onClose, onComplete }: OnboardingModalProps) {
  const [selected, setSelected] = useState<UserRole[]>([]);
  const [seeding, setSeeding] = useState(false);
  const [done, setDone] = useState(false);
  const [count, setCount] = useState(0);
  const { user } = useAuth();

  const toggleRole = (role: UserRole) => {
    setSelected(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const handleSeed = async () => {
    if (!user || selected.length === 0) return;
    setSeeding(true);
    const result = await seedVaultTools(user.id, selected);
    setCount(result.count);
    setSeeding(false);
    setDone(true);
  };

  const handleSkip = () => {
    try { localStorage.setItem('ts_onboarded', 'true'); } catch {}
    onComplete();
    onClose();
  };

  const handleDone = () => {
    try { localStorage.setItem('ts_onboarded', 'true'); } catch {}
    onComplete();
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
            style={{ backgroundColor: 'rgba(28,25,23,0.6)', backdropFilter: 'blur(8px)' }}
            onClick={handleSkip}
          />
          <FocusTrap active={open}>
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              className="relative z-10 w-full max-w-[520px] bg-surface border border-tv-border rounded-2xl shadow-card overflow-hidden"
            >
            <div className="px-6 py-5 border-b border-tv-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-tv-primary" />
                <span className="text-[11px] font-mono text-tv-text-m uppercase tracking-widest">Welcome to ToolScribe</span>
              </div>
              <button onClick={handleSkip} aria-label="Close dialog" className="p-2.5 rounded hover:bg-s2 text-tv-text-s hover:text-tv-text transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-6">
              {done ? (
                <div className="text-center py-6">
                  <div className="w-14 h-14 rounded-full bg-tv-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Sparkles size={26} className="text-tv-primary" />
                  </div>
                  <h2 className="font-syne text-[22px] text-tv-text mb-1">Your vault is seeded!</h2>
                  <p className="text-[13px] text-tv-text-s font-mono mt-1">
                    {count} {count === 1 ? 'tool has' : 'tools have'} been added to your vault.
                  </p>
                  <p className="text-[11px] text-tv-text-m font-mono mt-1">
                    Start exploring, adding notes, and organizing into collections.
                  </p>
                  <button
                    onClick={handleDone}
                    className="mt-6 px-6 py-2.5 bg-tv-primary text-white rounded-lg text-[13px] font-medium hover:bg-tv-primary-dark transition-colors"
                  >
                    Get started
                  </button>
                </div>
              ) : (
                <>
                  <h2 id="onboarding-title" className="font-syne text-[22px] text-tv-text mb-1">What kind of builder are you?</h2>
                  <p className="text-[12px] text-tv-text-s font-mono mb-5">
                    Pick your roles and we'll seed your vault with relevant tools to get you started.
                  </p>

                  <div className="space-y-2">
                    {ALL_ROLES.map(role => {
                      const isSelected = selected.includes(role);
                      return (
                        <button
                          key={role}
                          onClick={() => toggleRole(role)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all duration-150 ${
                            isSelected
                              ? 'border-tv-primary bg-tv-primary/5'
                              : 'border-tv-border bg-transparent hover:border-tv-border-l'
                          }`}
                        >
                          <span className="text-xl w-8 h-8 flex items-center justify-center">{ROLE_EMOJIS[role]}</span>
                          <div className="flex-1">
                            <span className={`text-[14px] font-medium ${isSelected ? 'text-tv-text' : 'text-tv-text'}`}>
                              {ROLE_LABELS[role]}
                            </span>
                            <p className="text-[11px] font-mono text-tv-text-s mt-0.5">{ROLE_DESCRIPTIONS[role]}</p>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                              isSelected ? 'border-tv-primary bg-tv-primary' : 'border-tv-border'
                            }`}
                          >
                            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between mt-5">
                    <button
                      onClick={handleSkip}
                      className="px-4 py-2 rounded-lg text-[13px] text-tv-text-s hover:text-tv-text transition-colors"
                    >
                      Skip for now
                    </button>
                    <button
                      onClick={handleSeed}
                      disabled={selected.length === 0 || seeding}
                      className="flex items-center gap-1.5 px-5 py-2.5 bg-tv-primary text-white rounded-lg text-[13px] font-medium transition-all duration-150 hover:bg-tv-primary-dark disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {seeding ? (
                        <><Loader2 size={13} className="animate-spin" /> Seeding...</>
                      ) : (
                        <><Sparkles size={13} /> Seed my vault <ChevronRight size={13} /></>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
            </motion.div>
          </FocusTrap>
        </div>
      )}
    </AnimatePresence>
  );
}
