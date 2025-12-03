import { Download, Loader2, AlertCircle, Maximize2, X, Image as ImageIcon, AlertTriangle, StopCircle } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "../i18n";
import type { TranslationKey } from "../i18n/translations";
import { getDownloadUrl } from "../api/client";

export type GenerationStatus = "idle" | "pending" | "generating" | "success" | "error";
export type BatchItemStatus = "pending" | "running" | "success" | "error" | "cancelled";

export interface BatchItem {
  taskId: string;
  index: number;
  status: BatchItemStatus;
  imageUrl?: string;
  width?: number;
  height?: number;
  seed?: number | null;
  errorCode?: string | null;
  errorHint?: string | null;
  progress?: number;
}

interface GenerationViewerProps {
  status: GenerationStatus;
  imageUrl: string | null;
  error?: string;
  generationTime?: number;
  width?: number;
  height?: number;
  batchId?: string | null;
  batchTotal?: number;
  batchItems?: BatchItem[];
   batchCompleted?: number;
   batchFailed?: number;
  isCancelling?: boolean;
  onSelectImage?: (url: string, size?: { width: number; height: number }, options?: { keepBatchState?: boolean }) => void;
  onCancel?: () => void;
}

const STATUS_LABEL_KEYS: Record<BatchItemStatus, TranslationKey> = {
  pending: "batch.status.pending",
  running: "batch.status.running",
  success: "batch.status.success",
  error: "batch.status.error",
  cancelled: "batch.status.cancelled",
};

