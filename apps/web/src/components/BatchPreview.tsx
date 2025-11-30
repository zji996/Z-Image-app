import { AlertTriangle, Loader2, StopCircle } from "lucide-react";

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
  pending: "等待中",
  running: "生成中",
  success: "完成",
  error: "失败",
  cancelled: "已取消",
};

export function BatchPreview({
  batchId,
  total,
  items,
  onSelectImage,
  onCancel,
  isCancelling,
}: BatchPreviewProps) {
  if (!batchId || total <= 0) {
    return null;
  }

  const itemMap = new Map<number, BatchPreviewItem>();
  items.forEach((item) => itemMap.set(item.index, item));

  const sortedItems = [...itemMap.values()].sort((a, b) => a.index - b.index);
  const completed = sortedItems.filter((item) => item.status === "success").length;
  const active = sortedItems.filter((item) => item.status === "pending" || item.status === "running").length;
  const showPanel = total > 1 || completed < total || active > 0;

  if (!showPanel) {
    return null;
  }

  const canCancel = Boolean(onCancel) && active > 0;

  return (
    <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">当前批次</p>
          <p className="text-xs text-slate-500">
            {completed}/{total} 已完成
          </p>
        </div>
        {canCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isCancelling}
            className="text-xs px-3 py-1.5 rounded-md border border-rose-500/60 text-rose-100 bg-rose-500/10 hover:bg-rose-500/20 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isCancelling ? "取消中..." : "取消未完成"}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: total }).map((_, index) => {
          const item = itemMap.get(index);
          const status: BatchPreviewStatus = item?.status ?? "pending";
          const clickable = status === "success" && item?.imageUrl;
          const label = STATUS_LABEL[status];

          if (status === "success" && item?.imageUrl) {
            return (
              <button
                key={`${batchId}-${index}`}
                type="button"
                onClick={() => onSelectImage(item.imageUrl!, item.width && item.height ? { width: item.width, height: item.height } : undefined)}
                className="group relative rounded-xl overflow-hidden border border-slate-800 hover:border-cyan-500/70 transition"
              >
                <img src={item.imageUrl} alt={`Batch image ${index + 1}`} className="w-full h-24 object-cover" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1">
                  <p className="text-[10px] text-slate-100">{label}</p>
                </div>
              </button>
            );
          }

          let stateContent: JSX.Element;
          if (status === "error") {
            stateContent = (
              <div className="flex flex-col items-center justify-center text-center px-3 py-4 h-24">
                <AlertTriangle className="h-4 w-4 text-amber-300 mb-1" />
                <p className="text-[11px] text-amber-100">{item?.errorHint || label}</p>
              </div>
            );
          } else if (status === "cancelled") {
            stateContent = (
              <div className="flex flex-col items-center justify-center text-center px-3 py-4 h-24">
                <StopCircle className="h-4 w-4 text-slate-400 mb-1" />
                <p className="text-[11px] text-slate-300">已取消</p>
              </div>
            );
          } else if (status === "running") {
            stateContent = (
              <div className="flex flex-col items-center justify-center text-center px-3 py-4 h-24">
                <Loader2 className="h-5 w-5 text-cyan-400 animate-spin mb-1" />
                <p className="text-[11px] text-cyan-100">{label}</p>
              </div>
            );
          } else {
            stateContent = (
              <div className="flex flex-col items-center justify-center text-center px-3 py-4 h-24 text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin mb-1" />
                <p className="text-[11px]">{label}</p>
              </div>
            );
          }

          const borderClass =
            status === "error"
              ? "border-amber-500/50 bg-amber-500/5"
              : status === "cancelled"
              ? "border-slate-700 bg-slate-900/60"
              : status === "running"
              ? "border-cyan-500/40 bg-cyan-500/10"
              : "border-slate-800 bg-slate-900/50";

          return (
            <div
              key={`${batchId}-${index}`}
              className={`rounded-xl border ${borderClass} flex items-center justify-center`}
            >
              {stateContent}
            </div>
          );
        })}
      </div>
    </div>
  );
}
