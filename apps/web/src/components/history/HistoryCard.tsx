import { Layers, Loader2, AlertTriangle, CheckCircle2, Square } from "lucide-react";
import type { ReactNode } from "react";
import type { BatchSummary } from "../../api/types";
import { getImageUrl } from "../../api/client";
import { useI18n } from "../../i18n";
import { CachedImage } from "../CachedImage";

interface HistoryCardProps {
  batch: BatchSummary;
  index: number;
  isSelectionMode: boolean;
  isSelected: boolean;
  onPreview: (batch: BatchSummary) => void;
  onToggleSelection: (batchId: string) => void;
  formatDate: (date?: string) => string;
  animationDelayStep?: number;
  aspectRatio?: number | string;
  renderPlaceholder?: (state: "pending" | "error") => ReactNode;
}

export function HistoryCard({
  batch,
  index,
  isSelectionMode,
  isSelected,
  onPreview,
  onToggleSelection,
  formatDate,
  animationDelayStep = 50,
  aspectRatio = "1 / 1",
  renderPlaceholder,
}: HistoryCardProps) {
  const { t } = useI18n();
  const imageUrl = batch.image_url ? getImageUrl(batch.image_url) :
    batch.relative_path ? getImageUrl(batch.relative_path) : null;
  const batchSize = batch.batch_size || 1;
  const successCount = batch.success_count ?? (batch.status === "SUCCESS" ? batchSize : 0);
  const isComplete = batch.status === "SUCCESS";
  const isPending = batch.status === "PENDING" && !imageUrl;
  const isFailed = batch.status === "FAILURE" && successCount === 0;
  const isMultiImage = batchSize > 1;
  const hasImage = !!imageUrl;

  const handleClick = () => {
    if (isSelectionMode) {
      onToggleSelection(batch.task_id);
      return;
    }
    onPreview(batch);
  };

  return (
    <div
      className="group relative animate-stagger-in"
      style={{
        aspectRatio: `${aspectRatio}`,
        animationDelay: `${index * animationDelayStep}ms`,
      }}
    >
      {isMultiImage && hasImage && !isSelectionMode && (
        <>
          <div
            className="absolute inset-0 rounded-xl lg:rounded-2xl bg-stone-300 transform rotate-2 translate-x-1.5 translate-y-1.5 opacity-50 transition-transform duration-300 group-hover:rotate-3 group-hover:translate-x-2 group-hover:translate-y-2"
          />
          <div
            className="absolute inset-0 rounded-xl lg:rounded-2xl bg-stone-200 transform -rotate-1 translate-x-0.5 translate-y-0.5 opacity-70 transition-transform duration-300 group-hover:-rotate-2 group-hover:translate-x-1 group-hover:translate-y-1"
          />
        </>
      )}

      <button
        type="button"
        onClick={handleClick}
        className={`relative w-full h-full rounded-xl lg:rounded-2xl overflow-hidden bg-stone-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ease-out ${
          isSelectionMode && isSelected
            ? "ring-2 ring-orange-500 ring-offset-2"
            : ""
        }`}
      >
        {hasImage ? (
          <CachedImage
            src={imageUrl}
            alt={batch.prompt || t("historyPanel.imageAlt")}
            className="w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
        ) : renderPlaceholder ? (
          <div className="w-full h-full flex items-center justify-center bg-stone-200">
            {renderPlaceholder(isPending ? "pending" : "error")}
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-stone-200">
            {isPending ? (
              <Loader2 className="size-8 text-stone-400 animate-spin" />
            ) : (
              <AlertTriangle className="size-8 text-stone-400" />
            )}
          </div>
        )}

        {isSelectionMode && (
          <div className={`absolute top-2 left-2 size-6 rounded-full flex items-center justify-center transition-all z-20 ${
            isSelected
              ? "bg-orange-500 text-white"
              : "bg-white/80 text-stone-400 border border-stone-200"
          }`}>
            {isSelected ? (
              <CheckCircle2 size={16} />
            ) : (
              <Square size={14} />
            )}
          </div>
        )}

        {isMultiImage && !isSelectionMode && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm text-white text-[10px] font-medium z-20">
            <Layers size={12} />
            <span>{successCount}/{batchSize}</span>
          </div>
        )}

        {!isSelectionMode && (
          <div className={`absolute top-2 left-2 size-2.5 rounded-full z-20 ${
            isComplete ? "bg-emerald-500" :
              isPending ? "bg-orange-500 animate-pulse" :
                isFailed ? "bg-rose-500" :
                  "bg-amber-500"
          }`} />
        )}

        {!isSelectionMode && (
          <div className="absolute inset-x-0 bottom-0 p-2.5 lg:p-3 bg-gradient-to-t from-black/60 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
            <p className="truncate text-[10px] lg:text-xs font-medium text-white/90">
              {batch.prompt || t("history.promptFallback")}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              {batch.width && batch.height && (
                <span className="text-[9px] text-white/60">
                  {batch.width} × {batch.height}
                </span>
              )}
              <span className="text-[9px] text-white/60">
                {formatDate(batch.created_at)}
              </span>
            </div>
          </div>
        )}
      </button>
    </div>
  );
}
