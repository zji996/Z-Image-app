import { useState, useCallback } from "react";
import type { TaskSummary, ImageSelectionInfo } from "../api/types";
import { getImageUrl } from "../api/client";
import type { HistoryError } from "../types/history";
import { 
  X, Trash2, RefreshCw, ExternalLink, Calendar, Image as ImageIcon, 
  CheckCircle2, Square, CheckSquare, Copy, Wand2, Settings2
} from "lucide-react";
import { useI18n } from "../i18n";

interface HistoryPageProps {
  items: TaskSummary[];
  isLoading: boolean;
  error: HistoryError;
  canLoadMore: boolean;
  onRefresh: () => void;
  onLoadMore: () => void;
  onSelectImage: (imageUrl: string, size?: { width: number; height: number }) => void;
  onLoadToStudio?: (info: ImageSelectionInfo) => void;
  onDeleteItem?: (taskId: string) => void | Promise<void>;
}

export function HistoryPage({
  items,
  isLoading,
  error,
  canLoadMore,
  onRefresh,
  onLoadMore,
  onSelectImage,
  onLoadToStudio,
  onDeleteItem,
}: HistoryPageProps) {
  const [selectedTask, setSelectedTask] = useState<TaskSummary | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Batch selection state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  
  // Copy state
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { t } = useI18n();

  const hasItems = items.length > 0;
  const showGrid = hasItems && !error;
  const successItems = items.filter(item => item.relative_path && item.status === "SUCCESS");

  const handlePreview = (item: TaskSummary) => {
    if (isSelectionMode) {
      toggleSelection(item.task_id);
      return;
    }
    if (!item.relative_path || item.status !== "SUCCESS") return;
    const imageUrl = getImageUrl(item.image_url || item.relative_path);
    setSelectedTask(item);
    setSelectedImageUrl(imageUrl);
  };

  const handleClosePreview = () => {
    if (isDeleting) return;
    setSelectedTask(null);
    setSelectedImageUrl(null);
  };

  const handleDelete = async () => {
    if (!selectedTask || !onDeleteItem || isDeleting) {
      return;
    }
    if (!window.confirm(t("history.confirm.deleteOne"))) {
      return;
    }
    setIsDeleting(true);
    try {
      await onDeleteItem(selectedTask.task_id);
      handleClosePreview();
    } catch (err) {
      console.error("Failed to delete history item", err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Batch selection handlers
  const toggleSelection = useCallback((taskId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === successItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(successItems.map(item => item.task_id)));
    }
  }, [selectedIds.size, successItems]);

  const enterSelectionMode = useCallback(() => {
    setIsSelectionMode(true);
    setSelectedIds(new Set());
  }, []);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleBatchDelete = async () => {
    if (!onDeleteItem || selectedIds.size === 0 || isBatchDeleting) return;
    
    const count = selectedIds.size;
    if (!window.confirm(t("history.confirm.deleteMany", { count }))) {
      return;
    }
    
    setIsBatchDeleting(true);
    try {
      const deletePromises = Array.from(selectedIds).map(async (taskId) => {
        try {
          await onDeleteItem(taskId);
        } catch (error: unknown) {
          console.error(`Failed to delete ${taskId}`, error);
        }
      });
      await Promise.all(deletePromises);
      exitSelectionMode();
    } catch (err) {
      console.error("Batch delete failed", err);
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const handleCopyPrompt = async (prompt: string, taskId?: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      if (taskId) {
        setCopiedId(taskId);
        setTimeout(() => setCopiedId(null), 1500);
      }
    } catch (err) {
      console.error("Failed to copy prompt", err);
    }
  };

  const handleLoadToStudioClick = () => {
    if (!selectedTask || !selectedImageUrl || !onLoadToStudio) return;
    
    onLoadToStudio({
      imageUrl: selectedImageUrl,
      prompt: selectedTask.prompt,
      width: selectedTask.width,
      height: selectedTask.height,
      steps: selectedTask.num_inference_steps,
      guidance: selectedTask.guidance_scale,
      seed: selectedTask.seed,
    });
    handleClosePreview();
  };

  return (
    <div className="space-y-6 lg:space-y-8 animate-fade-in pb-24 lg:pb-20">
      {/* Header */}
      <div className="flex items-center justify-between sticky top-0 glass py-3 lg:py-4 z-10 border-b border-stone-200 -mx-4 lg:-mx-8 px-4 lg:px-8">
        <div>
          <h2 className="text-lg lg:text-xl font-semibold text-stone-800 tracking-tight">{t("history.title")}</h2>
          <p className="text-xs lg:text-sm text-stone-500">
            {isSelectionMode 
              ? t("history.selection", { count: selectedIds.size })
              : t("history.subtitle")}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {isSelectionMode ? (
            <>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm hover:border-stone-300 transition-all active:scale-95"
              >
                {selectedIds.size === successItems.length ? (
                  <CheckSquare size={14} />
                ) : (
                  <Square size={14} />
                )}
                <span className="hidden sm:inline">{t("history.selectAll")}</span>
              </button>
              
              <button
                type="button"
                onClick={handleBatchDelete}
                disabled={selectedIds.size === 0 || isBatchDeleting}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-full border border-rose-200 bg-rose-50 text-rose-600 shadow-sm hover:bg-rose-100 hover:border-rose-300 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 size={14} />
                <span className="hidden sm:inline">
                  {isBatchDeleting
                    ? t("history.deleteInProgress")
                    : t("history.deleteSelected", { count: selectedIds.size })}
                </span>
              </button>
              
              <button
                type="button"
                onClick={exitSelectionMode}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm hover:border-stone-300 transition-all active:scale-95"
              >
                <X size={14} />
                <span className="hidden sm:inline">{t("history.cancelSelection")}</span>
              </button>
            </>
          ) : (
            <>
              {onDeleteItem && successItems.length > 0 && (
                <button
                  type="button"
                  onClick={enterSelectionMode}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm hover:border-orange-200 hover:text-orange-600 transition-all active:scale-95"
                >
                  <CheckCircle2 size={14} />
                  <span className="hidden sm:inline">{t("history.bulkSelect")}</span>
                </button>
              )}
              
              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                className="flex items-center gap-2 text-xs px-3 lg:px-4 py-2 rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm hover:border-orange-200 hover:text-orange-600 hover:shadow-md transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
                <span className="hidden sm:inline">{isLoading ? t("history.syncing") : t("history.refresh")}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error states */}
      {error === "unauthorized" && (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 animate-fade-in">
          {t("history.errors.auth")}
        </div>
      )}

      {error === "unknown" && (
        <div className="text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-2xl px-4 py-3 animate-fade-in">
          {t("history.errors.unknown")}
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && !isLoading && !error && (
        <div className="flex flex-col items-center justify-center py-16 lg:py-20 text-stone-400 border-2 border-dashed border-stone-200 rounded-3xl bg-white animate-fade-in">
          <ImageIcon size={40} className="mb-4 opacity-20 lg:size-12" />
          <p className="text-sm font-medium">{t("history.empty.title")}</p>
          <p className="text-xs opacity-60 mt-1">{t("history.empty.subtitle")}</p>
        </div>
      )}

      {/* Grid */}
      {showGrid && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4 xl:gap-6">
            {items.map((item, index) => {
              if (!item.relative_path || item.status !== "SUCCESS") {
                return null;
              }

              const imageUrl = getImageUrl(item.image_url || item.relative_path);
              const aspectRatio = item.width && item.height ? item.width / item.height : 1;
              const isSelected = selectedIds.has(item.task_id);
              
              return (
                <button
                  key={item.task_id}
                  type="button"
                  onClick={() => handlePreview(item)}
                  className={`group relative rounded-xl lg:rounded-2xl overflow-hidden bg-stone-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ease-out animate-stagger-in ${
                    isSelectionMode && isSelected 
                      ? "ring-2 ring-orange-500 ring-offset-2" 
                      : ""
                  }`}
                  style={{ 
                    aspectRatio: `${aspectRatio}`,
                    animationDelay: `${index * 50}ms` 
                  }}
                >
                  <img
                    src={imageUrl}
                    alt={item.prompt || t("historyPanel.imageAlt")}
                    className="w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-105"
                    loading="lazy"
                  />
                  
                  {/* Selection indicator */}
                  {isSelectionMode && (
                    <div className={`absolute top-2 left-2 size-6 rounded-full flex items-center justify-center transition-all ${
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
                  
                  {/* Hover overlay with prompt */}
                  {!isSelectionMode && (
                    <div className="absolute inset-x-0 bottom-0 p-2.5 lg:p-3 bg-gradient-to-t from-black/60 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <p className="truncate text-[10px] lg:text-xs font-medium text-white/90">
                        {item.prompt || t("history.promptFallback")}
                      </p>
                      {item.width && item.height && (
                        <p className="text-[9px] text-white/60 mt-0.5">
                          {item.width} × {item.height}
                        </p>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Load more */}
          <div className="flex justify-center pt-6 lg:pt-8">
            {canLoadMore ? (
              <button
                type="button"
                onClick={onLoadMore}
                disabled={isLoading}
                className="text-sm px-5 lg:px-6 py-2.5 rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm hover:border-orange-200 hover:text-orange-600 hover:shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                {isLoading ? t("history.loadingMore") : t("history.loadMore")}
              </button>
            ) : (
              !isLoading && <div className="w-2 h-2 rounded-full bg-stone-200" />
            )}
          </div>
        </>
      )}

      {/* Preview Modal */}
      {selectedTask && selectedImageUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 lg:p-8">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm animate-backdrop-in"
            onClick={handleClosePreview}
          />
          
          {/* Modal Content */}
          <div className="relative w-full max-w-6xl max-h-[90vh] bg-white rounded-2xl lg:rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row animate-modal-in ring-1 ring-black/5">
            
            {/* Image Area */}
            <div className="relative md:flex-1 bg-stone-50 flex items-center justify-center p-3 sm:p-4 lg:p-8 overflow-hidden min-h-[35vh] lg:min-h-[40vh]">
              {/* Pattern background */}
              <div className="absolute inset-0 pattern-dots opacity-[0.03]" />
              <img
                src={selectedImageUrl}
                alt={selectedTask.prompt || t("history.preview.imageAlt")}
                className="max-w-full max-h-full w-auto h-auto object-contain shadow-lg rounded-lg z-10"
              />
              
              {/* Close button for mobile */}
              <button 
                onClick={handleClosePreview}
                className="absolute top-3 right-3 lg:hidden p-2 bg-black/50 text-white rounded-full backdrop-blur-md z-20 active:scale-95 transition-transform"
              >
                <X size={18} />
              </button>
            </div>

            {/* Sidebar Info */}
            <div className="w-full md:w-[320px] lg:w-[380px] bg-white flex flex-col border-l border-stone-100">
              <div className="p-4 lg:p-6 flex-1 overflow-y-auto scrollbar-thin">
                <div className="flex items-start justify-between mb-5 lg:mb-6">
                  <div>
                    <h3 className="text-base lg:text-lg font-semibold text-stone-800 leading-tight">
                      {t("history.preview.title")}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-[10px] lg:text-xs text-stone-400">
                      <Calendar size={12} />
                      <span>{selectedTask.created_at || t("history.preview.dateFallback")}</span>
                    </div>
                  </div>
                  <button 
                    onClick={handleClosePreview}
                    className="hidden md:flex p-2 hover:bg-stone-100 rounded-full text-stone-400 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-5 lg:space-y-6">
                  {/* Prompt section with copy button */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] lg:text-xs font-semibold text-stone-400 uppercase tracking-wider">
                        {t("history.preview.promptLabel")}
                      </label>
                      {selectedTask.prompt && (
                        <button
                          type="button"
                          onClick={() => handleCopyPrompt(selectedTask.prompt!, selectedTask.task_id)}
                          className="flex items-center gap-1 text-[10px] text-stone-400 hover:text-orange-600 transition-colors"
                        >
                          <Copy size={12} />
                          <span>{copiedId === selectedTask.task_id ? t("common.copied") : t("common.copy")}</span>
                        </button>
                      )}
                    </div>
                    <div className="p-3 lg:p-4 bg-stone-50 rounded-xl lg:rounded-2xl text-sm text-stone-700 leading-relaxed border border-stone-100 max-h-[150px] lg:max-h-[200px] overflow-y-auto scrollbar-thin">
                      {selectedTask.prompt || t("history.preview.noPrompt")}
                    </div>
                  </div>

                  {/* Generation settings */}
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
                          {selectedTask.width && selectedTask.height ? `${selectedTask.width} × ${selectedTask.height}` : "-"}
                        </span>
                      </div>
                      <div className="p-2.5 lg:p-3 rounded-xl lg:rounded-2xl bg-stone-50 border border-stone-100">
                        <label className="text-[9px] lg:text-[10px] font-semibold text-stone-400 uppercase block mb-1">
                          {t("history.preview.stepsLabel")}
                        </label>
                        <span className="text-xs lg:text-sm font-mono text-stone-700">
                          {selectedTask.num_inference_steps ?? "-"}
                        </span>
                      </div>
                      <div className="p-2.5 lg:p-3 rounded-xl lg:rounded-2xl bg-stone-50 border border-stone-100">
                        <label className="text-[9px] lg:text-[10px] font-semibold text-stone-400 uppercase block mb-1">
                          {t("history.preview.guidanceLabel")}
                        </label>
                        <span className="text-xs lg:text-sm font-mono text-stone-700">
                          {selectedTask.guidance_scale ?? "-"}
                        </span>
                      </div>
                      <div className="p-2.5 lg:p-3 rounded-xl lg:rounded-2xl bg-stone-50 border border-stone-100">
                        <label className="text-[9px] lg:text-[10px] font-semibold text-stone-400 uppercase block mb-1">
                          {t("history.preview.seedLabel")}
                        </label>
                        <span className="text-xs lg:text-sm font-mono text-stone-700 truncate block">
                          {selectedTask.seed ?? t("history.preview.seedRandom")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="p-4 lg:p-6 border-t border-stone-100 bg-stone-50/50 space-y-2.5 lg:space-y-3">
                {/* Primary action - Load to studio with settings */}
                {onLoadToStudio && (
                  <button
                    type="button"
                    onClick={handleLoadToStudioClick}
                    className="w-full flex items-center justify-center gap-2 py-2.5 lg:py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-medium shadow-lg shadow-orange-200 hover:shadow-xl hover:shadow-orange-300 transition-all active:scale-[0.98]"
                  >
                    <Wand2 size={15} />
                    {t("history.preview.useInStudio")}
                  </button>
                )}
                
                {onDeleteItem && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="w-full flex items-center justify-center gap-2 py-2.5 lg:py-3 text-rose-600 hover:bg-rose-50 rounded-xl font-medium transition-colors disabled:opacity-50 active:scale-[0.98]"
                  >
                    <Trash2 size={15} />
                    {isDeleting ? t("history.preview.deleting") : t("history.preview.deleteImage")}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
