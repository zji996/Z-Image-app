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
      <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 p-4 text-xs text-stone-500 animate-fade-in">
        This server requires an API key to show history. Add your key in the header to continue.
      </div>
    );
  }

  if (error === "unknown") {
    return (
      <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 p-4 text-xs text-stone-500 animate-fade-in">
        Unable to load history right now. Visit the History tab to try again.
      </div>
    );
  }

  // Limit items to 6 for cleaner look in sidebar
  const displayItems = items.slice(0, 6);

  return (
    <div className="mt-6 lg:mt-8 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-stone-800 tracking-tight">
          Recent Generations
        </h2>
        {isLoading && (
          <span className="text-[10px] text-stone-400 animate-pulse-soft">
            Loading...
          </span>
        )}
      </div>

      {items.length === 0 && !isLoading ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-6 text-center">
          <p className="text-xs text-stone-500">
            No history yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-3 gap-2 lg:gap-3">
          {displayItems.map((item, index) => {
            if (!item.relative_path || item.status !== "SUCCESS") {
              return null;
            }

            const imageUrl = getImageUrl(item.image_url || item.relative_path);
            
            return (
              <button
                key={item.task_id}
                type="button"
                onClick={() => onSelectImage(imageUrl)}
                className="group relative rounded-xl lg:rounded-2xl overflow-hidden border border-stone-200 hover:border-orange-300 hover:shadow-lg hover:shadow-orange-500/10 hover:-translate-y-0.5 transition-all duration-300 bg-stone-50 aspect-square flex items-center justify-center animate-stagger-in"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div className="absolute inset-0 bg-stone-100" />
                <img
                  src={imageUrl}
                  alt={item.prompt || "Generated image"}
                  className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                  loading="lazy"
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
