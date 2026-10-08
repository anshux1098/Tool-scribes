import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import AdminReviewPage from '@/components/AdminReviewPage';
import SubmitToolModal from '@/components/SubmitToolModal';
import SearchEverywhere from '@/components/SearchEverywhere';
import { useAuth } from '@/hooks/useAuth';
import { useSearch } from '@/hooks/useSearch';
import { fetchSubmissions, ToolSubmission } from '@/lib/submission';

export default function AdminReviewWrapper() {
  const [activeTab, setActiveTab] = useState<'vault' | 'discover'>('vault');
  const [submissions, setSubmissions] = useState<ToolSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const { isAdmin, isModerator, loading: authLoading } = useAuth();
  const search = useSearch();

  const load = async () => {
    setLoading(true);
    const { data } = await fetchSubmissions();
    setSubmissions(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center py-24">
        <p className="text-[13px] text-tv-text-m font-mono">Loading...</p>
      </div>
    );
  }

  if (!isAdmin && !isModerator) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center py-24">
        <p className="text-[14px] text-tv-text-s font-mono">Access denied. Admin only.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onAddTool={() => {}}
        onAuthClick={() => {}}
        onSearchClick={() => setSearchOpen(true)}
        onSubmitTool={() => setSubmitOpen(true)}
      />
      <AdminReviewPage submissions={submissions} loading={loading} onRefresh={load} />
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
