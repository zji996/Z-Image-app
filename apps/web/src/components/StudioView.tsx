import { PromptInput } from "./PromptInput";
import { AdvancedSettings } from "./AdvancedSettings";
import { GenerationViewer } from "./GenerationViewer";
import { HistoryPanel } from "./HistoryPanel";
import { useI18n } from "../i18n";
import type { BatchSummary, HistoryError, ImageSelectionInfo } from "../api/types";
import { useGenerationStore } from "../store/generationStore";

type MobilePanel = "controls" | "result";

export interface StudioViewProps {
  isMobile: boolean;
  mobilePanel: MobilePanel;
  setMobilePanel: (panel: MobilePanel) => void;
  // Generation actions (from hook)
  handleGenerate: () => void;
  handleCancelBatch: () => void;
  selectImage: (url: string, size?: { width: number; height: number }, options?: { keepBatchState?: boolean }) => void;
  loadFromHistory: (info: ImageSelectionInfo) => void;
  // History data
  historyItems: BatchSummary[];
  isHistoryLoading: boolean;
  historyError: HistoryError;
}

export function StudioView({
  isMobile,
  mobilePanel,
  setMobilePanel,
  handleGenerate,
  handleCancelBatch,
  selectImage,
  loadFromHistory,
  historyItems,
  isHistoryLoading,
  historyError,
}: StudioViewProps) {
  const { t } = useI18n();
  
  // Get all generation state from store
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
  } = useGenerationStore();

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
                className={`py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 ${mobilePanel === panel
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
              status={status}
              imageUrl={imageUrl}
              error={error}
              generationTime={generationTime}
              width={lastSize?.width}
              height={lastSize?.height}
              batchId={currentBatchMeta?.id}
              batchTotal={currentBatchMeta?.size ?? 1}
              batchCompleted={currentBatchMeta?.completed}
              batchFailed={currentBatchMeta?.failed}
              batchItems={currentBatchItems}
              onSelectImage={(url, size, options) => selectImage(url, size, options)}
              onCancel={handleCancelBatch}
              isCancelling={isCancellingBatch}
            />

            <HistoryPanel
              items={historyItems}
              isLoading={isHistoryLoading}
              error={historyError}
              onSelectImage={(url, size, options) => selectImage(url, size, options)}
              onLoadFromHistory={loadFromHistory}
            />
          </div>
        </div>
      )}
    </>
  );
}
