import { useEffect, useState } from "react";
import { Header, MobileNav } from "./components/Header";
import { PromptInput } from "./components/PromptInput";
import { AdvancedSettings } from "./components/AdvancedSettings";
import { GenerationViewer, type BatchItem } from "./components/GenerationViewer";
import { HistoryPanel } from "./components/HistoryPanel";
import { HistoryPage } from "./pages/HistoryPage";
import { useAuthKey } from "./hooks/useAuthKey";
import { useHistory } from "./hooks/useHistory";
import { useImageGeneration } from "./hooks/useImageGeneration";
import { useI18n } from "./i18n";
import type { HistoryError } from "./types/history";
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
            lastSize={lastSize}
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

/* Studio View Component */
interface StudioViewProps {
  isMobile: boolean;
  mobilePanel: MobilePanel;
  setMobilePanel: (panel: MobilePanel) => void;
  prompt: string;
  setPrompt: (prompt: string) => void;
  settings: any;
  updateSettings: (updates: any) => void;
  handleGenerate: () => void;
  isSubmitting: boolean;
  status: string;
  imageUrl: string | null;
  error?: string;
  generationTime?: number;
  lastSize?: { width: number; height: number };
  currentBatchMeta: any;
  currentBatchItems: BatchItem[];
  isCancellingBatch: boolean;
  handleCancelBatch: () => void;
  selectImage: (url: string, size?: { width: number; height: number }) => void;
  loadFromHistory: (info: ImageSelectionInfo) => void;
  historyItems: any[];
  isHistoryLoading: boolean;
  historyError: HistoryError;
}

function StudioView({
  isMobile,
  mobilePanel,
  setMobilePanel,
  prompt,
  setPrompt,
  settings,
  updateSettings,
  handleGenerate,
  isSubmitting,
  status,
  imageUrl,
  error,
  generationTime,
  lastSize,
  currentBatchMeta,
  currentBatchItems,
  isCancellingBatch,
  handleCancelBatch,
  selectImage,
  loadFromHistory,
  historyItems,
  isHistoryLoading,
  historyError,
}: StudioViewProps) {
  const { t } = useI18n();
  return (
    <>
      {/* Mobile Panel Switcher */}
      {isMobile && (
        <div className="sticky top-0 z-20 px-4 pt-4 pb-2 bg-stone-50/95 backdrop-blur-sm animate-fade-in">
          <div className="grid grid-cols-2 gap-2 p-1 bg-stone-100 rounded-2xl">
            {(["controls", "result"] as const).map((panel) => (
              <button
                key={panel}
                type="button"
                onClick={() => setMobilePanel(panel)}
                className={`py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 ${
                  mobilePanel === panel
                    ? "bg-white text-stone-800 shadow-sm"
                    : "text-stone-500 active:bg-stone-200"
                }`}
              >
                {panel === "controls" ? t("app.mobile.controls") : t("app.mobile.results")}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Left Panel: Controls */}
      {(!isMobile || mobilePanel === "controls") && (
        <div 
          className="w-full lg:w-[420px] xl:w-[480px] lg:flex-shrink-0 overflow-y-auto h-full p-4 lg:p-6 xl:p-8 scrollbar-thin animate-fade-in"
          key="controls-panel"
        >
          <div className="max-w-lg mx-auto space-y-6 lg:space-y-8">
            <PromptInput
              prompt={prompt}
              setPrompt={setPrompt}
              onGenerate={handleGenerate}
              isGenerating={isSubmitting}
            />

            <AdvancedSettings settings={settings} onChange={updateSettings} />

            {/* Tips section */}
            <div className="pt-4 text-xs text-stone-500 leading-relaxed border-t border-stone-200">
              <p className="mb-2 font-semibold text-stone-400 uppercase tracking-wider text-[10px]">
                {t("app.tips.title")}
              </p>
              <ul className="list-disc pl-4 space-y-1.5 marker:text-stone-300">
                <li>{t("app.tips.line1")}</li>
                <li>{t("app.tips.line2")}</li>
                <li>{t("app.tips.line3")}</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Right Panel: Results & History */}
      {(!isMobile || mobilePanel === "result") && (
        <div 
          className="flex-1 overflow-y-auto h-full p-4 lg:p-6 xl:p-8 lg:bg-white/40 scrollbar-thin border-l border-stone-200/50 animate-fade-in"
          key="result-panel"
        >
          <div className="max-w-4xl mx-auto space-y-8 lg:space-y-10">
            <GenerationViewer
              status={status as any}
              imageUrl={imageUrl}
              error={error}
              generationTime={generationTime}
              width={lastSize?.width}
              height={lastSize?.height}
              batchId={currentBatchMeta?.id}
              batchTotal={currentBatchMeta?.size ?? 1}
              batchItems={currentBatchItems}
              onSelectImage={(url, size) => selectImage(url, size)}
              onCancel={handleCancelBatch}
              isCancelling={isCancellingBatch}
            />
            
            <HistoryPanel
              items={historyItems}
              isLoading={isHistoryLoading}
              error={historyError}
              onSelectImage={(url) => selectImage(url)}
              onLoadFromHistory={loadFromHistory}
            />
          </div>
        </div>
      )}
    </>
  );
}

export default App;
