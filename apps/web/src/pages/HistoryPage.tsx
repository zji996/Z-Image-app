import { useCallback, useState, type ReactNode } from "react";
import type { BatchSummary, BatchDetail, HistoryError, ImageSelectionInfo } from "../api/types";
import { getBatchDetail } from "../api/client";
import { useI18n } from "../i18n";
import { useClipboard } from "../hooks/useClipboard";
import { HistoryHeader } from "../components/history/HistoryHeader";
import { HistoryGrid } from "../components/history/HistoryGrid";
import { BatchDetailModal } from "../components/history/BatchDetailModal";
import { formatHistoryDate } from "../utils/history";
import { Image as ImageIcon } from "lucide-react";

interface HistoryPageProps {
  items: BatchSummary[];
  isLoading: boolean;
  error: HistoryError;
  canLoadMore: boolean;
  authKey?: string;
  onRefresh: () => void;
  onLoadMore: () => void;
  onSelectImage: (imageUrl: string, size?: { width: number; height: number }, options?: { keepBatchState?: boolean }) => void;
  onLoadToStudio?: (info: ImageSelectionInfo) => void;
  onDeleteItem?: (batchId: string) => void | Promise<void>;
  onBatchDelete?: (batchIds: string[]) => void | Promise<void>;
  isBatchDeleting?: boolean;
  cardOptions?: {
    aspectRatio?: number | string;
    animationDelayStep?: number;
    renderPlaceholder?: (state: "pending" | "error") => ReactNode;
  };
  modalOptions?: {
    renderPlaceholder?: () => ReactNode;
    thumbnailAnimationDelayStep?: number;
  };
}