export function GenerationViewer({
  status,
  imageUrl,
  error,
  width,
  height,
  batchId,
  batchTotal = 1,
  batchItems = [],
  batchCompleted,
  batchFailed,
  isCancelling = false,
  onSelectImage,
  onCancel,
}: GenerationViewerProps) {
  const { t } = useI18n();

  const itemMap = new Map<number, BatchItem>();
  batchItems.forEach((item) => itemMap.set(item.index, item));
  const sortedItems = [...itemMap.values()].sort((a, b) => a.index - b.index);

  const completedFromItems = sortedItems.filter((item) => item.status === "success").length;
  const failedFromItems = sortedItems.filter((item) => item.status === "error" || item.status === "cancelled").length;
  const completed = typeof batchCompleted === "number" ? batchCompleted : completedFromItems;
  const failed = typeof batchFailed === "number" ? batchFailed : failedFromItems;
  const active = sortedItems.filter((item) => item.status === "pending" || item.status === "running").length;
  const isGenerating = status === "pending" || status === "generating";
  const canCancel = Boolean(onCancel) && isGenerating && active > 0;

  // 进度计算
  const runningItems = sortedItems.filter((item) => item.status === "running");
  const runningSumFraction = runningItems.reduce((sum, item) => sum + ((item.progress ?? 50) / 100), 0);
  const progress =
    batchTotal > 0
      ? (((completed + failed) + runningSumFraction) / batchTotal) * 100
      : 0;

  // 空闲状态
  if (status === "idle") {
    return (
      <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden animate-fade-in">
        <div className="min-h-[350px] lg:min-h-[400px] flex flex-col items-center justify-center text-stone-400 p-6 lg:p-8 border-2 border-dashed border-stone-200 m-4 rounded-2xl">
          <div className="size-16 lg:size-20 rounded-full bg-stone-100 mb-5 lg:mb-6 flex items-center justify-center">
            <div className="size-3 bg-stone-300 rounded-full animate-pulse-soft" />
          </div>
          <h3 className="text-base lg:text-lg font-semibold text-stone-600 mb-2">{t("result.idle.title")}</h3>
          <p className="text-sm text-center max-w-xs text-stone-400">
            {t("result.idle.subtitle")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-lg shadow-stone-200/30 animate-fade-in">
      {/* Header with progress and cancel */}
      <div className="flex items-center justify-between px-4 lg:px-6 py-3 lg:py-4 border-b border-stone-100 bg-stone-50/50">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Status indicator */}
          <div className={`size-2.5 rounded-full flex-shrink-0 ${status === "error" || (completed === 0 && failed > 0)
            ? "bg-rose-500"
            : isGenerating
              ? "bg-orange-500 animate-pulse"
              : "bg-emerald-500"
            }`} />

          {/* Status text and progress */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-stone-700 truncate">
                {t("batch.subtitle", { completed, total: batchTotal })}
              </span>
            </div>

            {/* Progress bar - always show when generating */}
            {isGenerating && (
              <div className="mt-1.5 h-1 bg-stone-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-500 ease-out"
                  style={{ width: `${Math.max(progress, 5)}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Cancel button - always visible when generating */}
        {canCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isCancelling}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-rose-200 text-rose-600 bg-white hover:bg-rose-50 hover:border-rose-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:scale-95 flex-shrink-0 ml-3"
          >
            {isCancelling ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                <span className="hidden sm:inline">{t("batch.cancelling")}</span>
              </>
            ) : (
              <>
                <X size={12} />
                <span className="hidden sm:inline">{t("batch.stop")}</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Main content area */}
      <div className="p-4 lg:p-6">
        <div className="space-y-4">
          {/* Main preview - show selected image or placeholder */}
          <div className="relative group">
            <div className="relative flex items-center justify-center bg-stone-50 min-h-[250px] lg:min-h-[300px] rounded-2xl overflow-hidden">
              <div className="absolute inset-0 pattern-dots opacity-[0.03]" />

              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={t("result.imageAlt")}
                  className="max-w-full h-auto object-contain max-h-[50vh] lg:max-h-[60vh] shadow-sm rounded-lg"
                />
              ) : isGenerating ? (
                <div className="flex flex-col items-center justify-center text-center p-6">
                  <Loader2 className="size-10 lg:size-12 text-orange-500 animate-spin mb-4" />
                  <h3 className="text-base lg:text-lg font-medium text-stone-600 animate-pulse-soft">
                    {t("result.loading.title")}
                  </h3>
                </div>
              ) : status === "error" ? (
                <div className="flex flex-col items-center justify-center text-center p-6">
                  <AlertCircle className="size-10 lg:size-12 text-rose-400 mb-4" />
                  <h3 className="text-base lg:text-lg font-medium text-rose-700 mb-2">{t("result.error.title")}</h3>
                  <p className="text-sm text-rose-600/70 max-w-sm">
                    {error || t("result.error.fallback")}
                  </p>
                </div>
              ) : null}
            </div>

            {/* Hover overlay - only when image exists */}
            {imageUrl && (
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end justify-between rounded-b-2xl">
                <p className="text-[10px] text-white/80 font-medium uppercase tracking-wider">
                  {width && height ? `${width}×${height}` : "1024×1024"}
                </p>
                <div className="flex gap-2">
                  <a
                    href={getDownloadUrl(imageUrl)}
                    download={`z-image-${Date.now()}.png`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-lg bg-white/10 backdrop-blur-md text-white hover:bg-white hover:text-stone-900 transition-all shadow-lg active:scale-95"
                    title={t("result.download")}
                  >
                    <Download size={16} />
                  </a>
                  <button
                    type="button"
                    onClick={() => window.open(imageUrl || "#", "_blank")}
                    className="p-2 rounded-lg bg-white/10 backdrop-blur-md text-white hover:bg-white hover:text-stone-900 transition-all shadow-lg active:scale-95"
                    title={t("result.openFull")}
                  >
                    <Maximize2 size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Thumbnails grid - always show */}
          <div className={`grid gap-2 lg:gap-3 ${batchTotal === 1
            ? "grid-cols-1 max-w-[80px]"
            : batchTotal === 2
              ? "grid-cols-2 max-w-[168px]"
              : batchTotal <= 4
                ? "grid-cols-4 max-w-[344px]"
                : "grid-cols-5 max-w-[440px]"
            }`}>
            {Array.from({ length: batchTotal }).map((_, index) => {
              const item = itemMap.get(index);
              const itemStatus: BatchItemStatus = item?.status ?? "pending";
              const label = t(STATUS_LABEL_KEYS[itemStatus]);
              const isCurrentlySelected = item?.imageUrl === imageUrl;

              if (itemStatus === "success" && item?.imageUrl) {
                return (
                  <button
                    key={`${batchId}-${index}`}
                    type="button"
                    onClick={() => onSelectImage?.(item.imageUrl!, item.width && item.height ? { width: item.width, height: item.height } : undefined, { keepBatchState: true })}
                    className={`group relative rounded-xl overflow-hidden border-2 hover:border-orange-300 hover:shadow-md hover:-translate-y-0.5 transition-all aspect-square animate-stagger-in ${isCurrentlySelected ? "border-orange-500 ring-2 ring-orange-200" : "border-stone-200"
                      }`}
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    <img
                      src={item.imageUrl}
                      alt={t("batch.alt", { index: index + 1 })}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    {isCurrentlySelected && (
                      <div className="absolute inset-0 bg-orange-500/10 border-2 border-orange-500 rounded-xl" />
                    )}
                  </button>
                );
              }

              let stateContent: ReactNode;
              if (itemStatus === "error") {
                stateContent = (
                  <div className="flex flex-col items-center justify-center text-center p-1.5 h-full">
                    <AlertTriangle className="size-4 text-amber-500 mb-1" />
                    <p className="text-[8px] font-medium text-amber-700 leading-tight line-clamp-2">
                      {item?.errorHint || label}
                    </p>
                  </div>
                );
              } else if (itemStatus === "cancelled") {
                stateContent = (
                  <div className="flex flex-col items-center justify-center text-center p-1.5 h-full">
                    <StopCircle className="size-4 text-stone-400 mb-1" />
                    <p className="text-[8px] font-medium text-stone-500">{t("batch.status.cancelled")}</p>
                  </div>
                );
              } else if (itemStatus === "running") {
                stateContent = (
                  <div className="flex flex-col items-center justify-center text-center p-1.5 h-full">
                    <Loader2 className="size-5 text-orange-500 animate-spin mb-1" />
                    <p className="text-[8px] font-medium text-orange-600 animate-pulse-soft">{label}</p>
                  </div>
                );
              } else {
                stateContent = (
                  <div className="flex flex-col items-center justify-center text-center p-1.5 h-full text-stone-300">
                    <ImageIcon className="size-4 mb-1 opacity-50" />
                    <p className="text-[8px] font-medium">{t("batch.status.queued")}</p>
                  </div>
                );
              }

              const borderClass =
                itemStatus === "error"
                  ? "border-amber-200 bg-amber-50"
                  : itemStatus === "cancelled"
                    ? "border-stone-200 bg-stone-50"
                    : itemStatus === "running"
                      ? "border-orange-200 bg-orange-50"
                      : "border-stone-100 bg-stone-50/50";

              return (
                <div
                  key={`${batchId}-${index}`}
                  className={`rounded-xl border-2 ${borderClass} aspect-square flex items-center justify-center transition-all animate-stagger-in`}
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  {stateContent}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
