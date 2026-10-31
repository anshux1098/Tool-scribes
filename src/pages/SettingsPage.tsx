import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Save, Loader2, User, AtSign, FileText, Moon, Sun, Trash2, Download, Eye, LogOut, Palette, Monitor, Sparkles, ExternalLink } from 'lucide-react';
import ProfileSettingsModal from '@/components/ProfileSettingsModal';
import { useAuth, signOut } from '@/hooks/useAuth';
import { useCurrentProfile } from '@/hooks/useProfile';
import { useTheme } from 'next-themes';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { toast } from 'sonner';
import { SEO } from '@/components/SEO';

type SettingsSection = 'profile' | 'privacy' | 'appearance' | 'account';

const sections: { key: SettingsSection; label: string; icon: React.ElementType }[] = [
  { key: 'profile', label: 'Profile', icon: User },
  { key: 'privacy', label: 'Privacy', icon: Eye },
  { key: 'appearance', label: 'Appearance', icon: Palette },
  { key: 'account', label: 'Account', icon: Monitor },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, updateProfile, refetch: refetchProfile } = useCurrentProfile();
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile');

  // Profile fields
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [publicProfile, setPublicProfile] = useState(false);
  const [showCollections, setShowCollections] = useState(true);
  const [showReviews, setShowReviews] = useState(true);
  const [showFollowers, setShowFollowers] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');


  // Delete account
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setUsername(profile.username ?? '');
      setBio(profile.bio);
      setPublicProfile(profile.publicProfile);
      setShowCollections(profile.showCollections);
      setShowReviews(profile.showReviews);
      setShowFollowers(profile.showFollowers);
    }
  }, [profile]);


  const handleSaveProfile = async () => {
    if (!username.trim()) { setProfileError('Username is required for a public profile.'); return; }
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username.trim())) {
      setProfileError('Username must be 3–30 characters (letters, numbers, underscores).');
      return;
    }
    setSavingProfile(true);
    setProfileError('');
    const ok = await updateProfile({
      username: username.trim().toLowerCase(),
      display_name: displayName.trim(),
      bio: bio.trim(),
      public_profile: publicProfile,
    });
    setSavingProfile(false);
    if (ok) {
      toast.success('Profile saved');
    } else {
      setProfileError('Failed to save. Username may already be taken.');
    }
  };

  const handleExportData = useCallback(async () => {
    if (!user || !isSupabaseConfigured) return;
    toast.info('Exporting your data...');
    try {
      const [toolsRes, reviewsRes, collectionsRes, vaultRes] = await Promise.all([
        supabase.from('tools').select('name, url, description, category').eq('added_by', user.id),
        supabase.from('reviews').select('tool_id, best_for, gotcha, free_tier, created_at').eq('user_id', user.id),
        supabase.from('collections').select('name, description, is_public').eq('user_id', user.id),
        supabase.from('vault_items').select('tool_id, notes, tags, created_at').eq('user_id', user.id),
      ]);

      const data = {
        exportedAt: new Date().toISOString(),
        profile: { username: profile?.username, displayName: profile?.displayName, bio: profile?.bio, publicProfile: profile?.publicProfile, reputationScore: profile?.reputationScore },
        tools: toolsRes.data ?? [],
        reviews: reviewsRes.data ?? [],
        collections: collectionsRes.data ?? [],
        vault: vaultRes.data ?? [],
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `toolscribe-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Data exported');
    } catch (e) {
      console.error('[Settings] export failed:', e);
      toast.error('Export failed');
    }
  }, [user, profile]);

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE' || !isSupabaseConfigured) return;
    setDeleting(true);
    try {
      const { error } = await supabase.rpc('delete_my_account');
      if (error) throw error;
      toast.success('Account deleted');
      await signOut();
      navigate('/');
    } catch (e) {
      console.error('[Settings] delete account failed:', e);
      toast.error('Failed to delete account. Contact support.');
    } finally {
      setDeleting(false);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen bg-bg flex items-center justify-center"><Loader2 size={20} className="animate-spin text-tv-text-m" /></div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-[14px] text-tv-text-m font-mono">Sign in to access settings.</p>
      </div>
    );
  }

  const inputClass = "w-full h-10 bg-s2 border border-tv-border rounded-lg px-3 text-[13px] text-tv-text placeholder:text-tv-text-m focus:outline-none focus:border-tv-primary transition-colors";
  const textareaClass = "w-full bg-s2 border border-tv-border rounded-lg px-3 py-2.5 text-[13px] text-tv-text placeholder:text-tv-text-m focus:outline-none focus:border-tv-primary transition-colors resize-none";
  const labelClass = "text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-1.5 block";

  const sectionContent: Record<SettingsSection, React.ReactNode> = {
    profile: (
      <div className="space-y-5">
        <div>
          <label className={labelClass}>Display Name</label>
          <div className="relative">
            <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-tv-text-m" />
            <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your display name" className={inputClass + ' pl-9'} />
          </div>
        </div>
        <div>
          <label className={labelClass}>Username</label>
          <div className="relative">
            <AtSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-tv-text-m" />
            <input type="text" value={username} onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} placeholder="your_username" className={inputClass + ' pl-9 font-mono'} />
          </div>
          <p className="text-[10px] font-mono text-tv-text-m mt-1">Your public profile URL: /u/{username || 'your_username'}</p>
        </div>
        <div>
          <label className={labelClass}>Bio</label>
          <div className="relative">
            <FileText size={13} className="absolute left-3 top-3 text-tv-text-m" />
            <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell us about the tools you curate…" rows={3} className={textareaClass + ' pl-9'} />
          </div>
        </div>
        <div className="pt-2">
          {profileError && <p className="text-[12px] font-mono text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{profileError}</p>}
          <button onClick={handleSaveProfile} disabled={savingProfile || profileLoading}
            className="flex items-center gap-1.5 px-4 py-2 bg-tv-primary text-white rounded-lg text-[13px] font-medium hover:bg-tv-primary-dark disabled:opacity-40 transition-colors">
            {savingProfile ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Save Profile
          </button>
        </div>

        <div className="mt-8 p-4 rounded-xl border border-tv-border bg-s2/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-tv-primary" />
              <span className="text-[13px] font-semibold text-tv-text font-syne">Editorial Showcase & Badges</span>
            </div>
            <p className="text-[12px] text-tv-text-s">
              Upload banner, customize curator badge, set signature quote, social links, and manage your &quot;Currently Loving&quot; shelf.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setProfileModalOpen(true)}
            className="px-3.5 py-1.5 rounded-lg border border-tv-border bg-surface text-tv-text text-[12px] font-medium hover:border-tv-primary hover:text-tv-primary transition-colors whitespace-nowrap flex items-center gap-1.5 shadow-sm"
          >
            <ExternalLink size={13} />
            Full Profile Editor
          </button>
        </div>
      </div>
    ),
    privacy: (
      <div className="space-y-5">
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-[14px] text-tv-text font-medium">Public Profile</p>
            <p className="text-[11px] text-tv-text-s font-mono mt-0.5">Allow others to view your profile page at /u/{username || 'username'}</p>
          </div>
          <button
            onClick={async () => {
              const next = !publicProfile;
              setPublicProfile(next);
              const ok = await updateProfile({ public_profile: next });
              if (!ok) setPublicProfile(!next);
              else toast.success(next ? 'Profile is now public' : 'Profile is now private');
            }}
            role="switch" aria-checked={publicProfile}
            className={`relative w-10 h-5 rounded-full transition-colors duration-150 flex-shrink-0 ${publicProfile ? 'bg-tv-primary' : 'bg-s3'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-150 ${publicProfile ? 'translate-x-5' : ''}`} />
          </button>
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-[14px] text-tv-text font-medium">Show Collections on Profile</p>
            <p className="text-[11px] text-tv-text-s font-mono mt-0.5">Display your public collections on your profile page</p>
          </div>
          <button
            onClick={async () => {
              const next = !showCollections;
              setShowCollections(next);
              const ok = await updateProfile({ show_collections: next });
              if (!ok) setShowCollections(!next);
              else toast.success(next ? 'Collections visible on profile' : 'Collections hidden from profile');
            }}
            role="switch" aria-checked={showCollections}
            className={`relative w-10 h-5 rounded-full transition-colors duration-150 flex-shrink-0 ${showCollections ? 'bg-tv-primary' : 'bg-s3'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-150 ${showCollections ? 'translate-x-5' : ''}`} />
          </button>
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-[14px] text-tv-text font-medium">Show Reviews on Profile</p>
            <p className="text-[11px] text-tv-text-s font-mono mt-0.5">Display recent reviews on your profile page</p>
          </div>
          <button
            onClick={async () => {
              const next = !showReviews;
              setShowReviews(next);
              const ok = await updateProfile({ show_reviews: next });
              if (!ok) setShowReviews(!next);
              else toast.success(next ? 'Reviews visible on profile' : 'Reviews hidden from profile');
            }}
            role="switch" aria-checked={showReviews}
            className={`relative w-10 h-5 rounded-full transition-colors duration-150 flex-shrink-0 ${showReviews ? 'bg-tv-primary' : 'bg-s3'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-150 ${showReviews ? 'translate-x-5' : ''}`} />
          </button>
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-[14px] text-tv-text font-medium">Show Followers on Profile</p>
            <p className="text-[11px] text-tv-text-s font-mono mt-0.5">Display your follower and following counts on your profile</p>
          </div>
          <button
            onClick={async () => {
              const next = !showFollowers;
              setShowFollowers(next);
              const ok = await updateProfile({ show_followers: next });
              if (!ok) setShowFollowers(!next);
              else toast.success(next ? 'Followers visible on profile' : 'Followers hidden from profile');
            }}
            role="switch" aria-checked={showFollowers}
            className={`relative w-10 h-5 rounded-full transition-colors duration-150 flex-shrink-0 ${showFollowers ? 'bg-tv-primary' : 'bg-s3'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-150 ${showFollowers ? 'translate-x-5' : ''}`} />
          </button>
        </div>
        <p className="text-[11px] text-tv-text-s font-mono pt-2 border-t border-tv-border">Reviews and public collections are also discoverable across the platform.</p>
      </div>
    ),
    appearance: (
      <div className="space-y-4">
        <p className="text-[12px] font-mono text-tv-text-m uppercase tracking-widest">Theme</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: 'light', label: 'Light', icon: Sun },
            { key: 'dark', label: 'Dark', icon: Moon },
            { key: 'system', label: 'System', icon: Monitor },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTheme(t.key)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                theme === t.key
                  ? 'border-tv-primary bg-tv-primary-g'
                  : 'border-tv-border bg-surface hover:border-tv-text-s'
              }`}
            >
              <t.icon size={20} className={theme === t.key ? 'text-tv-primary' : 'text-tv-text-s'} />
              <span className={`text-[12px] font-medium ${theme === t.key ? 'text-tv-primary' : 'text-tv-text'}`}>{t.label}</span>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-tv-text-s font-mono pt-2 border-t border-tv-border">
          Fonts: Syne (headings), monospace (UI). Colors follow the ToolScribe editorial palette.
        </p>
      </div>
    ),
    account: (
      <div className="space-y-6">
        {/* Export Data */}
        <div className="bg-surface border border-tv-border rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[14px] text-tv-text font-medium">Export Data</p>
              <p className="text-[11px] text-tv-text-s font-mono mt-0.5">Download all your tools, reviews, collections, and vault data as JSON</p>
            </div>
            <button onClick={handleExportData}
              className="flex items-center gap-1.5 px-4 py-2 border border-tv-border rounded-lg text-[13px] text-tv-text hover:bg-s2 transition-colors">
              <Download size={14} />
              Export
            </button>
          </div>
        </div>

        {/* Sign Out */}
        <div className="bg-surface border border-tv-border rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[14px] text-tv-text font-medium">Sign Out</p>
              <p className="text-[11px] text-tv-text-s font-mono mt-0.5">Sign out of your account on this device</p>
            </div>
            <button onClick={() => { signOut(); navigate('/'); }}
              className="flex items-center gap-1.5 px-4 py-2 border border-tv-border rounded-lg text-[13px] text-tv-text hover:bg-s2 transition-colors">
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        </div>

        {/* Delete Account */}
        <div className="bg-surface border border-red-200 rounded-xl p-5">
          <div className="flex items-start gap-1 mb-3">
            <Trash2 size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[14px] text-red-600 font-medium">Delete Account</p>
              <p className="text-[11px] text-tv-text-s font-mono mt-0.5">
                Permanently delete your account and all associated data. This cannot be undone.
              </p>
            </div>
          </div>
          <input
            type="text"
            value={deleteConfirm}
            onChange={e => setDeleteConfirm(e.target.value)}
            placeholder='Type "DELETE" to confirm'
            className="w-full h-10 bg-s2 border border-red-200 rounded-lg px-3 text-[13px] text-tv-text placeholder:text-tv-text-m focus:outline-none focus:border-red-400 transition-colors mb-3"
          />
          <button
            onClick={handleDeleteAccount}
            disabled={deleteConfirm !== 'DELETE' || deleting}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-[13px] font-medium hover:bg-red-700 disabled:opacity-40 transition-colors"
          >
            {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Delete Account
          </button>
        </div>
      </div>
    ),
  };

  return (
    <>
      <SEO title="Settings" description="Manage your Tool Scribe account settings." path="/settings" />
    <div className="min-h-screen bg-bg">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-[28px] font-bold text-tv-text tracking-tight">Settings</h1>
          <p className="text-[13px] text-tv-text-s font-mono mt-1">Manage your ToolScribe experience</p>
        </div>

        <div className="flex gap-8">
          {/* Sidebar */}
          <nav className="w-44 flex-shrink-0 space-y-0.5">
            {sections.map(s => {
              const Icon = s.icon;
              return (
                <button
                  key={s.key}
                  onClick={() => setActiveSection(s.key)}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-[13px] text-left transition-colors ${
                    activeSection === s.key
                      ? 'bg-tv-text text-bg font-medium'
                      : 'text-tv-text-s hover:text-tv-text hover:bg-s2'
                  }`}
                >
                  <Icon size={15} />
                  {s.label}
                </button>
              );
            })}
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <motion.div key={activeSection} initial={{ opacity: 0, x: 4 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.15 }}>
              {sectionContent[activeSection]}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
    <ProfileSettingsModal
      open={profileModalOpen}
      onClose={() => setProfileModalOpen(false)}
      onSaved={() => {
        refetchProfile();
        setProfileModalOpen(false);
      }}
    />
    </>
  );
}