export function HistoryPage({
  items,
  isLoading,
  error,
  canLoadMore,
  authKey,
  onRefresh,
  onLoadMore,
  onSelectImage,
  onLoadToStudio,
  onDeleteItem,
  onBatchDelete,
  isBatchDeleting,
  cardOptions,
  modalOptions,
}: HistoryPageProps) {
  const [selectedBatch, setSelectedBatch] = useState<BatchSummary | null>(null);
  const [batchDetail, setBatchDetail] = useState<BatchDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [localBatchDeleting, setLocalBatchDeleting] = useState(false);

  const { t } = useI18n();
  const { copy, copiedId } = useClipboard();

  const formatDate = useCallback(
    (dateStr?: string) => formatHistoryDate(dateStr, t("history.preview.dateFallback")),
    [t]
  );

  const hasItems = items.length > 0;
  const showGrid = hasItems && !error;
  const canDelete = Boolean(onDeleteItem || onBatchDelete);
  const batchDeleting = isBatchDeleting ?? localBatchDeleting;

  const loadBatchDetail = useCallback(async (batch: BatchSummary) => {
    setSelectedBatch(batch);
    setSelectedImageIndex(0);
    setIsLoadingDetail(true);
    setBatchDetail(null);

    try {
      const detail = await getBatchDetail(batch.task_id, authKey || "admin");
      setBatchDetail(detail);
      const firstSuccessIndex = detail.items.findIndex(
        (item) => item.status === "success" && item.image_url
      );
      if (firstSuccessIndex >= 0) {
        setSelectedImageIndex(firstSuccessIndex);
      }
    } catch (err) {
      console.error("Failed to load batch detail", err);
    } finally {
      setIsLoadingDetail(false);
    }
  }, [authKey]);

  const toggleSelection = useCallback((batchId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) {
        next.delete(batchId);
      } else {
        next.add(batchId);
      }
      return next;
    });
  }, []);

  const handlePreview = useCallback((batch: BatchSummary) => {
    if (isSelectionMode) {
      toggleSelection(batch.task_id);
      return;
    }
    loadBatchDetail(batch);
  }, [isSelectionMode, loadBatchDetail, toggleSelection]);

  const handleClosePreview = useCallback(() => {
    if (isDeleting) return;
    setSelectedBatch(null);
    setBatchDetail(null);
  }, [isDeleting]);

  const handleDelete = useCallback(async () => {
    if (!selectedBatch || !onDeleteItem || isDeleting) return;
    if (!window.confirm(t("history.confirm.deleteBatch"))) {
      return;
    }
    setIsDeleting(true);
    try {
      await onDeleteItem(selectedBatch.task_id);
      handleClosePreview();
    } catch (err) {
      console.error("Failed to delete batch", err);
    } finally {
      setIsDeleting(false);
    }
  }, [handleClosePreview, isDeleting, onDeleteItem, selectedBatch, t]);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((item) => item.task_id)));
    }
  }, [items, selectedIds.size]);

  const enterSelectionMode = useCallback(() => {
    setIsSelectionMode(true);
    setSelectedIds(new Set());
  }, []);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0 || batchDeleting) return;
    if (!onBatchDelete && !onDeleteItem) return;

    const count = selectedIds.size;
    if (!window.confirm(t("history.confirm.deleteMany", { count }))) {
      return;
    }

    const ids = Array.from(selectedIds);

    if (onBatchDelete) {
      await onBatchDelete(ids);
      exitSelectionMode();
      return;
    }

    setLocalBatchDeleting(true);
    try {
      const deletePromises = ids.map(async (batchId) => {
        try {
          await onDeleteItem?.(batchId);
        } catch (error: unknown) {
          console.error(`Failed to delete ${batchId}`, error);
        }
      });
      await Promise.all(deletePromises);
      exitSelectionMode();
    } catch (err) {
      console.error("Batch delete failed", err);
    } finally {
      setLocalBatchDeleting(false);
    }
  }, [batchDeleting, exitSelectionMode, onBatchDelete, onDeleteItem, selectedIds, t]);

  const handleCopyPrompt = useCallback(async (prompt: string, taskId?: string) => {
    await copy(prompt, taskId);
  }, [copy]);

  const modalLoadToStudio = useCallback((info: ImageSelectionInfo) => {
    if (onLoadToStudio) {
      onLoadToStudio(info);
      return;
    }
    const size = info.width && info.height ? { width: info.width, height: info.height } : undefined;
    onSelectImage(info.imageUrl, size, { keepBatchState: true });
  }, [onLoadToStudio, onSelectImage]);

  return (
    <div className="space-y-6 lg:space-y-8 animate-fade-in pb-24 lg:pb-20">
      <HistoryHeader
        isSelectionMode={isSelectionMode}
        selectedCount={selectedIds.size}
        totalItems={items.length}
        isLoading={isLoading}
        isBatchDeleting={batchDeleting}
        canDelete={canDelete}
        onRefresh={onRefresh}
        onEnterSelectionMode={enterSelectionMode}
        onExitSelectionMode={exitSelectionMode}
        onToggleSelectAll={toggleSelectAll}
        onBatchDelete={handleBatchDelete}
      />

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

      {items.length === 0 && !isLoading && !error && (
        <div className="flex flex-col items-center justify-center py-16 lg:py-20 text-stone-400 border-2 border-dashed border-stone-200 rounded-3xl bg-white animate-fade-in">
          <ImageIcon size={40} className="mb-4 opacity-20 lg:size-12" />
          <p className="text-sm font-medium">{t("history.empty.title")}</p>
          <p className="text-xs opacity-60 mt-1">{t("history.empty.subtitle")}</p>
        </div>
      )}

      {showGrid && (
        <>
          <HistoryGrid
            items={items}
            isSelectionMode={isSelectionMode}
            selectedIds={selectedIds}
            onPreview={handlePreview}
            onToggleSelection={toggleSelection}
            formatDate={formatDate}
            animationDelayStep={cardOptions?.animationDelayStep}
            aspectRatio={cardOptions?.aspectRatio}
            renderPlaceholder={cardOptions?.renderPlaceholder}
          />

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

      {selectedBatch && (
        <BatchDetailModal
          batch={selectedBatch}
          detail={batchDetail}
          isLoading={isLoadingDetail}
          selectedImageIndex={selectedImageIndex}
          onSelectImageIndex={setSelectedImageIndex}
          onClose={handleClosePreview}
          onDelete={onDeleteItem ? handleDelete : undefined}
          isDeleting={isDeleting}
          onCopyPrompt={handleCopyPrompt}
          copiedId={copiedId}
          onLoadToStudio={onLoadToStudio ? modalLoadToStudio : undefined}
          formatDate={formatDate}
          renderPlaceholder={modalOptions?.renderPlaceholder}
          thumbnailAnimationDelayStep={modalOptions?.thumbnailAnimationDelayStep}
        />
      )}
    </div>
  );
}
