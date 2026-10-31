import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import AuthModal from '@/components/AuthModal';
import AddToCollectionModal from '@/components/AddToCollectionModal';
import SubmitToolModal from '@/components/SubmitToolModal';
import ToolDetailPage from '@/pages/ToolDetailPage';
import SearchEverywhere from '@/components/SearchEverywhere';
import ToolRecommendations from '@/components/ToolRecommendations';
import AlternativesSection from '@/components/AlternativesSection';
import SuggestAlternativeModal from '@/components/SuggestAlternativeModal';
import { useTools } from '@/hooks/useTools';
import { useAuth } from '@/hooks/useAuth';
import { useCollections } from '@/hooks/useCollections';
import { useSearch } from '@/hooks/useSearch';
import { supabase } from '@/lib/supabase';
import { fetchToolHealth } from '@/lib/health';
import { useReviews } from '@/hooks/useReviews';
import { generateAiProfile } from '@/lib/generate-ai-profile';
import { toast } from 'sonner';

export default function ToolDetailWrapper() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<'vault' | 'discover'>('vault');
  
  const [authOpen, setAuthOpen] = useState(false);
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [toolCollectionIds, setToolCollectionIds] = useState<number[]>([]);
  const [toolCollectionActivities, setToolCollectionActivities] = useState<{ collectionId: number; collectionName: string; addedAt: string }[]>([]);
  const [suggestModalOpen, setSuggestModalOpen] = useState(false);
  const { user, isAdmin, isModerator } = useAuth();
  const { tools, loading, toggleUpvote, saveToVault, toggleFavorite, removeFromVault, updateNotes, addTag, removeTag, recordVisit, updateScreenshot, updateAiProfile, fetchSingleTool } = useTools();
  const { collections, addToolToCollection, removeToolFromCollection, createCollection } = useCollections();
  const search = useSearch();

  const [fetchingFallback, setFetchingFallback] = useState(false);
  const currentTool = id ? tools.find(t => t.id === Number(id)) : null;
  const [healthStatus, setHealthStatus] = useState<string | undefined>();
  const { reviews, myReview, submitReview, deleteReview } = useReviews(currentTool?._uuid);
  const mountedRef = useRef(true);

  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  useEffect(() => {
    if (!id) return;
    const numId = Number(id);
    if (!Number.isFinite(numId)) return;
    if (!currentTool && !loading && !fetchingFallback) {
      setFetchingFallback(true);
      fetchSingleTool(numId).finally(() => {
        if (mountedRef.current) setFetchingFallback(false);
      });
    }
  }, [id, currentTool, loading, fetchingFallback, fetchSingleTool]);

  useEffect(() => {
    if (!currentTool?._uuid) { setHealthStatus(undefined); return; }
    fetchToolHealth(currentTool._uuid).then(h => { if (mountedRef.current) setHealthStatus(h?.status); }).catch((e) => console.error('[ToolDetailWrapper] fetchToolHealth failed:', e));
  }, [currentTool?._uuid]);

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

  useEffect(() => {
    if (!currentTool?._uuid || !user) {
      setToolCollectionIds([]);
      setToolCollectionActivities([]);
      return;
    }
    void Promise.resolve(
      supabase
        .from('collection_tools')
        .select('collection_id, created_at')
        .eq('tool_id', currentTool._uuid)
    )
      .then(({ data }) => {
        if (!mountedRef.current) return;
        if (!data) {
          setToolCollectionIds([]);
          setToolCollectionActivities([]);
          return;
        }
        const colMap = new Map(collections.map(c => [c._uuid, c]));
        const ids: number[] = [];
        const activities: { collectionId: number; collectionName: string; addedAt: string }[] = [];
        for (const row of data as Array<{ collection_id: string; created_at?: string }>) {
          const col = colMap.get(row.collection_id);
          if (col) {
            ids.push(col.id);
            activities.push({
              collectionId: col.id,
              collectionName: col.name,
              addedAt: row.created_at || new Date().toISOString(),
            });
          }
        }
        setToolCollectionIds(ids);
        setToolCollectionActivities(activities);
      })
      .catch((e) => console.error('[ToolDetailWrapper] fetch collection IDs failed:', e));
  }, [currentTool?._uuid, user, collections]);

  const handleAddTool = () => {
    if (!user) { setAuthOpen(true); return; }
    setSubmitOpen(true);
  };

  const handleAddToCollection = useCallback((collectionId: number) => {
    if (!currentTool?._uuid) return;
    addToolToCollection(collectionId, currentTool._uuid);
    setToolCollectionIds(prev => [...prev, collectionId]);
    const col = collections.find(c => c.id === collectionId);
    if (col) {
      setToolCollectionActivities(prev => [...prev, {
        collectionId: col.id,
        collectionName: col.name,
        addedAt: new Date().toISOString(),
      }]);
    }
  }, [currentTool?._uuid, addToolToCollection, collections]);

  const handleRemoveFromCollection = useCallback((collectionId: number) => {
    if (!currentTool?._uuid) return;
    removeToolFromCollection(collectionId, currentTool._uuid);
    setToolCollectionIds(prev => prev.filter(id => id !== collectionId));
    setToolCollectionActivities(prev => prev.filter(ca => ca.collectionId !== collectionId));
  }, [currentTool?._uuid, removeToolFromCollection]);

  const handleRegenerateAiProfile = useCallback(async (numId: number) => {
    const tool = tools.find(t => t.id === numId);
    if (!tool) return;
    const result = await generateAiProfile(tool.name, tool.url, tool.description, tool._uuid, true);
    if (result.error) {
      toast.error('Failed to generate AI profile', { description: result.error });
      return;
    }
    if (result.summary) {
      await updateAiProfile(numId, result.summary);
      toast.success('AI profile regenerated');
    }
  }, [tools, updateAiProfile]);

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
      <ToolDetailPage
        tools={tools}
        onUpvote={toggleUpvote}
        onSave={saveToVault}
        onToggleFavorite={toggleFavorite}
        onRemoveFromVault={removeFromVault}
        onUpdateNotes={updateNotes}
        onAddTag={addTag}
        onRemoveTag={removeTag}
        onRecordVisit={recordVisit}
        collections={collections}
        collectionIds={toolCollectionIds}
        collectionActivities={toolCollectionActivities}
        healthStatus={healthStatus}
        reviews={reviews}
        myReview={myReview}
        reviewCount={reviews.length + (myReview ? 1 : 0)}
        onSubmitReview={submitReview}
        onDeleteReview={() => myReview ? deleteReview(myReview._uuid) : Promise.resolve(false)}
        onAddToCollection={() => {
          if (!user) { setAuthOpen(true); return; }
          setCollectionModalOpen(true);
        }}
        canUpload={isAdmin || isModerator}
        onUpdateScreenshot={updateScreenshot}
        isAdmin={isAdmin}
        onRegenerateAiProfile={handleRegenerateAiProfile}
        loading={loading || fetchingFallback}
      />
      {currentTool?._uuid && (
        <div className="max-w-6xl mx-auto px-6 pb-4">
          <AlternativesSection
            toolUuid={currentTool._uuid}
            onSuggest={() => setSuggestModalOpen(true)}
          />
        </div>
      )}
      {currentTool?._uuid && (
        <div className="max-w-6xl mx-auto px-6 pb-8">
          <ToolRecommendations toolUuid={currentTool._uuid} />
        </div>
      )}
      <AddToCollectionModal
        open={collectionModalOpen}
        onClose={() => setCollectionModalOpen(false)}
        collections={collections}
        collectionIds={toolCollectionIds}
        onAddToCollection={handleAddToCollection}
        onRemoveFromCollection={handleRemoveFromCollection}
        onCreateCollection={(name, desc) => {
          createCollection(name, desc);
        }}
      />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <SubmitToolModal open={submitOpen} onClose={() => setSubmitOpen(false)} />
      {currentTool && (
        <SuggestAlternativeModal
          open={suggestModalOpen}
          onClose={() => setSuggestModalOpen(false)}
          toolUuid={currentTool._uuid}
          toolName={currentTool.name}
        />
      )}
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
