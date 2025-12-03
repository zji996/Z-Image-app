import { useState } from "react";
import type React from "react";
import { BatchSummary, ImageSelectionInfo } from "../api/types";
import { getImageUrl } from "../api/client";
import type { HistoryError } from "../types/history";
import { Copy, Wand2, Layers, Loader2, AlertTriangle } from "lucide-react";
import { useI18n } from "../i18n";

interface HistoryPanelProps {
  items: BatchSummary[];
  isLoading: boolean;
  onSelectImage: (imageUrl: string, size?: { width: number; height: number }, options?: { keepBatchState?: boolean }) => void;
  onLoadFromHistory?: (info: ImageSelectionInfo) => void;
  error?: HistoryError;
}

export function HistoryPanel({ items, isLoading, onSelectImage, onLoadFromHistory, error }: HistoryPanelProps) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { t } = useI18n();

  const handleCopyPrompt = async (e: React.MouseEvent, prompt: string, batchId: string) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedId(batchId);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (err) {
      console.error("Failed to copy prompt", err);
    }
  };

  const buildSelectionInfo = (batch: BatchSummary): ImageSelectionInfo | null => {
    const imageUrl = batch.image_url
      ? getImageUrl(batch.image_url)
      : batch.relative_path
        ? getImageUrl(batch.relative_path)
        : null;

    if (!imageUrl) return null;

    return {
      imageUrl,
      batchId: batch.task_id,
      batchSize: batch.batch_size,
      successCount: batch.success_count,
      failedCount: batch.failed_count,
      prompt: batch.prompt,
      width: batch.width,
      height: batch.height,
      steps: batch.num_inference_steps,
      guidance: batch.guidance_scale,
      seed: batch.base_seed,
    };
  };

  const handleLoadToStudio = (e: React.MouseEvent, batch: BatchSummary) => {
    e.stopPropagation();
    if (!onLoadFromHistory) return;

    const info = buildSelectionInfo(batch);
    if (!info) return;

    onLoadFromHistory(info);
  };

  if (error === "unauthorized") {
    return (
      <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 p-4 text-xs text-stone-500 animate-fade-in">
        {t("historyPanel.error.auth")}
      </div>
    );
  }

  if (error === "unknown") {
    return (
      <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 p-4 text-xs text-stone-500 animate-fade-in">
        {t("historyPanel.error.unknown")}
      </div>
    );
  }

  // 显示最近 6 个批次
  const displayItems = items.slice(0, 6);

  return (
    <div className="mt-6 lg:mt-8 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-stone-800 tracking-tight">
          {t("historyPanel.title")}
        </h2>
        {isLoading && (
          <span className="text-[10px] text-stone-400 animate-pulse-soft">
            {t("common.loading")}
          </span>
        )}
      </div>

      {items.length === 0 && !isLoading ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-6 text-center">
          <p className="text-xs text-stone-500 font-semibold">{t("historyPanel.emptyTitle")}</p>
          <p className="text-[11px] text-stone-400 mt-1">{t("historyPanel.emptyHint")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-3 gap-2 lg:gap-3">
          {displayItems.map((batch, index) => {
            const imageUrl = batch.image_url ? getImageUrl(batch.image_url) : 
                             batch.relative_path ? getImageUrl(batch.relative_path) : null;
            const isHovered = hoveredItem === batch.task_id;
            const batchSize = batch.batch_size || 1;
            const successCount = batch.success_count ?? (batch.status === "SUCCESS" ? batchSize : 0);
            const isPending = batch.status === "PENDING" && !imageUrl;
            // 只要有图片URL就显示图片，不严格要求 SUCCESS 状态
            const hasImage = !!imageUrl;
            const isMultiImage = batchSize > 1;

            return (
              <div
                key={batch.task_id}
                className="group relative animate-stagger-in"
                style={{ animationDelay: `${index * 60}ms` }}
                onMouseEnter={() => setHoveredItem(batch.task_id)}
                onMouseLeave={() => setHoveredItem(null)}
              >
                {/* 堆叠效果背景层 - 只在有多张图片时显示 */}
                {isMultiImage && hasImage && (
                  <>
                    <div className="absolute inset-0 rounded-xl lg:rounded-2xl bg-stone-300 transform rotate-2 translate-x-1 translate-y-1 opacity-60" />
                    <div className="absolute inset-0 rounded-xl lg:rounded-2xl bg-stone-200 transform -rotate-1 -translate-x-0.5 translate-y-0.5 opacity-80" />
                  </>
                )}
                
                  {/* 主卡片 */}
                <div className="relative rounded-xl lg:rounded-2xl overflow-hidden border border-stone-200 hover:border-orange-300 hover:shadow-lg hover:shadow-orange-500/10 hover:-translate-y-0.5 transition-all duration-300 bg-stone-50 aspect-square flex items-center justify-center">
                  <div className="absolute inset-0 bg-stone-100" />
                  
                  {/* 主按钮 - 点击选择图片 */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!hasImage) {
                        return;
                      }
                      if (onLoadFromHistory) {
                        const info = buildSelectionInfo(batch);
                        if (info) {
                          onLoadFromHistory(info);
                        }
                      } else {
                        onSelectImage(
                          imageUrl!,
                          batch.width && batch.height ? { width: batch.width, height: batch.height } : undefined,
                        );
                      }
                    }}
                    disabled={!hasImage}
                    className="w-full h-full relative z-10"
                  >
                    {hasImage ? (
                      <img
                        src={imageUrl}
                        alt={batch.prompt || t("historyPanel.imageAlt")}
                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {isPending ? (
                          <Loader2 className="size-6 text-stone-400 animate-spin" />
                        ) : (
                          <AlertTriangle className="size-6 text-stone-400" />
                        )}
                      </div>
                    )}
                  </button>

                  {/* 批次数量徽章 */}
                  {isMultiImage && (
                    <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-white text-[8px] font-medium z-20">
                      <Layers size={10} />
                      <span>{successCount}/{batchSize}</span>
                    </div>
                  )}

                  {/* Hover overlay with actions */}
                  <div className={`absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent transition-opacity duration-200 pointer-events-none z-10 ${isHovered ? 'opacity-100' : 'opacity-0'}`} />

                  {/* Action buttons */}
                  {hasImage && (
                    <div className={`absolute bottom-1.5 left-1.5 right-1.5 flex gap-1 transition-all duration-200 z-20 ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}>
                      {batch.prompt && (
                        <button
                          type="button"
                          onClick={(e) => handleCopyPrompt(e, batch.prompt!, batch.task_id)}
                          className="flex-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded-lg bg-white/90 hover:bg-white text-stone-700 text-[9px] font-medium transition-colors shadow-sm"
                          title={t("historyPanel.copyTitle")}
                        >
                          <Copy size={10} />
                          <span className="hidden sm:inline">{copiedId === batch.task_id ? t("common.copied") : t("common.copy")}</span>
                        </button>
                      )}
                      {onLoadFromHistory && (
                        <button
                          type="button"
                          onClick={(e) => handleLoadToStudio(e, batch)}
                          className="flex-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[9px] font-medium transition-colors shadow-sm"
                          title={t("historyPanel.loadSettingsTitle")}
                        >
                          <Wand2 size={10} />
                          <span className="hidden sm:inline">{t("historyPanel.use")}</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Prompt preview on hover */}
                  {batch.prompt && isHovered && hasImage && (
                    <div className="absolute top-1.5 left-1.5 right-1.5 px-2 py-1 bg-black/70 backdrop-blur-sm rounded-lg z-20">
                      <p className="text-[8px] lg:text-[9px] text-white/90 line-clamp-2 leading-tight">
                        {batch.prompt}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
