import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster as Sonner } from "@/components/ui/sonner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ScrollToTop } from "@/components/ScrollToTop";
import { setSearchEngine, SimpleSearchEngine } from "@/lib/search";
import { LazyFallback } from "@/components/LazyFallback";

/* ── Main pages — lazy loaded ──────────────────────────────────────── */
const Index = lazy(() => import("./pages/Index.tsx"));
const ToolDetailWrapper = lazy(() => import("./pages/ToolDetailWrapper.tsx"));
const CollectionDetailWrapper = lazy(() => import("./pages/CollectionDetailWrapper.tsx"));
const PublicCollectionPage = lazy(() => import("./pages/PublicCollectionPage.tsx"));
const ProfilePage = lazy(() => import("./pages/ProfilePage.tsx"));
const FollowingPage = lazy(() => import("./pages/FollowingPage.tsx"));
const TagPage = lazy(() => import("./pages/TagPage.tsx"));
const TagsPage = lazy(() => import("./pages/TagsPage.tsx"));
const MyProfilePage = lazy(() => import("./pages/MyProfilePage.tsx"));
const MyCollectionsPage = lazy(() => import("./pages/MyCollectionsPage.tsx"));
const MyReviewsPage = lazy(() => import("./pages/MyReviewsPage.tsx"));
const MySubmissionsPage = lazy(() => import("./pages/MySubmissionsPage.tsx"));
const CollectionsHubPage = lazy(() => import("./pages/CollectionsHubPage.tsx"));
const SettingsPage = lazy(() => import("./pages/SettingsPage.tsx"));
const AuthCallbackPage = lazy(() => import("./pages/AuthCallbackPage.tsx"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

/* ── Admin pages ───────────────────────────────────────────────────── */
const AdminReviewWrapper = lazy(() => import("./pages/AdminReviewWrapper.tsx"));
const AdminHealthWrapper = lazy(() => import("./pages/AdminHealthWrapper.tsx"));
const AdminReviewModerationWrapper = lazy(() => import("./pages/AdminReviewModerationWrapper.tsx"));
const AdminTagModerationWrapper = lazy(() => import("./pages/AdminTagModerationWrapper.tsx"));
const AdminIndex = lazy(() => import("./pages/AdminIndex.tsx"));
const AdminAlternativeWrapper = lazy(() => import("./pages/AdminAlternativeWrapper.tsx"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});
setSearchEngine(new SimpleSearchEngine());

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Sonner />
          <BrowserRouter>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:px-4 focus:py-2 focus:bg-tv-primary focus:text-white focus:rounded-lg focus:text-[13px] focus:font-medium"
            >
              Skip to main content
            </a>
            <ScrollToTop />
            <ErrorBoundary>
              <div id="main-content" role="main">
                <Suspense fallback={<LazyFallback />}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/tool/:id" element={<ToolDetailWrapper />} />
                    <Route path="/collections/:id" element={<CollectionDetailWrapper />} />
                    <Route path="/c/:uuid" element={<PublicCollectionPage />} />
                    <Route path="/profile" element={<MyProfilePage />} />
                    <Route path="/u/:username" element={<ProfilePage />} />
                    <Route path="/auth/callback" element={<AuthCallbackPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                    <Route path="/collections" element={<CollectionsHubPage />} />
                    <Route path="/collections/me" element={<MyCollectionsPage />} />
                    <Route path="/reviews/me" element={<MyReviewsPage />} />
                    <Route path="/submissions/me" element={<MySubmissionsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/following" element={<FollowingPage />} />
                    <Route path="/tags" element={<TagsPage />} />
                    <Route path="/tag/:slug" element={<TagPage />} />

                    {/* Admin routes */}
                    <Route path="/admin" element={<AdminIndex />} />
                    <Route path="/admin/review" element={<AdminReviewWrapper />} />
                    <Route path="/admin/health" element={<AdminHealthWrapper />} />
                    <Route path="/admin/reviews" element={<AdminReviewModerationWrapper />} />
                    <Route path="/admin/tags" element={<AdminTagModerationWrapper />} />
                    <Route path="/admin/alternatives" element={<AdminAlternativeWrapper />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </div>
            </ErrorBoundary>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
