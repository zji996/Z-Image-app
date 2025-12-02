import { AlertTriangle, Loader2, StopCircle, Image as ImageIcon } from "lucide-react";

export type BatchPreviewStatus = "pending" | "running" | "success" | "error" | "cancelled";

export interface BatchPreviewItem {
  taskId: string;
  index: number;
  status: BatchPreviewStatus;
  imageUrl?: string;
  width?: number;
  height?: number;
  errorCode?: string | null;
  errorHint?: string | null;
}

interface BatchPreviewProps {
  batchId?: string | null;
  total: number;
  items: BatchPreviewItem[];
  isCancelling?: boolean;
  onSelectImage: (url: string, size?: { width: number; height: number }) => void;
  onCancel?: () => void;
}

const STATUS_LABEL: Record<BatchPreviewStatus, string> = {
  pending: "Pending",
  running: "Running",
  success: "Done",
  error: "Failed",
  cancelled: "Cancelled",
};

export function BatchPreview({
  batchId,
  total,
  items,
  onSelectImage,
  onCancel,
  isCancelling,
}: BatchPreviewProps) {
  if (!batchId || total <= 1) {
    return null;
  }

  const itemMap = new Map<number, BatchPreviewItem>();
  items.forEach((item) => itemMap.set(item.index, item));

  const sortedItems = [...itemMap.values()].sort((a, b) => a.index - b.index);
  const completed = sortedItems.filter((item) => item.status === "success").length;
  const active = sortedItems.filter((item) => item.status === "pending" || item.status === "running").length;
  
  const canCancel = Boolean(onCancel) && active > 0;

  return (
    <div className="mt-6 lg:mt-8 rounded-2xl lg:rounded-3xl border border-stone-200 bg-white shadow-sm p-4 lg:p-6 space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-stone-700">Batch Progress</p>
          <p className="text-xs text-stone-400 font-medium">
            {completed} of {total} completed
          </p>
        </div>
        {canCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isCancelling}
            className="text-xs px-3 lg:px-4 py-2 rounded-full border border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100 hover:border-rose-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:scale-95"
          >
            {isCancelling ? "Cancelling..." : "Stop Remaining"}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 lg:gap-3">
        {Array.from({ length: total }).map((_, index) => {
          const item = itemMap.get(index);
          const status: BatchPreviewStatus = item?.status ?? "pending";
          const label = STATUS_LABEL[status];

          if (status === "success" && item?.imageUrl) {
            return (
              <button
                key={`${batchId}-${index}`}
                type="button"
                onClick={() => onSelectImage(item.imageUrl!, item.width && item.height ? { width: item.width, height: item.height } : undefined)}
                className="group relative rounded-xl lg:rounded-2xl overflow-hidden border border-stone-200 hover:border-orange-300 hover:shadow-md hover:-translate-y-0.5 transition-all aspect-square animate-stagger-in"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <div className="absolute inset-0 bg-stone-100" />
                <img 
                  src={item.imageUrl} 
                  alt={`Batch image ${index + 1}`} 
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                  loading="lazy"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2.5 lg:px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[9px] lg:text-[10px] font-medium text-white">{label}</p>
                </div>
              </button>
            );
          }

          let stateContent: JSX.Element;
          if (status === "error") {
            stateContent = (
              <div className="flex flex-col items-center justify-center text-center p-2 h-full">
                <AlertTriangle className="size-4 lg:size-5 text-amber-500 mb-2" />
                <p className="text-[9px] lg:text-[10px] font-medium text-amber-700 leading-tight">
                  {item?.errorHint || label}
                </p>
              </div>
            );
          } else if (status === "cancelled") {
            stateContent = (
              <div className="flex flex-col items-center justify-center text-center p-2 h-full">
                <StopCircle className="size-4 lg:size-5 text-stone-400 mb-2" />
                <p className="text-[9px] lg:text-[10px] font-medium text-stone-500">Cancelled</p>
              </div>
            );
          } else if (status === "running") {
            stateContent = (
              <div className="flex flex-col items-center justify-center text-center p-2 h-full">
                <Loader2 className="size-5 lg:size-6 text-orange-500 animate-spin mb-2" />
                <p className="text-[9px] lg:text-[10px] font-medium text-orange-600 animate-pulse-soft">{label}</p>
              </div>
            );
          } else {
            stateContent = (
              <div className="flex flex-col items-center justify-center text-center p-2 h-full text-stone-300">
                <ImageIcon className="size-5 lg:size-6 mb-2 opacity-50" />
                <p className="text-[9px] lg:text-[10px] font-medium">Queued</p>
              </div>
            );
          }

          const borderClass =
            status === "error"
              ? "border-amber-200 bg-amber-50"
              : status === "cancelled"
              ? "border-stone-200 bg-stone-50"
              : status === "running"
              ? "border-orange-200 bg-orange-50"
              : "border-stone-100 bg-stone-50/50";

          return (
            <div
              key={`${batchId}-${index}`}
              className={`rounded-xl lg:rounded-2xl border ${borderClass} aspect-square flex items-center justify-center transition-all animate-stagger-in`}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              {stateContent}
            </div>
          );
        })}
      </div>
    </div>
  );
}
