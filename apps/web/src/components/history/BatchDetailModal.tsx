import { useCallback, useEffect, useMemo, type ReactNode } from "react";
import { Calendar, X, Loader2, AlertTriangle, ChevronLeft, ChevronRight, Settings2, Copy, Download, Maximize2, Wand2, Trash2 } from "lucide-react";
import type { BatchDetail, BatchItemDetail, BatchSummary, ImageSelectionInfo } from "../../api/types";
import { getDownloadUrl, getImageUrl } from "../../api/client";
import { useI18n } from "../../i18n";

interface BatchDetailModalProps {
  batch: BatchSummary;
  detail: BatchDetail | null;
  isOpen?: boolean;
  isLoading: boolean;
  selectedImageIndex: number;
  onSelectImageIndex: (index: number) => void;
  onClose: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
  onCopyPrompt?: (prompt: string, taskId?: string) => void;
  copiedId?: string | null;
  onLoadToStudio?: (info: ImageSelectionInfo) => void;
  formatDate: (date?: string) => string;
  renderPlaceholder?: () => ReactNode;
  thumbnailAnimationDelayStep?: number;
}

const buildSelectionInfo = (
  batch: BatchSummary,
  item?: BatchItemDetail
): ImageSelectionInfo | null => {
  if (!item?.image_url) return null;

  return {
    imageUrl: getImageUrl(item.image_url),
    batchId: batch.task_id,
    taskId: item.task_id,
    batchSize: batch.batch_size,
    successCount: batch.success_count,
    failedCount: batch.failed_count,
    prompt: batch.prompt,
    width: item.width || batch.width,
    height: item.height || batch.height,
    steps: batch.num_inference_steps,
    guidance: batch.guidance_scale,
    seed: item.seed ?? batch.base_seed,
  };
};

