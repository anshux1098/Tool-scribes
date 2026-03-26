import { Plus, LogOut, LogIn, Loader2 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth, signOut } from '@/hooks/useAuth';

type Tab = 'vault' | 'discover';

interface NavbarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onAddTool: () => void;
  onAuthClick: () => void;
}

export default function Navbar({ activeTab, onTabChange, onAddTool, onAuthClick }: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();
  const isDetailPage = location.pathname.startsWith('/tool/');

  const handleTabChange = (tab: Tab) => {
    onTabChange(tab);
    if (isDetailPage) navigate('/');
  };

  return (
    <nav className="sticky top-0 z-50 h-14 flex items-center px-6 border-b border-tv-border bg-bg/90"
      style={{ backdropFilter: 'blur(12px)' }}>
      {/* Logo */}
      <div
        className="flex items-center gap-2 mr-10 cursor-pointer select-none"
        onClick={() => { onTabChange('vault'); navigate('/'); }}
      >
        <span className="text-tv-text text-[17px] tracking-tight">
          Tool<em className="font-syne not-italic text-tv-primary">Scribe</em>
        </span>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1">
        {(['vault', 'discover'] as Tab[]).map(tab => {
          const isActive = activeTab === tab && !isDetailPage;
          return (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`px-3 py-1.5 rounded-md text-[13px] font-medium tracking-wide uppercase transition-all duration-150 ${
                isActive
                  ? 'bg-tv-text text-bg'
                  : 'text-tv-text-s hover:text-tv-text'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Add tool — only when signed in */}
        {user && (
          <button
            onClick={onAddTool}
            className="flex items-center gap-1.5 px-3.5 py-1.5 border border-tv-border bg-surface text-tv-text text-[13px] font-medium rounded-lg transition-all duration-150 hover:border-tv-primary hover:text-tv-primary"
          >
            <Plus size={14} />
            Add tool
          </button>
        )}

        {/* Auth button */}
        {loading ? (
          <Loader2 size={15} className="animate-spin text-tv-text-m" />
        ) : user ? (
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-mono text-tv-text-m hidden sm:block truncate max-w-[140px]">
              {user.email}
            </span>
            <button
              onClick={() => signOut()}
              title="Sign out"
              className="p-1.5 rounded-lg hover:bg-s2 text-tv-text-s hover:text-tv-text transition-colors"
            >
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={onAuthClick}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-tv-primary text-white text-[13px] font-medium rounded-lg hover:bg-tv-primary-dark transition-colors"
          >
            <LogIn size={14} />
            Sign in
          </button>
        )}
      </div>
    </nav>
  );
}
