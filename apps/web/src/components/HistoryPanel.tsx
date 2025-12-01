import { TaskSummary } from "../api/types";
import { getImageUrl } from "../api/client";
import type { HistoryError } from "../types/history";

interface HistoryPanelProps {
  items: TaskSummary[];
  isLoading: boolean;
  onSelectImage: (imageUrl: string) => void;
  error?: HistoryError;
}

export function HistoryPanel({ items, isLoading, onSelectImage, error }: HistoryPanelProps) {
  if (error === "unauthorized") {
    return (
      <div className="mt-6 rounded-xl border border-stone-200 bg-stone-50 p-4 text-xs text-stone-500">
        This server requires an API key to show history. Add your key in the header to continue.
      </div>
    );
  }

  if (error === "unknown") {
    return (
      <div className="mt-6 rounded-xl border border-stone-200 bg-stone-50 p-4 text-xs text-stone-500">
        Unable to load history right now. Visit the History tab to try again.
      </div>
    );
  }

  // Limit items to 6 for cleaner look in sidebar
  const displayItems = items.slice(0, 6);

  return (
    <div className="mt-8 animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-stone-800 tracking-tight">
          Recent Generations
        </h2>
        {isLoading && (
          <span className="text-[10px] text-stone-400 animate-pulse">
            Loading...
          </span>
        )}
      </div>

      {items.length === 0 && !isLoading ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-6 text-center">
          <p className="text-xs text-stone-500">
            No history yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {displayItems.map((item, index) => {
            if (!item.relative_path || item.status !== "SUCCESS") {
              return null;
            }

            const imageUrl = getImageUrl(item.image_url || item.relative_path);
            
            // Calculate aspect ratio class if possible, but since we want a clean grid,
            // we'll stick to a fixed aspect ratio for the container but use object-cover
            // carefully, or let it fit.
            // For "清新" look, let's use a square container with object-cover (clean grid)
            // BUT add a button to see full image.
            // User complaint: "预览图比例和请求生成比例不符".
            // If we want to respect aspect ratio in a grid, we can't use a simple grid.
            // A compromise: use object-contain within a square bg-stone-100 box.
            
            return (
              <button
                key={item.task_id}
                type="button"
                onClick={() => onSelectImage(imageUrl)}
                className="group relative rounded-2xl overflow-hidden border border-stone-200 hover:border-orange-300 hover:shadow-lg hover:shadow-orange-500/10 transition-all duration-300 bg-stone-50 aspect-square flex items-center justify-center"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                 <div className="absolute inset-0 bg-stone-100" />
                <img
                  src={imageUrl}
                  alt={item.prompt || "Generated image"}
                  className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-300"
                />
                {/* Overlay for "View" */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
