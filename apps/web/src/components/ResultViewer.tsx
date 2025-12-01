import { Download, Loader2, AlertCircle, Maximize2 } from "lucide-react";

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
      <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white rounded-3xl border-2 border-dashed border-stone-200 text-stone-400 p-8 animate-fade-in">
        <div className="size-20 rounded-full bg-stone-100 mb-6 flex items-center justify-center">
          <div className="size-3 bg-stone-300 rounded-full animate-pulse" />
        </div>
        <h3 className="text-lg font-semibold text-stone-600 mb-2">Ready to Create</h3>
        <p className="text-sm text-center max-w-xs text-stone-400">
          Enter a prompt on the left to start imagining.
        </p>
      </div>
    );
  }

  if (status === "pending" || status === "generating") {
    return (
      <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white rounded-3xl border border-stone-200 p-8 relative overflow-hidden shadow-sm animate-fade-in">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-50/30 to-transparent" />
        <Loader2 className="size-12 text-orange-500 animate-spin mb-6" />
        <h3 className="text-lg font-medium text-stone-700 animate-pulse">Creating magic...</h3>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-rose-50 rounded-3xl border border-rose-100 p-8 animate-fade-in">
        <AlertCircle className="size-12 text-rose-400 mb-4" />
        <h3 className="text-lg font-medium text-rose-700 mb-2">Generation Failed</h3>
        <p className="text-sm text-rose-600/70 text-center max-w-sm">
          {error || "An unknown error occurred while generating the image."}
        </p>
      </div>
    );
  }

  return (
    <div className="relative group bg-white rounded-3xl overflow-hidden shadow-xl shadow-stone-200/50 border border-stone-100 animate-slide-up">
      {imageUrl && (
        <div className="relative flex items-center justify-center bg-stone-50 min-h-[400px]">
          {/* Checkered background pattern for transparency */}
          <div className="absolute inset-0 opacity-[0.05]" 
               style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }} 
          />
          
          <img
            src={imageUrl}
            alt="Generated"
            className="max-w-full h-auto object-contain max-h-[80vh] shadow-sm"
          />
        </div>
      )}
      
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end justify-between translate-y-2 group-hover:translate-y-0">
        <div className="space-y-1">
          {generationTime && (
            <p className="text-[10px] font-mono text-emerald-300 font-medium tracking-wide">
              {generationTime.toFixed(2)}s
            </p>
          )}
          <p className="text-[10px] text-white/80 font-medium uppercase tracking-wider">
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
                className="p-3 rounded-xl bg-white/10 backdrop-blur-md text-white hover:bg-white hover:text-stone-900 transition-all shadow-lg active:scale-95"
                title="Download Image"
              >
                <Download size={20} />
              </a>
            );
          })()}
           <button
             type="button"
             onClick={() => window.open(imageUrl || "#", "_blank")}
             className="p-3 rounded-xl bg-white/10 backdrop-blur-md text-white hover:bg-white hover:text-stone-900 transition-all shadow-lg active:scale-95"
             title="Open Full Size"
           >
             <Maximize2 size={20} />
           </button>
        </div>
      </div>
    </div>
  );
}
