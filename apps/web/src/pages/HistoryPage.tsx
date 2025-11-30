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
  const hasItems = items.length > 0;
  const showGrid = hasItems && !error;

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
                  onClick={() =>
                    onSelectImage(
                      imageUrl,
                      item.width && item.height ? { width: item.width, height: item.height } : undefined,
                    )
                  }
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
    </div>
  );
}
