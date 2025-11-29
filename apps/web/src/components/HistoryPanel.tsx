import { TaskSummary } from "../api/types";
import { getImageUrl } from "../api/client";

interface HistoryPanelProps {
  items: TaskSummary[];
  isLoading: boolean;
  onSelectImage: (imageUrl: string) => void;
  hasAuthKey: boolean;
}

export function HistoryPanel({ items, isLoading, onSelectImage, hasAuthKey }: HistoryPanelProps) {
  if (!hasAuthKey) {
    return (
      <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-500">
        Set an Auth Key in the header to keep a per-key history of your generations.
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Recent Generations
        </h2>
        {isLoading && (
          <span className="text-[10px] text-slate-500 animate-pulse">
            Loading...
          </span>
        )}
      </div>

      {items.length === 0 && !isLoading ? (
        <p className="text-xs text-slate-600">
          No history yet. Generate a few images to see them here.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3 max-h-56 overflow-y-auto pr-1">
          {items.map((item) => {
            if (!item.relative_path || item.status !== "SUCCESS") {
              return null;
            }

            const imageUrl = getImageUrl(item.relative_path);

            return (
              <button
                key={item.task_id}
                type="button"
                onClick={() => onSelectImage(imageUrl)}
                className="group relative rounded-lg overflow-hidden border border-slate-800 hover:border-cyan-500/60 hover:shadow-[0_0_12px_rgba(6,182,212,0.35)] transition-all duration-150 bg-slate-900"
              >
                <img
                  src={imageUrl}
                  alt={item.prompt || "Generated image"}
                  className="w-full h-20 object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 px-2 py-1 bg-gradient-to-t from-black/70 to-transparent">
                  <p className="truncate text-[10px] text-slate-200">
                    {item.prompt || "Untitled"}
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

