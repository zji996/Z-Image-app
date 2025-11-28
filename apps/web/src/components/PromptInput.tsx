import { Wand2 } from "lucide-react";
import { KeyboardEvent } from "react";

interface PromptInputProps {
  prompt: string;
  setPrompt: (prompt: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

export function PromptInput({ prompt, setPrompt, onGenerate, isGenerating }: PromptInputProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (prompt.trim() && !isGenerating) {
        onGenerate();
      }
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe the image you want to imagine..."
          disabled={isGenerating}
          className="w-full min-h-[120px] p-4 pr-32 bg-slate-900/50 border border-slate-800 rounded-2xl text-lg text-slate-100 placeholder-slate-600 focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 outline-none resize-none transition-all shadow-inner"
        />
        <div className="absolute bottom-3 right-3">
          <button
            onClick={onGenerate}
            disabled={!prompt.trim() || isGenerating}
            className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl font-semibold transition-all duration-200 ${
              !prompt.trim() || isGenerating
                ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                : "bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:shadow-lg hover:shadow-cyan-500/25 hover:-translate-y-0.5 active:translate-y-0"
            }`}
          >
            {isGenerating ? (
              <>
                <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Thinking...</span>
              </>
            ) : (
              <>
                <Wand2 size={18} />
                <span>Generate</span>
              </>
            )}
          </button>
        </div>
      </div>
      <div className="flex justify-between items-center px-1">
        <p className="text-xs text-slate-500">
          Press <kbd className="font-sans bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 border border-slate-700">Enter</kbd> to generate
        </p>
        <p className="text-xs text-slate-600">
           {prompt.length} chars
        </p>
      </div>
    </div>
  );
}
