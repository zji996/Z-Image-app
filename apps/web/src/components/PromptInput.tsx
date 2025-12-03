import { Wand2 } from "lucide-react";
import { KeyboardEvent } from "react";
import { useI18n } from "../i18n";

interface PromptInputProps {
  prompt: string;
  setPrompt: (prompt: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

export function PromptInput({ prompt, setPrompt, onGenerate, isGenerating }: PromptInputProps) {
  const { t } = useI18n();
  const KEY_TOKEN = "__KEY__";
  const shortcutHint = t("prompt.shortcutHint", { key: KEY_TOKEN });
  const [shortcutPrefix, shortcutSuffix = ""] = shortcutHint.split(KEY_TOKEN);
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // 检查是否正在使用中文/日文等输入法进行组合输入
    // 如果是，则不触发生成，让用户完成选字
    if (e.nativeEvent.isComposing || e.keyCode === 229) {
      return;
    }
    
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (prompt.trim() && !isGenerating) {
        onGenerate();
      }
    }
  };

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="relative group">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("prompt.placeholder")}
          disabled={isGenerating}
          className="w-full min-h-[120px] lg:min-h-[140px] p-4 lg:p-5 pr-4 pb-16 lg:pr-32 lg:pb-5 bg-white border border-stone-200 rounded-2xl lg:rounded-3xl text-base lg:text-lg text-stone-800 placeholder-stone-400 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-300 outline-none resize-none transition-all duration-300 shadow-sm group-hover:shadow-md"
        />
        {/* Mobile: button at bottom, Desktop: button at bottom-right */}
        <div className="absolute bottom-3 left-3 right-3 lg:left-auto lg:right-3">
          <button
            onClick={onGenerate}
            disabled={!prompt.trim() || isGenerating}
            className={`w-full lg:w-auto flex items-center justify-center gap-2 px-5 lg:px-6 py-2.5 lg:py-3 rounded-xl lg:rounded-2xl font-semibold transition-all duration-300 ${
              !prompt.trim() || isGenerating
                ? "bg-stone-100 text-stone-400 cursor-not-allowed"
                : "bg-stone-900 text-white hover:bg-orange-600 hover:shadow-lg hover:shadow-orange-200 hover:-translate-y-0.5 active:scale-95"
            }`}
          >
            {isGenerating ? (
              <>
                <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{t("prompt.creating")}</span>
              </>
            ) : (
              <>
                <Wand2 size={18} />
                <span>{t("prompt.generate")}</span>
              </>
            )}
          </button>
        </div>
      </div>
      <div className="flex justify-between items-center px-1 lg:px-2">
        <p className="text-[10px] lg:text-xs text-stone-400">
          {shortcutPrefix}
          <kbd className="font-sans bg-white px-1.5 py-0.5 rounded text-stone-500 border border-stone-200 shadow-sm text-[10px] font-medium">
            Enter
          </kbd>
          {shortcutSuffix}
        </p>
        <p className="text-[10px] lg:text-xs text-stone-400 font-medium tabular-nums">
          {t("prompt.charCount", { count: prompt.length })}
        </p>
      </div>
    </div>
  );
}
