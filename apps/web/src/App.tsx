import { useEffect, useState } from "react";
import { Header } from "./components/Header";
import { PromptInput } from "./components/PromptInput";
import { AdvancedSettings } from "./components/AdvancedSettings";
import { ResultViewer } from "./components/ResultViewer";
import { HistoryPanel } from "./components/HistoryPanel";
import { HistoryPage } from "./pages/HistoryPage";
import { BatchPreview, type BatchPreviewItem } from "./components/BatchPreview";
import { useAuthKey } from "./hooks/useAuthKey";
import { useHistory } from "./hooks/useHistory";
import { useImageGeneration } from "./hooks/useImageGeneration";
import type { HistoryError } from "./types/history";

type ViewMode = "studio" | "history";

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
  } = useHistory(authKey);

  const {
    prompt,
    setPrompt,
    settings,
    handleSettingsChange,
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
  } = useImageGeneration({
    authKey,
    onHistoryUpdated: () => {
      // Refresh history so both HistoryPage and sidebar stay in sync.
      refreshHistory();
    },
  });

  const [activeView, setActiveView] = useState<ViewMode>("studio");
  const [isMobile, setIsMobile] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"controls" | "result">("controls");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const updateMatch = () => setIsMobile(mediaQuery.matches);
    updateMatch();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateMatch);
      return () => mediaQuery.removeEventListener("change", updateMatch);
    }
    mediaQuery.addListener(updateMatch);
    return () => mediaQuery.removeListener(updateMatch);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setMobilePanel("controls");
      return;
    }
    if (status === "generating" || status === "success") {
      setMobilePanel("result");
    } else {
      setMobilePanel("controls");
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

      <main className="flex-1 relative lg:flex lg:overflow-hidden">
        {activeView === "studio" ? (
          <>
            {isMobile && (
              <div className="p-4 pb-0 animate-fade-in">
                <div className="grid grid-cols-2 gap-2">
                  {(["controls", "result"] as const).map((panel) => (
                    <button
                      key={panel}
                      type="button"
                      onClick={() => setMobilePanel(panel)}
                      className={`py-2 text-sm font-medium rounded-xl border transition-colors ${
                        mobilePanel === panel
                          ? "border-stone-300 bg-white text-stone-800 shadow-sm"
                          : "border-transparent text-stone-400 hover:bg-stone-100"
                      }`}
                    >
                      {panel === "controls" ? "Create" : "Results"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Left Panel: Controls */}
            {(!isMobile || mobilePanel === "controls") && (
              <div className="w-full lg:w-[450px] xl:w-[500px] lg:flex-shrink-0 overflow-y-auto h-full p-4 lg:p-8 scrollbar-thin scrollbar-thumb-stone-300 scrollbar-track-transparent animate-slide-up">
                <div className="max-w-xl mx-auto space-y-8">
                  <PromptInput
                    prompt={prompt}
                    setPrompt={setPrompt}
                    onGenerate={handleGenerate}
                    isGenerating={isSubmitting}
                  />

                  <AdvancedSettings settings={settings} onChange={handleSettingsChange} />

                  <div className="pt-4 text-xs text-stone-500 leading-relaxed border-t border-stone-200">
                    <p className="mb-2 font-semibold text-stone-400 uppercase tracking-wider">Tips</p>
                    <ul className="list-disc pl-4 space-y-1 marker:text-stone-300">
                      <li>Short, descriptive prompts work best.</li>
                      <li>Try adding details like lighting, style, camera, etc.</li>
                      <li>Supports bilingual (English & Chinese) prompts.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Right Panel: Results & History */}
            {(!isMobile || mobilePanel === "result") && (
              <div className="flex-1 overflow-y-auto h-full p-4 lg:p-8 lg:bg-white/50 scrollbar-thin scrollbar-thumb-stone-300 scrollbar-track-transparent border-l border-stone-200 animate-fade-in">
                <div className="max-w-5xl mx-auto space-y-10">
                  <div className="min-h-[45vh]">
                    <ResultViewer
                      status={status}
                      imageUrl={imageUrl}
                      error={error}
                      generationTime={generationTime}
                      width={lastSize?.width}
                      height={lastSize?.height}
                    />
                    <BatchPreview
                      batchId={currentBatchMeta?.id}
                      total={currentBatchMeta?.size ?? 0}
                      items={currentBatchItems}
                      onSelectImage={(url, size) => {
                        setImageUrl(url);
                        if (size) {
                          setLastSize(size);
                        }
                        setStatus("success");
                      }}
                      onCancel={handleCancelBatch}
                      isCancelling={isCancellingBatch}
                    />
                  </div>
                  
                  <HistoryPanel
                    items={historyItems}
                    isLoading={isHistoryLoading}
                    error={historyError}
                    onSelectImage={(url) => {
                      selectImage(url);
                    }}
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="h-full w-full overflow-y-auto p-4 lg:p-8 scrollbar-thin scrollbar-thumb-stone-300 scrollbar-track-transparent">
             <div className="max-w-6xl mx-auto">
              <HistoryPage
                items={historyItems}
                isLoading={isHistoryLoading}
                error={historyError}
                canLoadMore={hasMoreHistory && historyItems.length > 0}
                onRefresh={refreshHistory}
                onLoadMore={loadMoreHistory}
                onSelectImage={(url, size) => {
                  selectImage(url, size);
                  setActiveView("studio");
                }}
                onDeleteItem={deleteHistoryItem}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
