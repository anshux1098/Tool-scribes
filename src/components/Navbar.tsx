import { Plus, LogOut, LogIn, Loader2, Search, Send, Shield, Rss, Hash, User, Bookmark, PenLine, Settings, LayoutDashboard, FolderPlus, Layers, Bell, Sparkles, AlertCircle, Menu, X } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth, signOut } from '@/hooks/useAuth';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import ThemeToggle from '@/components/ThemeToggle';
import NotificationPanel from '@/components/NotificationPanel';
import { useNotifications } from '@/hooks/useNotifications';
import { useModerationCounts } from '@/hooks/useModerationCounts';

type Tab = 'vault' | 'discover';

interface NavbarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onAddTool: () => void;
  onAuthClick: () => void;
  onSearchClick?: () => void;
  onAskClick?: () => void;
  onSubmitTool?: () => void;
  onCreateCollection?: () => void;
}

/** Platform string for ⌘K vs Ctrl+K hints. userAgentData is Chromium-only. */
function detectPlatform(): string | undefined {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return nav.userAgentData?.platform ?? nav.platform;
}

export default function Navbar({ activeTab, onTabChange, onAddTool, onAuthClick, onSearchClick, onAskClick, onSubmitTool, onCreateCollection }: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, isAdmin, isModerator } = useAuth();
  const isMainPage = location.pathname === '/';
  const isAdminPage = location.pathname.startsWith('/admin/');
  const [myUsername, setMyUsername] = useState<string | null>(null);
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, loading: notifLoading, markAsSeen, refresh: refreshNotif } = useNotifications();
  const { data: modCounts } = useModerationCounts(isAdmin || isModerator);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) { setMyUsername(null); setMyAvatar(null); return; }
    supabase.from('profiles').select('username, avatar_url').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        setMyUsername(data?.username as string ?? null);
        setMyAvatar(data?.avatar_url as string ?? null);
      });
  }, [user]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleTabChange = (tab: Tab) => {
    onTabChange(tab);
    if (!isMainPage) navigate('/');
  };

  const initial = (myUsername || user?.email || '?').charAt(0).toUpperCase();

  const menuItems = [
    { label: 'My Profile', icon: User, href: '/profile' },
    { label: 'My Collections', icon: Bookmark, href: '/collections/me' },
    { label: 'My Submissions', icon: Send, href: '/submissions/me' },
    { label: 'My Reviews', icon: PenLine, href: '/reviews/me' },
    { label: 'Settings', icon: Settings, href: '/settings', separator: true },
  ];

  if (isAdmin) {
    menuItems.push({ label: 'Admin Dashboard', icon: LayoutDashboard, href: '/admin', separator: true });
  }

  // ─── Mobile drawer nav items ──────────────────────────────────────────────
  const drawerNavItems = useCallback((close: () => void) => {
    const nav = (label: string, path: string, active?: boolean) => (
      <button
        key={`drawer-${label}`}
        onClick={() => { close(); navigate(path); }}
        className={`w-full text-left px-5 py-3 text-[14px] font-medium transition-colors ${
          active ? 'bg-tv-primary/10 text-tv-primary' : 'text-tv-text hover:bg-s2'
        }`}
      >
        {label}
      </button>
    );

    return (
      <div className="flex flex-col py-2">
        <div className="px-5 py-2 text-[10px] font-mono text-tv-text-m uppercase tracking-widest">Browse</div>
        {nav('Vault', '/', activeTab === 'vault' && isMainPage)}
        {nav('Discover', '/', activeTab === 'discover' && isMainPage)}
        {nav('Collections', '/collections', location.pathname === '/collections' || location.pathname.startsWith('/collections/'))}
        {nav('Tags', '/tags', location.pathname === '/tags')}

        {user && (
          <>
            <div className="mt-3 px-5 py-2 text-[10px] font-mono text-tv-text-m uppercase tracking-widest">Community</div>
            {nav('Following', '/following', location.pathname === '/following')}
            {onSubmitTool && (
              <button
                onClick={() => { close(); onSubmitTool(); }}
                className="w-full text-left px-5 py-3 text-[14px] font-medium text-tv-text hover:bg-s2 transition-colors"
              >
                Submit Tool
              </button>
            )}
          </>
        )}

        {(isAdmin || isModerator) && (
          <>
            <div className="mt-3 px-5 py-2 text-[10px] font-mono text-tv-text-m uppercase tracking-widest">Moderation</div>
            {nav('Review Queue', '/admin/review')}
            {isAdmin && (
              <>
                {nav('Reviews', '/admin/reviews')}
                {nav('Tags', '/admin/tags')}
                {nav('Alternatives', '/admin/alternatives')}
                {nav('Health', '/admin/health')}
              </>
            )}
          </>
        )}
      </div>
    );
  }, [activeTab, isMainPage, location.pathname, user, isAdmin, isModerator, onSubmitTool, navigate]);

  // ─── Click handler to prevent drawer close when interacting with drawer ──
  const drawerRef = useRef<HTMLDivElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // Close drawer on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drawerOpen) {
        setDrawerOpen(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [drawerOpen]);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  return (
    <nav aria-label="Main navigation" className="sticky top-0 z-50 h-14 flex items-center px-4 sm:px-6 border-b border-tv-border bg-bg/90"
      style={{ backdropFilter: 'blur(12px)' }}>
      {/* Hamburger — visible on mobile only */}
      <button
        onClick={() => setDrawerOpen(true)}
        className="md:hidden p-2 mr-2 rounded-lg text-tv-text-s hover:text-tv-text hover:bg-s2 transition-colors"
        aria-label="Open navigation menu"
        aria-expanded={drawerOpen}
      >
        <Menu size={20} />
      </button>

      {/* Logo */}
      <div
        className="flex items-center gap-2 mr-4 sm:mr-6 cursor-pointer select-none flex-shrink-0"
        onClick={() => { onTabChange('vault'); navigate('/'); }}
      >
        <span className="text-tv-text text-[17px] tracking-tight whitespace-nowrap">
          Tool<em className="font-syne not-italic text-tv-primary">Scribe</em>
        </span>
      </div>

      {/* Desktop nav items — hidden on mobile */}
      <div className="hidden md:flex items-center gap-1 overflow-x-auto">
        {(['vault', 'discover'] as Tab[]).map(tab => {
          const isActive = activeTab === tab && isMainPage;
          return (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`px-3 py-1.5 rounded-md text-[13px] font-medium tracking-wide uppercase transition-all duration-150 whitespace-nowrap ${
                isActive
                  ? 'bg-tv-text text-bg'
                  : 'text-tv-text-s hover:text-tv-text'
              }`}
            >
              {tab}
            </button>
          );
        })}

        {/* Submit tool link */}
        {onSubmitTool && (
          <button
            onClick={onSubmitTool}
            className="ml-3 px-3 py-1.5 rounded-md text-[13px] font-medium tracking-wide uppercase text-tv-text-s hover:text-tv-primary transition-all duration-150 flex items-center gap-1.5 whitespace-nowrap"
          >
            <Send size={12} />
            Submit
          </button>
        )}

        {/* Collections link */}
        <button
          onClick={() => navigate('/collections')}
          className={`ml-1 px-3 py-1.5 rounded-md text-[13px] font-medium tracking-wide uppercase transition-all duration-150 flex items-center gap-1.5 whitespace-nowrap ${
            location.pathname === '/collections' || location.pathname.startsWith('/collections/')
              ? 'bg-tv-text text-bg'
              : 'text-tv-text-s hover:text-tv-text'
          }`}
        >
          <Layers size={12} />
          Collections
        </button>

        {/* Create Collection link */}
        {onCreateCollection && user && (
          <button
            onClick={onCreateCollection}
            className="ml-1 px-3 py-1.5 rounded-md text-[13px] font-medium tracking-wide uppercase text-tv-text-s hover:text-tv-primary transition-all duration-150 flex items-center gap-1.5 whitespace-nowrap"
          >
            <FolderPlus size={12} />
            Collection
          </button>
        )}

        {/* Following link */}
        {user && (
          <button
            onClick={() => navigate('/following')}
            className={`ml-1 px-3 py-1.5 rounded-md text-[13px] font-medium tracking-wide uppercase transition-all duration-150 flex items-center gap-1.5 whitespace-nowrap ${
              location.pathname === '/following'
                ? 'bg-tv-text text-bg'
                : 'text-tv-text-s hover:text-tv-text'
            }`}
          >
            <Rss size={12} />
            Following
          </button>
        )}

        {/* Admin links with moderation badges */}
        {(isAdmin || isModerator) && (
          <>
            <button
              onClick={() => navigate('/admin/review')}
              className={`ml-1 px-3 py-1.5 rounded-md text-[13px] font-medium tracking-wide uppercase transition-all duration-150 flex items-center gap-1.5 whitespace-nowrap ${
                isAdminPage && location.pathname === '/admin/review'
                  ? 'bg-amber-100 text-amber-800'
                  : 'text-tv-text-s hover:text-amber-700'
              }`}
            >
              <Shield size={12} />
              Review
              {modCounts && modCounts.pendingTools > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-mono font-bold leading-none animate-pulse">
                  {modCounts.pendingTools > 99 ? '99+' : modCounts.pendingTools}
                </span>
              )}
            </button>
            {isAdmin && (<>
            <button
              onClick={() => navigate('/admin/reviews')}
              className={`ml-1 px-3 py-1.5 rounded-md text-[13px] font-medium tracking-wide uppercase transition-all duration-150 flex items-center gap-1.5 whitespace-nowrap ${
                isAdminPage && location.pathname === '/admin/reviews'
                  ? 'bg-amber-100 text-amber-800'
                  : 'text-tv-text-s hover:text-amber-700'
              }`}
            >
              <Shield size={12} />
              Reviews
              {modCounts && modCounts.pendingReviews > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-mono font-bold leading-none animate-pulse">
                  {modCounts.pendingReviews > 99 ? '99+' : modCounts.pendingReviews}
                </span>
              )}
            </button>
            <button
              onClick={() => navigate('/admin/tags')}
              className={`ml-1 px-3 py-1.5 rounded-md text-[13px] font-medium tracking-wide uppercase transition-all duration-150 flex items-center gap-1.5 whitespace-nowrap ${
                isAdminPage && location.pathname === '/admin/tags'
                  ? 'bg-amber-100 text-amber-800'
                  : 'text-tv-text-s hover:text-amber-700'
              }`}
            >
              <Hash size={12} />
              Tags
              {modCounts && modCounts.pendingTags > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-mono font-bold leading-none animate-pulse">
                  {modCounts.pendingTags > 99 ? '99+' : modCounts.pendingTags}
                </span>
              )}
            </button>
            <button
              onClick={() => navigate('/admin/alternatives')}
              className={`ml-1 px-3 py-1.5 rounded-md text-[13px] font-medium tracking-wide uppercase transition-all duration-150 flex items-center gap-1.5 whitespace-nowrap ${
                isAdminPage && location.pathname === '/admin/alternatives'
                  ? 'bg-amber-100 text-amber-800'
                  : 'text-tv-text-s hover:text-amber-700'
              }`}
            >
              <Shield size={12} />
              Alternatives
              {modCounts && modCounts.pendingAlternatives > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-mono font-bold leading-none animate-pulse">
                  {modCounts.pendingAlternatives > 99 ? '99+' : modCounts.pendingAlternatives}
                </span>
              )}
            </button>
            <button
              onClick={() => navigate('/admin/health')}
              className={`ml-1 px-3 py-1.5 rounded-md text-[13px] font-medium tracking-wide uppercase transition-all duration-150 flex items-center gap-1.5 whitespace-nowrap ${
                isAdminPage && location.pathname === '/admin/health'
                  ? 'bg-amber-100 text-amber-800'
                  : 'text-tv-text-s hover:text-amber-700'
              }`}
            >
              <Shield size={12} />
              Health
            </button>
            </>)}
          </>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        {onAskClick && (
          <button
            onClick={onAskClick}
            className="flex items-center gap-1.5 px-2 py-1.5 border border-tv-border bg-surface text-tv-text-s text-[13px] font-medium rounded-lg transition-all duration-150 hover:border-tv-primary hover:text-tv-primary"
            title="Ask ToolScribe AI (Ctrl+Shift+K)"
          >
            <Sparkles size={14} />
            <span className="hidden sm:inline text-[11px] font-mono text-tv-text-m">Ask AI</span>
          </button>
        )}
        {onSearchClick && (
          <button
            onClick={onSearchClick}
            className="flex items-center gap-1.5 px-2 py-1.5 border border-tv-border bg-surface text-tv-text-s text-[13px] font-medium rounded-lg transition-all duration-150 hover:border-tv-primary hover:text-tv-primary"
            title="Search (Ctrl+K)"
          >
            <Search size={14} />
            <span className="hidden sm:inline text-[11px] font-mono text-tv-text-m">Search</span>
            <kbd className="hidden lg:inline-flex px-1 py-0.5 rounded bg-s2 text-[10px] font-mono text-tv-text-m border border-tv-border">
              {(detectPlatform() ?? '').includes('Mac') ? '⌘K' : 'Ctrl+K'}
            </kbd>
          </button>
        )}
        <ThemeToggle />

        {/* Notification bell */}
        {user && (
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => { setNotifOpen(!notifOpen); if (!notifOpen) { markAsSeen(); refreshNotif(); } }}
              className="relative p-2 rounded-lg text-tv-text-s hover:text-tv-text hover:bg-s2 transition-colors"
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-mono font-bold leading-none min-w-[18px] min-h-[18px]">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            {notifOpen && (
              <NotificationPanel
                notifications={notifications}
                unreadCount={unreadCount}
                loading={notifLoading}
                onClose={() => { setNotifOpen(false); markAsSeen(); }}
              />
            )}
          </div>
        )}

        {/* Add tool — only when signed in */}
        {user && (
          <button
            onClick={onAddTool}
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 border border-tv-border bg-surface text-tv-text text-[13px] font-medium rounded-lg transition-all duration-150 hover:border-tv-primary hover:text-tv-primary"
          >
            <Plus size={14} />
            Add tool
          </button>
        )}

        {/* Moderation indicator */}
        {(isAdmin || isModerator) && modCounts && modCounts.totalPending > 0 && (
          <button
            onClick={() => { navigate('/admin'); }}
            className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[11px] font-mono font-medium hover:bg-red-100 transition-colors"
            title={`${modCounts.totalPending} items pending moderation`}
          >
            <AlertCircle size={13} />
            <span className="hidden md:inline">{modCounts.totalPending}</span>
          </button>
        )}

        {/* Auth section */}
        {loading ? (
          <Loader2 size={15} className="animate-spin text-tv-text-m" />
        ) : user ? (
          <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                title="Profile menu"
                aria-label="Profile menu"
                aria-expanded={menuOpen}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center flex-shrink-0 ring-2 ring-offset-2 ring-offset-bg ring-transparent hover:ring-tv-primary/30 overflow-hidden"
              >
                {myAvatar ? (
                  <img src={myAvatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="w-full h-full bg-tv-primary text-white text-[14px] font-syne font-bold flex items-center justify-center">
                    {initial}
                  </span>
                )}
              </button>

            {/* Dropdown menu */}
            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-surface border-2 border-tv-border rounded-xl shadow-brutal py-1.5 overflow-hidden z-[60]">
                {menuItems.map((item, i) => (
                  <div key={item.label}>
                    {item.separator && i > 0 && <div className="mx-3 my-1 h-px bg-tv-border/20" />}
                      <button
                        onClick={() => { setMenuOpen(false); navigate(item.href); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-tv-text hover:bg-s2 transition-colors text-left"
                      >
                        <item.icon size={15} className="text-tv-text-s flex-shrink-0" />
                        {item.label}
                      </button>
                  </div>
                ))}
              {onCreateCollection && (
                <>
                  <div className="mx-3 my-1 h-px bg-tv-border/20" />
                  <button
                    onClick={() => { setMenuOpen(false); onCreateCollection(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-tv-text hover:bg-s2 transition-colors text-left"
                  >
                    <FolderPlus size={15} className="text-tv-text-s flex-shrink-0" />
                    Create Collection
                  </button>
                </>
              )}
              <div className="mx-3 my-1 h-px bg-tv-border/20" />
              <button
                onClick={() => { setMenuOpen(false); signOut(); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-tv-text-s hover:bg-s2 transition-colors text-left"
              >
                <LogOut size={15} className="flex-shrink-0" />
                Logout
              </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={onAuthClick}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-tv-primary text-white text-[13px] font-medium rounded-lg hover:bg-tv-primary-dark transition-colors"
          >
            <LogIn size={14} />
            <span className="hidden sm:inline">Sign in</span>
          </button>
        )}
      </div>

      {/* ─── Mobile Drawer ──────────────────────────────────────────────── */}
      {/* Overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-[70] bg-black/40 md:hidden"
          onClick={closeDrawer}
          aria-hidden="true"
        />
      )}

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`fixed top-0 left-0 z-[80] h-full w-72 max-w-[80vw] bg-surface border-r border-tv-border shadow-brutal transform transition-transform duration-200 ease-out md:hidden ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-tv-border">
          <span className="text-tv-text text-[17px] tracking-tight font-syne">
            Tool<em className="not-italic text-tv-primary">Scribe</em>
          </span>
          <button
            onClick={closeDrawer}
            className="p-2 rounded-lg text-tv-text-s hover:text-tv-text hover:bg-s2 transition-colors"
            aria-label="Close navigation menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Drawer body */}
        <div className="overflow-y-auto h-[calc(100%-3.5rem)]">
          {drawerNavItems(closeDrawer)}

          {/* Drawer footer — actions */}
          <div className="border-t border-tv-border mt-auto">
            {user ? (
              <div className="px-5 py-4 space-y-3">
                <button
                  onClick={() => { closeDrawer(); onAddTool(); }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-tv-border bg-surface text-tv-text text-[13px] font-medium rounded-lg hover:bg-s2 transition-colors"
                >
                  <Plus size={14} />
                  Add tool
                </button>
                <button
                  onClick={() => { closeDrawer(); signOut(); }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[13px] text-tv-text-s hover:text-red-600 transition-colors"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            ) : (
              <div className="px-5 py-4">
                <button
                  onClick={() => { closeDrawer(); onAuthClick(); }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-tv-primary text-white text-[13px] font-medium rounded-lg hover:bg-tv-primary-dark transition-colors"
                >
                  <LogIn size={14} />
                  Sign in
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
