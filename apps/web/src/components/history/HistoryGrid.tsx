import type { ReactNode } from "react";
import type { BatchSummary } from "../../api/types";
import { HistoryCard } from "./HistoryCard";

interface HistoryGridProps {
  items: BatchSummary[];
  isSelectionMode: boolean;
  selectedIds: Set<string>;
  onPreview: (batch: BatchSummary) => void;
  onToggleSelection: (batchId: string) => void;
  formatDate: (date?: string) => string;
  animationDelayStep?: number;
  aspectRatio?: number | string;
  renderPlaceholder?: (state: "pending" | "error") => ReactNode;
}

export function HistoryGrid({
  items,
  isSelectionMode,
  selectedIds,
  onPreview,
  onToggleSelection,
  formatDate,
  animationDelayStep,
  aspectRatio,
  renderPlaceholder,
}: HistoryGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4 xl:gap-6">
      {items.map((batch, index) => (
        <HistoryCard
          key={batch.task_id}
          batch={batch}
          index={index}
          isSelectionMode={isSelectionMode}
          isSelected={selectedIds.has(batch.task_id)}
          onPreview={onPreview}
          onToggleSelection={onToggleSelection}
          formatDate={formatDate}
          animationDelayStep={animationDelayStep}
          aspectRatio={aspectRatio}
          renderPlaceholder={renderPlaceholder}
        />
      ))}
    </div>
  );
}