export function BatchDetailModal({
  batch,
  detail,
  isOpen = true,
  isLoading,
  selectedImageIndex,
  onSelectImageIndex,
  onClose,
  onDelete,
  isDeleting = false,
  onCopyPrompt,
  copiedId,
  onLoadToStudio,
  formatDate,
  renderPlaceholder,
  thumbnailAnimationDelayStep = 0,
}: BatchDetailModalProps) {
  const { t } = useI18n();
  const items = useMemo(() => detail?.items ?? [], [detail?.items]);

  const successItems = useMemo(
    () => items.filter((item) => item.status === "success" && item.image_url),
    [items]
  );

  const currentImage = items[selectedImageIndex];
  const currentImageUrl = currentImage?.image_url ? getImageUrl(currentImage.image_url) : null;

  const handleNavigate = useCallback(
    (direction: "prev" | "next") => {
      if (!detail || successItems.length <= 1) return;

      const currentSuccessIndex = successItems.findIndex(
        (item) => detail.items.indexOf(item) === selectedImageIndex
      );
      if (currentSuccessIndex === -1) return;

      const targetSuccessIndex =
        direction === "prev" ? currentSuccessIndex - 1 : currentSuccessIndex + 1;

      if (targetSuccessIndex >= 0 && targetSuccessIndex < successItems.length) {
        const nextIndex = detail.items.indexOf(successItems[targetSuccessIndex]);
        onSelectImageIndex(nextIndex);
      }
    },
    [detail, onSelectImageIndex, selectedImageIndex, successItems]
  );

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        handleNavigate("prev");
      } else if (e.key === "ArrowRight") {
        handleNavigate("next");
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNavigate, isOpen, onClose]);

  const handleLoadToStudio = useCallback(
    (item?: BatchItemDetail) => {
      if (!onLoadToStudio) return;
      const target = item ?? currentImage ?? successItems[0];
      const info = target ? buildSelectionInfo(batch, target) : null;
      if (!info) return;
      onLoadToStudio(info);
      onClose();
    },
    [batch, currentImage, onClose, onLoadToStudio, successItems]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 lg:p-8">
      <div
        className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm animate-backdrop-in"
        onClick={onClose}
      />

      <div className="relative w-full max-w-6xl max-h-[90vh] bg-white rounded-2xl lg:rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row animate-modal-in ring-1 ring-black/5">
        <div className="relative md:flex-1 bg-stone-50 flex flex-col min-h-[35vh] lg:min-h-[40vh]">
          <div className="absolute inset-0 pattern-dots opacity-[0.03]" />

          <div className="flex-1 flex items-center justify-center p-3 sm:p-4 lg:p-8 relative">
            {isLoading ? (
              <div className="flex flex-col items-center text-stone-400">
                <Loader2 className="size-10 animate-spin mb-2" />
                <span className="text-sm">{t("common.loading")}</span>
              </div>
            ) : currentImageUrl ? (
              <img
                src={currentImageUrl}
                alt={batch.prompt || t("history.preview.imageAlt")}
                className="max-w-full max-h-full w-auto h-auto object-contain shadow-lg rounded-lg z-10"
              />
            ) : renderPlaceholder ? (
              renderPlaceholder()
            ) : (
              <div className="flex flex-col items-center text-stone-400">
                <AlertTriangle className="size-10 mb-2" />
                <span className="text-sm">{t("history.preview.noImage")}</span>
              </div>
            )}

            {successItems.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNavigate("prev");
                  }}
                  className="absolute left-2 lg:left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 hover:bg-white text-stone-600 shadow-lg backdrop-blur-sm transition-all z-20"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNavigate("next");
                  }}
                  className="absolute right-2 lg:right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 hover:bg-white text-stone-600 shadow-lg backdrop-blur-sm transition-all z-20"
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}
          </div>

          {detail && detail.items.length > 1 && (
            <div className="border-t border-stone-200 p-2 lg:p-3 bg-white/80 backdrop-blur-sm">
              <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
                {detail.items.map((item, idx) => {
                  const itemUrl = item.image_url ? getImageUrl(item.image_url) : null;
                  const isCurrentSelected = idx === selectedImageIndex;
                  const isSuccess = item.status === "success" && itemUrl;
                  const animateThumb = thumbnailAnimationDelayStep > 0;

                  return (
                    <button
                      key={item.task_id}
                      type="button"
                      onClick={() => isSuccess && onSelectImageIndex(idx)}
                      disabled={!isSuccess}
                      className={`flex-shrink-0 size-14 lg:size-16 rounded-lg overflow-hidden border-2 transition-all ${
                        isCurrentSelected
                          ? "border-orange-500 ring-2 ring-orange-200"
                          : isSuccess
                            ? "border-stone-200 hover:border-orange-300"
                            : "border-stone-100 opacity-50"
                      } ${animateThumb ? "animate-stagger-in" : ""}`}
                      style={animateThumb ? { animationDelay: `${idx * thumbnailAnimationDelayStep}ms` } : undefined}
                    >
                      {isSuccess ? (
                        <img
                          src={itemUrl}
                          alt={`${t("batch.alt", { index: idx + 1 })}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-stone-100">
                          {item.status === "pending" || item.status === "running" ? (
                            <Loader2 className="size-4 text-stone-400 animate-spin" />
                          ) : (
                            <AlertTriangle className="size-4 text-stone-400" />
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={onClose}
            className="absolute top-3 right-3 lg:hidden p-2 bg-black/50 text-white rounded-full backdrop-blur-md z-20 active:scale-95 transition-transform"
          >
            <X size={18} />
          </button>
        </div>

        <div className="w-full md:w-[320px] lg:w-[380px] bg-white flex flex-col border-l border-stone-100">
          <div className="p-4 lg:p-6 flex-1 overflow-y-auto scrollbar-thin">
            <div className="flex items-start justify-between mb-5 lg:mb-6">
              <div>
                <h3 className="text-base lg:text-lg font-semibold text-stone-800 leading-tight">
                  {t("history.preview.batchTitle")}
                </h3>
                <div className="flex items-center gap-2 mt-1 text-[10px] lg:text-xs text-stone-400">
                  <Calendar size={12} />
                  <span>{formatDate(batch.created_at)}</span>
                  {(batch.batch_size || 1) > 1 && (
                    <>
                      <span>·</span>
                      <span>{t("batch.subtitle", {
                        completed: batch.success_count ?? 0,
                        total: batch.batch_size || 1,
                      })}</span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="hidden md:flex p-2 hover:bg-stone-100 rounded-full text-stone-400 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 lg:space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] lg:text-xs font-semibold text-stone-400 uppercase tracking-wider">
                    {t("history.preview.promptLabel")}
                  </label>
                  {batch.prompt && (
                    <button
                      type="button"
                      onClick={() => batch.prompt && onCopyPrompt?.(batch.prompt, batch.task_id)}
                      className="flex items-center gap-1 text-[10px] text-stone-400 hover:text-orange-600 transition-colors"
                    >
                      <Copy size={12} />
                      <span>{copiedId === batch.task_id ? t("common.copied") : t("common.copy")}</span>
                    </button>
                  )}
                </div>
                <div className="p-3 lg:p-4 bg-stone-50 rounded-xl lg:rounded-2xl text-sm text-stone-700 leading-relaxed border border-stone-100 max-h-[150px] lg:max-h-[200px] overflow-y-auto scrollbar-thin">
                  {batch.prompt || t("history.preview.noPrompt")}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] lg:text-xs font-semibold text-stone-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Settings2 size={12} />
                  {t("history.preview.settingsLabel")}
                </label>
                <div className="grid grid-cols-2 gap-2 lg:gap-3">
                  <div className="p-2.5 lg:p-3 rounded-xl lg:rounded-2xl bg-stone-50 border border-stone-100">
                    <label className="text-[9px] lg:text-[10px] font-semibold text-stone-400 uppercase block mb-1">
                      {t("history.preview.sizeLabel")}
                    </label>
                    <span className="text-xs lg:text-sm font-mono text-stone-700">
                      {batch.width && batch.height ? `${batch.width} × ${batch.height}` : "-"}
                    </span>
                  </div>
                  <div className="p-2.5 lg:p-3 rounded-xl lg:rounded-2xl bg-stone-50 border border-stone-100">
                    <label className="text-[9px] lg:text-[10px] font-semibold text-stone-400 uppercase block mb-1">
                      {t("history.preview.stepsLabel")}
                    </label>
                    <span className="text-xs lg:text-sm font-mono text-stone-700">
                      {batch.num_inference_steps ?? "-"}
                    </span>
                  </div>
                  <div className="p-2.5 lg:p-3 rounded-xl lg:rounded-2xl bg-stone-50 border border-stone-100">
                    <label className="text-[9px] lg:text-[10px] font-semibold text-stone-400 uppercase block mb-1">
                      {t("history.preview.guidanceLabel")}
                    </label>
                    <span className="text-xs lg:text-sm font-mono text-stone-700">
                      {batch.guidance_scale ?? "-"}
                    </span>
                  </div>
                  <div className="p-2.5 lg:p-3 rounded-xl lg:rounded-2xl bg-stone-50 border border-stone-100">
                    <label className="text-[9px] lg:text-[10px] font-semibold text-stone-400 uppercase block mb-1">
                      {t("history.preview.seedLabel")}
                    </label>
                    <span className="text-xs lg:text-sm font-mono text-stone-700 truncate block">
                      {currentImage?.seed ?? batch.base_seed ?? t("history.preview.seedRandom")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 lg:p-6 border-t border-stone-100 bg-stone-50/50 space-y-2.5 lg:space-y-3">
            {currentImageUrl && (
              <div className="flex gap-2">
                <a
                  href={getDownloadUrl(currentImageUrl)}
                  download={`z-image-${Date.now()}.png`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 lg:py-3 border border-stone-200 text-stone-600 rounded-xl font-medium hover:bg-stone-100 transition-all active:scale-[0.98]"
                >
                  <Download size={15} />
                  {t("result.download")}
                </a>
                <button
                  type="button"
                  onClick={() => currentImageUrl && window.open(currentImageUrl, "_blank")}
                  className="flex items-center justify-center gap-2 py-2.5 lg:py-3 px-4 border border-stone-200 text-stone-600 rounded-xl font-medium hover:bg-stone-100 transition-all active:scale-[0.98]"
                >
                  <Maximize2 size={15} />
                </button>
              </div>
            )}

            {onLoadToStudio && currentImageUrl && (
              <button
                type="button"
                onClick={() => handleLoadToStudio()}
                className="w-full flex items-center justify-center gap-2 py-2.5 lg:py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-medium shadow-lg shadow-orange-200 hover:shadow-xl hover:shadow-orange-300 transition-all active:scale-[0.98]"
              >
                <Wand2 size={15} />
                {t("history.preview.useInStudio")}
              </button>
            )}

            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                disabled={isDeleting}
                className="w-full flex items-center justify-center gap-2 py-2.5 lg:py-3 text-rose-600 hover:bg-rose-50 rounded-xl font-medium transition-colors disabled:opacity-50 active:scale-[0.98]"
              >
                <Trash2 size={15} />
                {isDeleting ? t("history.preview.deleting") : t("history.preview.deleteBatch")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
