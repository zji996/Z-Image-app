import { Download, Loader2, AlertCircle } from "lucide-react";

interface ResultViewerProps {
  status: "idle" | "pending" | "generating" | "success" | "error";
  imageUrl: string | null;
  error?: string;
  generationTime?: number;
  width?: number;
  height?: number;
}

export function ResultViewer({ status, imageUrl, error, generationTime, width, height }: ResultViewerProps) {
  if (status === "idle") {
    return (
      <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-slate-900/30 rounded-2xl border-2 border-dashed border-slate-800 text-slate-600 p-8">
        <div className="size-24 rounded-full bg-slate-900 mb-6 flex items-center justify-center">
          <div className="size-12 bg-slate-800 rounded-full animate-pulse" />
        </div>
        <h3 className="text-lg font-medium text-slate-400 mb-2">Ready to Create</h3>
        <p className="text-sm text-center max-w-xs">
          Enter a prompt and settings on the left to generate your first image.
        </p>
      </div>
    );
  }

  if (status === "pending" || status === "generating") {
    return (
      <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-slate-900/30 rounded-2xl border border-slate-800 p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent" />
        <Loader2 className="size-16 text-cyan-500 animate-spin mb-6" />
        <h3 className="text-lg font-medium text-slate-200 animate-pulse">Generating...</h3>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-red-950/10 rounded-2xl border border-red-900/50 p-8">
        <AlertCircle className="size-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-red-400 mb-2">Generation Failed</h3>
        <p className="text-sm text-red-300/70 text-center max-w-sm">
          {error || "An unknown error occurred while generating the image."}
        </p>
      </div>
    );
  }

  return (
    <div className="relative group bg-slate-950 rounded-2xl overflow-hidden shadow-2xl shadow-black/50 border border-slate-800">
      {imageUrl && (
        <img
          src={imageUrl}
          alt="Generated"
          className="w-full h-auto object-contain max-h-[80vh]"
        />
      )}
      
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-between">
        <div className="space-y-1">
          {generationTime && (
            <p className="text-xs font-mono text-green-400">
              Inference: {generationTime.toFixed(2)}s
            </p>
          )}
          <p className="text-xs text-slate-400">
            {width && height ? `${width}×${height}` : "1024×1024"}
          </p>
        </div>
        <div className="flex space-x-2">
          {/**
           * Use PNG for downloads. When previews are served as WebP,
           * derive the PNG URL by swapping the extension while keeping
           * any query string intact.
           */}
          {(() => {
            const href = (() => {
              if (!imageUrl) return "#";
              const [base, query] = imageUrl.split("?");
              if (base.toLowerCase().endsWith(".webp")) {
                const pngBase = `${base.slice(0, -5)}.png`;
                return query ? `${pngBase}?${query}` : pngBase;
              }
              return imageUrl;
            })();

            return (
              <a
                href={href}
                download={`z-image-${Date.now()}.png`}
                target="_blank"
                rel="noreferrer"
                className="p-3 rounded-xl bg-slate-800 text-white hover:bg-cyan-600 hover:text-white transition-colors shadow-lg"
                title="Download Image"
              >
                <Download size={20} />
              </a>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
