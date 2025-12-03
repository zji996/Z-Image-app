import { RefreshCw, CheckCircle2, Square, CheckSquare, Trash2, X } from "lucide-react";
import { useI18n } from "../../i18n";

interface HistoryHeaderProps {
  isSelectionMode: boolean;
  selectedCount: number;
  totalItems: number;
  isLoading: boolean;
  isBatchDeleting: boolean;
  canDelete: boolean;
  onRefresh: () => void;
  onEnterSelectionMode: () => void;
  onExitSelectionMode: () => void;
  onToggleSelectAll: () => void;
  onBatchDelete: () => void;
}

export function HistoryHeader({
  isSelectionMode,
  selectedCount,
  totalItems,
  isLoading,
  isBatchDeleting,
  canDelete,
  onRefresh,
  onEnterSelectionMode,
  onExitSelectionMode,
  onToggleSelectAll,
  onBatchDelete,
}: HistoryHeaderProps) {
  const { t } = useI18n();

  return (
    <div className="flex items-center justify-between sticky top-0 glass py-3 lg:py-4 z-10 border-b border-stone-200 -mx-4 lg:-mx-8 px-4 lg:px-8">
      <div>
        <h2 className="text-lg lg:text-xl font-semibold text-stone-800 tracking-tight">{t("history.title")}</h2>
        <p className="text-xs lg:text-sm text-stone-500">
          {isSelectionMode
            ? t("history.selection", { count: selectedCount })
            : t("history.subtitle")}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {isSelectionMode ? (
          <>
            <button
              type="button"
              onClick={onToggleSelectAll}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm hover:border-stone-300 transition-all active:scale-95"
            >
              {selectedCount === totalItems ? (
                <CheckSquare size={14} />
              ) : (
                <Square size={14} />
              )}
              <span className="hidden sm:inline">{t("history.selectAll")}</span>
            </button>

            <button
              type="button"
              onClick={onBatchDelete}
              disabled={selectedCount === 0 || isBatchDeleting}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-full border border-rose-200 bg-rose-50 text-rose-600 shadow-sm hover:bg-rose-100 hover:border-rose-300 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 size={14} />
              <span className="hidden sm:inline">
                {isBatchDeleting
                  ? t("history.deleteInProgress")
                  : t("history.deleteSelected", { count: selectedCount })}
              </span>
            </button>

            <button
              type="button"
              onClick={onExitSelectionMode}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm hover:border-stone-300 transition-all active:scale-95"
            >
              <X size={14} />
              <span className="hidden sm:inline">{t("history.cancelSelection")}</span>
            </button>
          </>
        ) : (
          <>
            {canDelete && totalItems > 0 && (
              <button
                type="button"
                onClick={onEnterSelectionMode}
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
  );
}
