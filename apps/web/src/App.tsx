import { useEffect, useState } from "react";
import { Header, MobileNav } from "./components/Header";
import { StudioView } from "./components/StudioView";
import { HistoryPage } from "./pages/HistoryPage";
import { useAuthKey } from "./hooks/useAuthKey";
import { useHistory } from "./hooks/useHistory";
import { useImageGeneration } from "./hooks/useImageGeneration";
import { useMobile } from "./hooks/useMobile";
import { useGenerationStore } from "./store/generationStore";
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

  // Get status from store for auto-switching mobile panel
  const status = useGenerationStore((state) => state.status);
  const isMobile = useMobile();

  const [activeView, setActiveView] = useState<ViewMode>("studio");
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("controls");

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
            handleGenerate={handleGenerate}
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
