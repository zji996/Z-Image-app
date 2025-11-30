import type { TaskSummary } from "../api/types";
import { getImageUrl } from "../api/client";

interface HistoryPageProps {
  items: TaskSummary[];
  isLoading: boolean;
  authKey: string;
  onRefresh: () => void;
  onSelectImage: (imageUrl: string, size?: { width: number; height: number }) => void;
}

export function HistoryPage({ items, isLoading, authKey, onRefresh, onSelectImage }: HistoryPageProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">Generation History</h2>
          <p className="text-xs text-slate-500">
            {authKey
              ? "Showing history for the current API key."
              : "History is available when an API key is configured (or auth is disabled on the server)."}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading || (!authKey && items.length === 0)}
          className="text-xs px-3 py-1.5 rounded-md border border-slate-700 bg-slate-900 text-slate-200 hover:border-cyan-500 hover:text-cyan-100 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {!authKey && items.length === 0 && !isLoading && (
        <div className="text-xs text-amber-400/80 bg-amber-900/20 border border-amber-800/40 rounded-lg px-3 py-2">
          Set an API key in the header to view per-key history when auth is enabled.
        </div>
      )}

      {items.length === 0 && !isLoading ? (
        <div className="text-xs text-slate-500 border border-slate-800 rounded-xl p-4 bg-slate-900/40">
          No history yet. Generate a few images to see them here.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                  onSelectImage(imageUrl, item.width && item.height ? { width: item.width, height: item.height } : undefined)
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
      )}
    </div>
  );
}

