import { useEffect, useState } from "react";
import { Header, MobileNav } from "./components/Header";
import { StudioView } from "./components/StudioView";
import { HistoryPage } from "./pages/HistoryPage";
import { useAuthKey } from "./hooks/useAuthKey";
import { useHistory } from "./hooks/useHistory";
import { useImageGeneration } from "./hooks/useImageGeneration";
import type { ImageSelectionInfo } from "./api/types";

type ViewMode = "studio" | "history";
type MobilePanel = "controls" | "result";

function App() {
  const { authKey, setAuthKey } = useAuthKey();
  const {
    items: historyItems,
    isLoading: isHistoryLoading,
    error: historyError,
    hasMore: hasMoreHistory,
    refresh: refreshHistory,
    loadMore: loadMoreHistory,
    deleteItem: deleteHistoryItem,
    deleteMany: deleteHistoryMany,
    isDeletingMany: isDeletingHistoryMany,
  } = useHistory(authKey);

  const {
    prompt,
    setPrompt,
    settings,
    updateSettings,
    status,
    imageUrl,
    error,
    generationTime,
    lastSize,
    isSubmitting,
    currentBatchMeta,
    currentBatchItems,
    isCancellingBatch,
    handleGenerate,
    handleCancelBatch,
    selectImage,
    loadFromHistory,
  } = useImageGeneration({
    authKey,
    onHistoryUpdated: () => {
      refreshHistory();
    },
  });

  const [activeView, setActiveView] = useState<ViewMode>("studio");
  const [isMobile, setIsMobile] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("controls");

  // Detect mobile viewport
  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const updateMatch = () => setIsMobile(mediaQuery.matches);
    updateMatch();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateMatch);
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(updateMatch);
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", updateMatch);
      } else if (typeof mediaQuery.removeListener === "function") {
        mediaQuery.removeListener(updateMatch);
      }
    };
  }, []);

  // Auto-switch to result panel when generating
  useEffect(() => {
    if (!isMobile) {
      setMobilePanel("controls");
      return;
    }
    if (status === "generating" || status === "success") {
      setMobilePanel("result");
    }
  }, [isMobile, status]);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 font-sans selection:bg-orange-200 selection:text-orange-900 flex flex-col">
      <Header
        authKey={authKey}
        onAuthKeyChange={setAuthKey}
        activeView={activeView}
        onChangeView={setActiveView}
      />

      {/* Main content with bottom padding for mobile nav */}
      <main className="flex-1 relative lg:flex lg:overflow-hidden pb-[var(--bottom-nav-height)]">
        {activeView === "studio" ? (
          <StudioView
            isMobile={isMobile}
            mobilePanel={mobilePanel}
            setMobilePanel={setMobilePanel}
            prompt={prompt}
            setPrompt={setPrompt}
            settings={settings}
            updateSettings={updateSettings}
            handleGenerate={handleGenerate}
            isSubmitting={isSubmitting}
            status={status}
            imageUrl={imageUrl}
            error={error}
            generationTime={generationTime}
            lastSize={lastSize ?? undefined}
            currentBatchMeta={currentBatchMeta}
            currentBatchItems={currentBatchItems}
            isCancellingBatch={isCancellingBatch}
            handleCancelBatch={handleCancelBatch}
            selectImage={selectImage}
            loadFromHistory={loadFromHistory}
            historyItems={historyItems}
            isHistoryLoading={isHistoryLoading}
            historyError={historyError}
          />
        ) : (
          <div className="h-full w-full overflow-y-auto p-4 lg:p-8 scrollbar-thin animate-fade-in">
            <div className="max-w-6xl mx-auto">
              <HistoryPage
                items={historyItems}
                isLoading={isHistoryLoading}
                error={historyError}
                canLoadMore={hasMoreHistory && historyItems.length > 0}
                authKey={authKey}
                onRefresh={refreshHistory}
                onLoadMore={loadMoreHistory}
                onSelectImage={(url, size) => {
                  selectImage(url, size);
                  setActiveView("studio");
                }}
                onLoadToStudio={(info: ImageSelectionInfo) => {
                  loadFromHistory(info);
                  setActiveView("studio");
                }}
                onDeleteItem={deleteHistoryItem}
                onBatchDelete={deleteHistoryMany}
                isBatchDeleting={isDeletingHistoryMany}
              />
            </div>
          </div>
        )}
      </main>

      {/* Mobile bottom navigation */}
      <MobileNav activeView={activeView} onChangeView={setActiveView} />
    </div>
  );
}

export default App;
