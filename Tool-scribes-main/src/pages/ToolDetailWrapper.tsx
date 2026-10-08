import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import AddToolModal from '@/components/AddToolModal';
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
  const [modalOpen, setModalOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [toolCollectionIds, setToolCollectionIds] = useState<number[]>([]);
  const [suggestModalOpen, setSuggestModalOpen] = useState(false);
  const { user, isAdmin, isModerator } = useAuth();
  const { tools, addTool, toggleUpvote, saveToVault, toggleFavorite, removeFromVault, updateNotes, addTag, removeTag, recordVisit, updateScreenshot, updateAiProfile } = useTools();
  const { collections, addToolToCollection, removeToolFromCollection, createCollection } = useCollections();
  const search = useSearch();

  const currentTool = id ? tools.find(t => t.id === Number(id)) : null;
  const [healthStatus, setHealthStatus] = useState<string | undefined>();
  const { reviews, myReview, submitReview, deleteReview } = useReviews(currentTool?._uuid);
  const mountedRef = useRef(true);

  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

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
    if (!currentTool?._uuid || !user) { setToolCollectionIds([]); return; }
    void Promise.resolve(
      supabase
        .from('collection_tools')
        .select('collection_id')
        .eq('tool_id', currentTool._uuid)
    )
      .then(({ data }) => {
        if (!mountedRef.current) return;
        if (!data) { setToolCollectionIds([]); return; }
        const colUuids = new Set(data.map(d => d.collection_id as string));
        const ids = collections
          .filter(c => colUuids.has(c._uuid))
          .map(c => c.id);
        setToolCollectionIds(ids);
      })
      .catch((e) => console.error('[ToolDetailWrapper] fetch collection IDs failed:', e));
  }, [currentTool?._uuid, user, collections]);

  const handleAddTool = () => {
    if (!user) { setAuthOpen(true); return; }
    setModalOpen(true);
  };

  const handleAddToCollection = useCallback((collectionId: number) => {
    if (!currentTool?._uuid) return;
    addToolToCollection(collectionId, currentTool._uuid);
    setToolCollectionIds(prev => [...prev, collectionId]);
  }, [currentTool?._uuid, addToolToCollection]);

  const handleRemoveFromCollection = useCallback((collectionId: number) => {
    if (!currentTool?._uuid) return;
    removeToolFromCollection(collectionId, currentTool._uuid);
    setToolCollectionIds(prev => prev.filter(id => id !== collectionId));
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
      <AddToolModal open={modalOpen} onClose={() => setModalOpen(false)} onAdd={addTool} />
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
