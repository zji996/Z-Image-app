import { Settings2 } from "lucide-react";
import { useState } from "react";

interface AdvancedSettingsProps {
  settings: {
    width: number;
    height: number;
    steps: number;
    guidance: number;
    seed: number | null;
    images: number;
  };
  onChange: (key: string, value: number | null) => void;
}

export function AdvancedSettings({ settings, onChange }: AdvancedSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-sm transition-all duration-300 hover:shadow-md">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between bg-white hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center space-x-3 text-stone-600">
          <Settings2 size={20} className="text-stone-400" />
          <span className="font-semibold text-sm">Advanced Settings</span>
        </div>
        <span className={`text-xs text-stone-400 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}>
          ▼
        </span>
      </button>

      {isOpen && (
        <div className="p-6 space-y-8 animate-slide-up bg-stone-50/50">
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] uppercase text-stone-500 font-bold tracking-wider pl-1">Width</label>
              <div className="relative">
                <select
                  value={settings.width}
                  onChange={(e) => onChange("width", Number(e.target.value))}
                  className="w-full appearance-none bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-700 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 outline-none transition-all shadow-sm"
                >
                  <option value={512}>512 px</option>
                  <option value={768}>768 px</option>
                  <option value={1024}>1024 px</option>
                  <option value={1536}>1536 px</option>
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-stone-400 text-xs">▼</div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] uppercase text-stone-500 font-bold tracking-wider pl-1">Height</label>
              <div className="relative">
                <select
                  value={settings.height}
                  onChange={(e) => onChange("height", Number(e.target.value))}
                  className="w-full appearance-none bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-700 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 outline-none transition-all shadow-sm"
                >
                  <option value={512}>512 px</option>
                  <option value={768}>768 px</option>
                  <option value={1024}>1024 px</option>
                  <option value={1536}>1536 px</option>
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-stone-400 text-xs">▼</div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between text-xs items-center">
              <label className="text-stone-500 font-bold uppercase tracking-wider">Inference Steps</label>
              <span className="bg-white px-2 py-1 rounded-md text-stone-600 font-mono border border-stone-200 text-[10px] shadow-sm">{settings.steps}</span>
            </div>
            <input
              type="range"
              min="1"
              max="50"
              step="1"
              value={settings.steps}
              onChange={(e) => onChange("steps", Number(e.target.value))}
              className="w-full h-1.5 bg-stone-200 rounded-full appearance-none cursor-pointer accent-stone-800 hover:accent-orange-500 transition-all"
            />
            <p className="text-[10px] text-stone-400 pl-1">
              Quality vs. Speed. Turbo models work best with 4-10 steps.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between text-xs items-center">
              <label className="text-stone-500 font-bold uppercase tracking-wider">Guidance Scale</label>
              <span className="bg-white px-2 py-1 rounded-md text-stone-600 font-mono border border-stone-200 text-[10px] shadow-sm">{settings.guidance.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="20"
              step="0.5"
              value={settings.guidance}
              onChange={(e) => onChange("guidance", Number(e.target.value))}
              className="w-full h-1.5 bg-stone-200 rounded-full appearance-none cursor-pointer accent-stone-800 hover:accent-orange-500 transition-all"
            />
            <p className="text-[10px] text-stone-400 pl-1">
              Prompt adherence. Higher values respect the prompt more strictly.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between text-xs items-center">
              <label className="text-stone-500 font-bold uppercase tracking-wider">Batch Size</label>
              <span className="bg-white px-2 py-1 rounded-md text-stone-600 font-mono border border-stone-200 text-[10px] shadow-sm">
                {settings.images ?? 1}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={4}
              step={1}
              value={settings.images ?? 1}
              onChange={(e) => onChange("images", Number(e.target.value))}
              className="w-full h-1.5 bg-stone-200 rounded-full appearance-none cursor-pointer accent-stone-800 hover:accent-orange-500 transition-all"
            />
            <p className="text-[10px] text-stone-400 pl-1">
              Generate up to 4 variations at once.
            </p>
          </div>

          <div className="space-y-2">
             <div className="flex justify-between text-xs items-center">
              <label className="text-stone-500 font-bold uppercase tracking-wider pl-1">Seed</label>
              <button 
                className="text-[10px] text-orange-600 hover:text-orange-700 font-medium transition-colors" 
                onClick={() => onChange("seed", null)} 
                title="Click to randomize"
              >
                Reset to Random
              </button>
            </div>
            <input
              type="number"
              placeholder="Random (-1)"
              value={settings.seed ?? ""}
              onChange={(e) => onChange("seed", e.target.value ? Number(e.target.value) : null)}
              className="w-full bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-700 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 outline-none font-mono transition-all shadow-sm placeholder-stone-300"
            />
          </div>

        </div>
      )}
    </div>
  );
}
