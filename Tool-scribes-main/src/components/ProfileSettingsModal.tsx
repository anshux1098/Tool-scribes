import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Save, User, AtSign, FileText, Globe, MapPin, Github, Twitter, Linkedin, Hash, Eye, EyeOff, Bookmark, Link } from 'lucide-react';
import { useCurrentProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import FocusTrap from '@/components/FocusTrap';
import AvatarUpload from '@/components/AvatarUpload';
import { useStorageUpload } from '@/hooks/useStorageUpload';
import { CURATOR_BADGES, CuratorBadge } from '@/lib/types';

interface ProfileSettingsModalProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export default function ProfileSettingsModal({ open, onClose, onSaved }: ProfileSettingsModalProps) {
  const { user } = useAuth();
  const { profile, loading, updateProfile } = useCurrentProfile();

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [tagline, setTagline] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');
  const [github, setGithub] = useState('');
  const [twitter, setTwitter] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [publicProfile, setPublicProfile] = useState(false);
  const [curatorBadge, setCuratorBadge] = useState<CuratorBadge>('none');
  const [showReviews, setShowReviews] = useState(true);
  const [showCollections, setShowCollections] = useState(true);
  const [showFollowers, setShowFollowers] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [featuredCollectionId, setFeaturedCollectionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [contactUrl, setContactUrl] = useState('');
  const [signatureQuote, setSignatureQuote] = useState('');
  const [shelf, setShelf] = useState<{toolId: string, name: string}[]>([]);
  const [allTools, setAllTools] = useState<{id: string, name: string}[]>([]);
  const [isShelfLoading, setIsShelfLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { upload: uploadBanner } = useStorageUpload('banners');

  const [collections, setCollections] = useState<{ id: string; name: string; toolCount: number }[]>([]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setUsername(profile.username ?? '');
      setTagline(profile.tagline ?? '');
      setBio(profile.bio);
      setLocation(profile.location ?? '');
      setWebsite(profile.website ?? '');
      setGithub(profile.github ?? '');
      setTwitter(profile.twitter ?? '');
      setLinkedin(profile.linkedin ?? '');
      setPublicProfile(profile.publicProfile);
      setCuratorBadge(profile.curatorBadge || 'none');
      setShowReviews(profile.showReviews !== false);
      setShowCollections(profile.showCollections !== false);
      setShowFollowers(profile.showFollowers !== false);
      setAvatarUrl(profile.avatarUrl || '');
      setBannerUrl(profile.bannerUrl || '');
      setFeaturedCollectionId(profile.featuredCollectionId || null);
      setContactUrl(profile.contact_url || '');
      setSignatureQuote(profile.signature_quote || '');
    }
  }, [profile]);

  useEffect(() => {
    if (!open || !user) return;
    
    // Fetch collections, shelf & all tools
    setIsShelfLoading(true);
    Promise.all([
      supabase.from('curator_shelf').select('tool_id, tools(name)').eq('user_id', user.id).order('position'),
      supabase.from('tools').select('id, name'),
      supabase.from('collections').select('id, name').eq('user_id', user.id).order('name'),
    ]).then(([shelfRes, toolsRes, colRes]) => {
      if (shelfRes.data) {
        setShelf(shelfRes.data.map(r => {
          const t = Array.isArray(r.tools) ? r.tools[0] : r.tools;
          return { toolId: r.tool_id, name: t ? (t as any).name : 'Tool' };
        }));
      }
      if (toolsRes.data) {
        setAllTools(toolsRes.data);
      }
      if (colRes.data) {
        setCollections(colRes.data.map(c => ({ id: c.id as string, name: c.name as string, toolCount: 0 })));
      }
    }).finally(() => setIsShelfLoading(false));
  }, [open, user]);


  const handleSave = async () => {
    if (!username.trim()) { setError('Username is required for a public profile.'); return; }
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username.trim())) {
      setError('Username must be 3–30 characters (letters, numbers, underscores).');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');

    let cleanedContact = contactUrl.trim();
    if (cleanedContact && !/^https?:\/\//i.test(cleanedContact)) {
      cleanedContact = `https://${cleanedContact}`;
    }
    if (cleanedContact && !/^https?:\/\/[^\s$.?#].[^\s]*$/i.test(cleanedContact)) {
      setError('Please enter a valid URL for the contact method.');
      setSaving(false);
      return;
    }

    const payload = {
      username: username.trim().toLowerCase(),
      display_name: displayName.trim(),
      tagline: tagline.trim(),
      bio: bio.trim(),
      location: location.trim(),
      website: website.trim(),
      github: github.trim(),
      twitter: twitter.trim(),
      linkedin: linkedin.trim(),
      public_profile: publicProfile,
      curator_badge: curatorBadge,
      show_reviews: showReviews,
      show_collections: showCollections,
      show_followers: showFollowers,
      avatar_url: avatarUrl,
      banner_url: bannerUrl,
      featured_collection_id: featuredCollectionId,
      contact_url: cleanedContact,
      signature_quote: signatureQuote,
    };

    const ok = await updateProfile(payload);

    if (ok) {
      setSuccess('Profile saved!');
      setTimeout(() => { onSaved?.(); }, 1000);
    } else {
      const errMsg = 'Failed to save. Check console for details. Username may be taken or server rejected the update.';
      console.error('[ProfileSettingsModal] save failed');
      setError(errMsg);
    }
    setSaving(false);
  };

  const inputClass = "w-full h-10 bg-s2 border border-tv-border rounded-lg px-3 text-[13px] text-tv-text placeholder:text-tv-text-m focus:outline-none focus:border-tv-primary transition-colors";
  const textareaClass = "w-full bg-s2 border border-tv-border rounded-lg px-3 py-2.5 text-[13px] text-tv-text placeholder:text-tv-text-m focus:outline-none focus:border-tv-primary transition-colors resize-none";

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="profile-settings-title">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0"
            style={{ backgroundColor: 'rgba(28,25,23,0.5)', backdropFilter: 'blur(6px)' }}
            onClick={onClose}
          />
          <FocusTrap active={open}>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
              className="relative z-10 w-full max-w-lg bg-surface border border-tv-border rounded-2xl shadow-card overflow-hidden max-h-[90vh] flex flex-col"
            >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-tv-border flex-shrink-0">
              <span id="profile-settings-title" className="text-[11px] font-mono text-tv-text-m uppercase tracking-widest">Curator Profile Settings</span>
              <button onClick={onClose} aria-label="Close dialog" className="p-2.5 rounded hover:bg-s2 text-tv-text-s">
                <X size={16} />
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={18} className="animate-spin text-tv-text-m" />
              </div>
            ) : (
              <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
                {/* ── Avatar ── */}
                <div>
                  <label className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-2 block">Profile Photo</label>
                  <div className="flex items-center gap-4">
                    <AvatarUpload
                      currentUrl={avatarUrl}
                      onUpload={url => setAvatarUrl(url)}
                      onRemove={() => setAvatarUrl('')}
                    />
                    <p className="text-[11px] font-mono text-tv-text-s">Upload a square photo. Recommended size: 400×400px.</p>
                  </div>
                </div>

                {/* ── Banner ── */}
                <div>
                  <label className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-2 block">Profile Banner</label>
                  <div
                    className="relative w-full h-32 rounded-xl overflow-hidden group"
                    style={{ backgroundColor: '#E5E0D6' }}
                  >
                    {bannerUrl ? (
                      <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[11px] font-mono text-tv-text-m">No banner image</div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = async (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (!file) return;
                            const url = await uploadBanner(file);
                            if (url) setBannerUrl(url);
                          };
                          input.click();
                        }}
                        className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors shadow-sm"
                        title="Upload banner"
                      >
                        <Globe size={14} style={{ color: '#1a1a1a' }} />
                      </button>
                      {bannerUrl && (
                        <button
                          onClick={() => setBannerUrl('')}
                          className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors shadow-sm"
                          title="Remove banner"
                        >
                          <X size={14} style={{ color: '#DC2626' }} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Display Name ── */}
                <div>
                  <label className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-1.5 block">Display Name</label>
                  <div className="relative">
                    <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-tv-text-m" />
                    <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your display name" className={inputClass + ' pl-9'} />
                  </div>
                </div>

                {/* ── Username ── */}
                <div>
                  <label className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-1.5 block">Username</label>
                  <div className="relative">
                    <AtSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-tv-text-m" />
                    <input type="text" value={username} onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} placeholder="your_username" className={inputClass + ' pl-9 font-mono'} />
                  </div>
                  <p className="text-[10px] font-mono text-tv-text-m mt-1">Profile URL: /u/{username || 'your_username'}</p>
                </div>

                {/* ── Signature Quote ── */}
                <div>
                  <label className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-1.5 block">Signature Quote</label>
                  <input type="text" value={signatureQuote} onChange={e => setSignatureQuote(e.target.value)} placeholder="Building a better toolkit..." className={inputClass} />
                </div>

                {/* ── Bio ── */}
                <div>
                  <label className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-1.5 block">Bio</label>
                  <div className="relative">
                    <FileText size={13} className="absolute left-3 top-3 text-tv-text-m" />
                    <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell us about the tools you curate…" rows={3} className={textareaClass + ' pl-9'} />
                  </div>
                </div>

                {/* ── Location & Website ── */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-1.5 block">Location</label>
                    <div className="relative">
                      <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-tv-text-m" />
                      <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="City, Country" className={inputClass + ' pl-9'} />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-1.5 block">Website</label>
                    <div className="relative">
                      <Globe size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-tv-text-m" />
                      <input type="text" value={website} onChange={e => setWebsite(e.target.value)} placeholder="example.com" className={inputClass + ' pl-9'} />
                    </div>
                  </div>
                </div>

                {/* ── Social Links ── */}
                <div>
                  <label className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-2 block">Social Links</label>
                  <div className="space-y-2">
                    <div className="relative">
                      <Github size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-tv-text-m" />
                      <input type="text" value={github} onChange={e => setGithub(e.target.value)} placeholder="GitHub username" className={inputClass + ' pl-9'} />
                    </div>
                    <div className="relative">
                      <Twitter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-tv-text-m" />
                      <input type="text" value={twitter} onChange={e => setTwitter(e.target.value)} placeholder="Twitter/X handle" className={inputClass + ' pl-9'} />
                    </div>
                    <div className="relative">
                      <Linkedin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-tv-text-m" />
                      <input type="text" value={linkedin} onChange={e => setLinkedin(e.target.value)} placeholder="LinkedIn URL or handle" className={inputClass + ' pl-9'} />
                    </div>
                  </div>
                </div>

                {/* ── Contact URL ── */}
                <div>
                  <label className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-1.5 block">Contact Method</label>
                  <div className="relative">
                    <Link size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-tv-text-m" />
                    <input type="text" value={contactUrl} onChange={e => setContactUrl(e.target.value)} placeholder="https://discord.gg/..." className={inputClass + ' pl-9'} />
                  </div>
                  <p className="text-[10px] font-mono text-tv-text-m mt-1">Link for viewers to reach you</p>
                  <p className="text-[10px] font-mono text-tv-text-m/60 mt-0.5">Examples: Discord invite, Telegram, Twitter/X, LinkedIn, personal website</p>
                </div>

                {/* ── Curator Badge ── */}
                <div>
                  <label className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-2 block">Curator Badge</label>
                  <div className="grid grid-cols-2 gap-2">
                    {CURATOR_BADGES.filter(b => b.key !== 'none').map(b => (
                      <button
                        key={b.key}
                        onClick={() => setCuratorBadge(b.key)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-[12px] text-left transition-all ${
                          curatorBadge === b.key
                            ? 'border-2 font-medium'
                            : 'border border-tv-border hover:bg-s2'
                        }`}
                        style={curatorBadge === b.key ? { borderColor: b.color, backgroundColor: b.bg, color: b.color } : {}}
                      >
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: b.color }} />
                        <div>
                          <p className="font-medium">{b.label}</p>
                          <p className="text-[10px] text-tv-text-s">{b.description}</p>
                        </div>
                      </button>
                    ))}
                    <button
                      onClick={() => setCuratorBadge('none')}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-[12px] text-left transition-all border ${
                        curatorBadge === 'none' ? 'border-tv-primary bg-tv-primary-g font-medium' : 'border-tv-border hover:bg-s2'
                      }`}
                    >
                      <X size={12} className="text-tv-text-m" />
                      <span>None</span>
                    </button>
                  </div>
                </div>

                {/* ── Featured Collection ── */}
                <div>
                  <label className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-1.5 block">Featured Collection</label>
                  <select
                    value={featuredCollectionId || ''}
                    onChange={e => setFeaturedCollectionId(e.target.value || null)}
                    className={inputClass}
                  >
                    <option value="">None (no featured collection)</option>
                    {collections.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* ── Currently Loving (Shelf) ── */}
                <div>
                  <label className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-2 block">Currently Loving (Max 3)</label>
                  <div className="space-y-2">
                    {shelf.map((item, idx) => (
                      <div key={item.toolId} className="flex items-center justify-between bg-s2 p-2 rounded-lg">
                        <span className="text-[12px]">{item.name}</span>
                        <button onClick={() => {
                          supabase.from('curator_shelf').delete().eq('tool_id', item.toolId).then(() => {
                            setShelf(shelf.filter(s => s.toolId !== item.toolId));
                          });
                        }} className="text-red-500"><X size={14}/></button>
                      </div>
                    ))}
                    {shelf.length < 3 && (
                      <select 
                        className={inputClass}
                        onChange={(e) => {
                          const toolId = e.target.value;
                          if (!toolId) return;
                          supabase.from('curator_shelf').insert({ user_id: user?.id, tool_id: toolId, position: shelf.length }).then(({error}) => {
                             if(!error) {
                               const tool = allTools.find(t => t.id === toolId);
                               if(tool) setShelf([...shelf, {toolId: tool.id, name: tool.name}]);
                             }
                          });
                        }}
                      >
                        <option value="">Add a tool...</option>
                        {allTools.filter(t => !shelf.find(s => s.toolId === t.id)).map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* ── Visibility Controls ── */}
                <div>
                  <label className="text-[10px] font-mono text-tv-text-m uppercase tracking-widest mb-2 block">Visibility</label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <Eye size={13} className="text-tv-text-m" />
                        <span className="text-[13px] text-tv-text">Show collections on profile</span>
                      </div>
                      <button
                        onClick={() => setShowCollections(!showCollections)}
                        role="switch" aria-checked={showCollections}
                        className={`relative w-9 h-4.5 rounded-full transition-colors duration-150 ${showCollections ? 'bg-tv-primary' : 'bg-s3'}`}
                        style={{ width: 36, height: 18 }}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform duration-150 ${showCollections ? 'translate-x-[18px]' : ''}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <Eye size={13} className="text-tv-text-m" />
                        <span className="text-[13px] text-tv-text">Show reviews on profile</span>
                      </div>
                      <button
                        onClick={() => setShowReviews(!showReviews)}
                        role="switch" aria-checked={showReviews}
                        className={`relative w-9 h-4.5 rounded-full transition-colors duration-150 ${showReviews ? 'bg-tv-primary' : 'bg-s3'}`}
                        style={{ width: 36, height: 18 }}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform duration-150 ${showReviews ? 'translate-x-[18px]' : ''}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <EyeOff size={13} className="text-tv-text-m" />
                        <span className="text-[13px] text-tv-text">Show followers</span>
                      </div>
                      <button
                        onClick={() => setShowFollowers(!showFollowers)}
                        role="switch" aria-checked={showFollowers}
                        className={`relative w-9 h-4.5 rounded-full transition-colors duration-150 ${showFollowers ? 'bg-tv-primary' : 'bg-s3'}`}
                        style={{ width: 36, height: 18 }}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform duration-150 ${showFollowers ? 'translate-x-[18px]' : ''}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <Globe size={13} className="text-tv-text-m" />
                        <span className="text-[13px] text-tv-text">Public profile</span>
                      </div>
                      <button
                        onClick={() => setPublicProfile(!publicProfile)}
                        role="switch" aria-checked={publicProfile}
                        className={`relative w-9 h-4.5 rounded-full transition-colors duration-150 ${publicProfile ? 'bg-tv-primary' : 'bg-s3'}`}
                        style={{ width: 36, height: 18 }}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform duration-150 ${publicProfile ? 'translate-x-[18px]' : ''}`} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Error / success */}
                {error && (
                  <p role="alert" className="text-[12px] font-mono text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}
                {success && (
                  <p role="status" className="text-[12px] font-mono text-tv-primary bg-tv-primary-g border border-tv-primary/20 rounded-lg px-3 py-2">
                    {success}
                  </p>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="px-6 py-4 border-t border-tv-border bg-s2 flex items-center justify-between flex-shrink-0">
              <span className="text-[10px] font-mono text-tv-text-m">
                Profile URL: /u/{username || '—'}
              </span>
              <button
                onClick={handleSave}
                disabled={saving || loading}
                className="flex items-center gap-1.5 px-4 py-2 bg-tv-primary text-white rounded-lg text-[13px] font-medium hover:bg-tv-primary-dark disabled:opacity-40 transition-colors"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Save Changes
              </button>
            </div>
            </motion.div>
          </FocusTrap>
        </div>
      )}
    </AnimatePresence>
  );
}
