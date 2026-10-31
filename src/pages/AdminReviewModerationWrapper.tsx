import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import AuthModal from '@/components/AuthModal';
import SubmitToolModal from '@/components/SubmitToolModal';
import SearchEverywhere from '@/components/SearchEverywhere';
import AdminReviewModeration from '@/components/AdminReviewModeration';
import { useAuth } from '@/hooks/useAuth';
import { useSearch } from '@/hooks/useSearch';

export default function AdminReviewModerationWrapper() {
  const [activeTab, setActiveTab] = useState<'vault' | 'discover'>('vault');
  
  const [authOpen, setAuthOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const { user } = useAuth();
  
  const search = useSearch();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(prev => !prev); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleAddTool = () => {
    if (!user) { setAuthOpen(true); return; }
    setSubmitOpen(true);
  };

  return (
    <div className="min-h-screen bg-bg">
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onAddTool={handleAddTool}
        onAuthClick={() => setAuthOpen(true)}
        onSearchClick={() => setSearchOpen(true)}
        onSubmitTool={() => setSubmitOpen(true)}
      />
      <AdminReviewModeration />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <SubmitToolModal open={submitOpen} onClose={() => setSubmitOpen(false)} />
      <SearchEverywhere
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        query={search.query}
        onQueryChange={search.setQuery}
        results={search.results}
        loading={search.loading}
        hasQuery={search.hasQuery}
        category={search.filters.category}
        onCategoryChange={search.updateCategory}
      />
    </div>
  );
}
