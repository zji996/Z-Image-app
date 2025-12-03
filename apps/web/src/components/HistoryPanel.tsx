import { useState } from "react";
import type React from "react";
import { TaskSummary, ImageSelectionInfo } from "../api/types";
import { getImageUrl } from "../api/client";
import type { HistoryError } from "../types/history";
import { Copy, Wand2 } from "lucide-react";
import { useI18n } from "../i18n";

interface HistoryPanelProps {
  items: TaskSummary[];
  isLoading: boolean;
  onSelectImage: (imageUrl: string) => void;
  onLoadFromHistory?: (info: ImageSelectionInfo) => void;
  error?: HistoryError;
}

export function HistoryPanel({ items, isLoading, onSelectImage, onLoadFromHistory, error }: HistoryPanelProps) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { t } = useI18n();

  const handleCopyPrompt = async (e: React.MouseEvent, prompt: string, taskId: string) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedId(taskId);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (err) {
      console.error("Failed to copy prompt", err);
    }
  };

  const handleLoadToStudio = (e: React.MouseEvent, item: TaskSummary) => {
    e.stopPropagation();
    if (!onLoadFromHistory || !item.relative_path) return;
    
    const imageUrl = getImageUrl(item.image_url || item.relative_path);
    onLoadFromHistory({
      imageUrl,
      prompt: item.prompt,
      width: item.width,
      height: item.height,
      steps: item.num_inference_steps,
      guidance: item.guidance_scale,
      seed: item.seed,
    });
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

  // Limit items to 6 for cleaner look in sidebar
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
          {displayItems.map((item, index) => {
            if (!item.relative_path || item.status !== "SUCCESS") {
              return null;
            }

            const imageUrl = getImageUrl(item.image_url || item.relative_path);
            const isHovered = hoveredItem === item.task_id;
            
            return (
              <div
                key={item.task_id}
                className="group relative rounded-xl lg:rounded-2xl overflow-hidden border border-stone-200 hover:border-orange-300 hover:shadow-lg hover:shadow-orange-500/10 hover:-translate-y-0.5 transition-all duration-300 bg-stone-50 aspect-square flex items-center justify-center animate-stagger-in"
                style={{ animationDelay: `${index * 60}ms` }}
                onMouseEnter={() => setHoveredItem(item.task_id)}
                onMouseLeave={() => setHoveredItem(null)}
              >
                <div className="absolute inset-0 bg-stone-100" />
                <button
                  type="button"
                  onClick={() => onSelectImage(imageUrl)}
                  className="w-full h-full"
                >
                  <img
                    src={imageUrl}
                    alt={item.prompt || t("historyPanel.imageAlt")}
                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                    loading="lazy"
                  />
                </button>
                
                {/* Hover overlay with actions */}
                <div className={`absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent transition-opacity duration-200 pointer-events-none ${isHovered ? 'opacity-100' : 'opacity-0'}`} />
                
                {/* Action buttons */}
                <div className={`absolute bottom-1.5 left-1.5 right-1.5 flex gap-1 transition-all duration-200 ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}>
                  {item.prompt && (
                    <button
                      type="button"
                      onClick={(e) => handleCopyPrompt(e, item.prompt!, item.task_id)}
                      className="flex-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded-lg bg-white/90 hover:bg-white text-stone-700 text-[9px] font-medium transition-colors shadow-sm"
                      title={t("historyPanel.copyTitle")}
                    >
                      <Copy size={10} />
                      <span className="hidden sm:inline">{copiedId === item.task_id ? t("common.copied") : t("common.copy")}</span>
                    </button>
                  )}
                  {onLoadFromHistory && (
                    <button
                      type="button"
                      onClick={(e) => handleLoadToStudio(e, item)}
                      className="flex-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[9px] font-medium transition-colors shadow-sm"
                      title={t("historyPanel.loadSettingsTitle")}
                    >
                      <Wand2 size={10} />
                      <span className="hidden sm:inline">{t("historyPanel.use")}</span>
                    </button>
                  )}
                </div>
                
                {/* Prompt preview on hover */}
                {item.prompt && isHovered && (
                  <div className="absolute top-1.5 left-1.5 right-1.5 px-2 py-1 bg-black/70 backdrop-blur-sm rounded-lg">
                    <p className="text-[8px] lg:text-[9px] text-white/90 line-clamp-2 leading-tight">
                      {item.prompt || t("historyPanel.promptFallback")}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
