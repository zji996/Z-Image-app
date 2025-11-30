import { useState } from "react";
import type { TaskSummary } from "../api/types";
import { getImageUrl } from "../api/client";

type HistoryError = "unauthorized" | "unknown" | null;

interface HistoryPageProps {
  items: TaskSummary[];
  isLoading: boolean;
  error: HistoryError;
  canLoadMore: boolean;
  onRefresh: () => void;
  onLoadMore: () => void;
  onSelectImage: (imageUrl: string, size?: { width: number; height: number }) => void;
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
}: HistoryPageProps) {
  const [selectedTask, setSelectedTask] = useState<TaskSummary | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const hasItems = items.length > 0;
  const showGrid = hasItems && !error;

  const handlePreview = (item: TaskSummary) => {
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
    // 简单确认，避免误删。
    if (!window.confirm("确定要从历史中移除这条记录吗？图片文件本身不会被删除。")) {
      return;
    }
    setIsDeleting(true);
    try {
      await onDeleteItem(selectedTask.task_id);
      // 关闭预览，列表会在上层刷新。
      handleClosePreview();
    } catch (err) {
      // 错误留给控制台即可，避免打扰用户。
      console.error("Failed to delete history item", err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">Generation History</h2>
          <p className="text-xs text-slate-500">
            Browse your recent generations and reopen any image.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="text-xs px-3 py-1.5 rounded-md border border-slate-700 bg-slate-900 text-slate-200 hover:border-cyan-500 hover:text-cyan-100 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error === "unauthorized" && (
        <div className="text-xs text-amber-300/90 bg-amber-900/20 border border-amber-800/40 rounded-lg px-3 py-2">
          This server requires an API key to view history. Add one in the header and refresh.
        </div>
      )}

      {error === "unknown" && (
        <div className="text-xs text-rose-200/90 bg-rose-950/30 border border-rose-900/40 rounded-lg px-3 py-2">
          Unable to load history right now. Please try refreshing.
        </div>
      )}

      {items.length === 0 && !isLoading && !error && (
        <div className="text-xs text-slate-500 border border-slate-800 rounded-xl p-4 bg-slate-900/40">
          No history yet. Generate a few images to see them here.
        </div>
      )}

      {showGrid && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((item) => {
              if (!item.relative_path || item.status !== "SUCCESS") {
                return null;
              }

              const imageUrl = getImageUrl(item.image_url || item.relative_path);

              return (
                <button
                  key={item.task_id}
                  type="button"
                  onClick={() => handlePreview(item)}
                  className="group relative rounded-xl overflow-hidden border border-slate-800 hover:border-cyan-500/60 hover:shadow-[0_0_16px_rgba(6,182,212,0.45)] transition-all duration-150 bg-slate-950"
                >
                  <img
                    src={imageUrl}
                    alt={item.prompt || "Generated image"}
                    className="w-full h-32 object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 px-2 py-1.5 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="truncate text-[11px] text-slate-100">
                      {item.prompt || "Untitled"}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {item.width && item.height ? `${item.width}×${item.height}` : ""}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex justify-center pt-2">
            {canLoadMore ? (
              <button
                type="button"
                onClick={onLoadMore}
                disabled={isLoading}
                className="text-xs px-4 py-1.5 rounded-md border border-slate-700 bg-slate-900 text-slate-100 hover:border-cyan-500 hover:text-cyan-100 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? "Loading..." : "Load more"}
              </button>
            ) : (
              !isLoading && <p className="text-[11px] text-slate-500">End of history</p>
            )}
          </div>
        </>
      )}

      {selectedTask && selectedImageUrl && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="relative w-full max-w-5xl mx-4 rounded-2xl border border-slate-800 bg-slate-950/95 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-950/80">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  History Preview
                </p>
                <p className="text-sm text-slate-200 truncate max-w-xs sm:max-w-md">
                  {selectedTask.prompt || "Untitled"}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClosePreview}
                className="text-xs px-2 py-1 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800/80"
              >
                Close
              </button>
            </div>

            <div className="flex flex-col md:flex-row gap-4 p-4 md:p-5">
              <div className="md:w-2/3 flex items-center justify-center bg-slate-900/60 rounded-xl border border-slate-800/70">
                <img
                  src={selectedImageUrl}
                  alt={selectedTask.prompt || "Generated image"}
                  className="max-h-[70vh] w-full object-contain rounded-lg"
                />
              </div>
              <div className="md:w-1/3 flex flex-col justify-between space-y-4">
                <div className="space-y-3 text-xs text-slate-300">
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                      Prompt
                    </p>
                    <p className="text-xs text-slate-100 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                      {selectedTask.prompt || "Untitled"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
                    {selectedTask.width && selectedTask.height && (
                      <span className="inline-flex items-center rounded-full border border-slate-700 px-2 py-0.5">
                        {selectedTask.width}×{selectedTask.height}
                      </span>
                    )}
                    {selectedTask.created_at && (
                      <span className="inline-flex items-center rounded-full border border-slate-700 px-2 py-0.5">
                        {selectedTask.created_at}
                      </span>
                    )}
                    <span className="inline-flex items-center rounded-full border border-slate-700 px-2 py-0.5">
                      {selectedTask.status}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      const size =
                        selectedTask.width && selectedTask.height
                          ? { width: selectedTask.width, height: selectedTask.height }
                          : undefined;
                      onSelectImage(selectedImageUrl, size);
                    }}
                    className="text-xs px-3 py-1.5 rounded-md border border-slate-700 bg-slate-900 text-slate-100 hover:border-cyan-500 hover:text-cyan-100"
                  >
                    Open in Studio
                  </button>
                  {onDeleteItem && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="text-xs px-3 py-1.5 rounded-md border border-rose-700/80 bg-rose-950/40 text-rose-100 hover:border-rose-500 hover:bg-rose-900/70 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isDeleting ? "Deleting..." : "Delete from history"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
