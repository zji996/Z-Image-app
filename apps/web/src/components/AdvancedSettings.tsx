import { Settings2, Square, RectangleHorizontal, RectangleVertical, Smartphone, Monitor } from "lucide-react";
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
  onChange: (updates: Partial<AdvancedSettingsProps["settings"]>) => void;
}

const ASPECT_RATIOS = [
  { label: "1:1", width: 1, height: 1, icon: Square },
  { label: "4:3", width: 4, height: 3, icon: RectangleHorizontal },
  { label: "3:4", width: 3, height: 4, icon: RectangleVertical },
  { label: "16:9", width: 16, height: 9, icon: Monitor },
  { label: "9:16", width: 9, height: 16, icon: Smartphone },
];

const SIZES = [
  { label: "Small", value: 512 },
  { label: "Normal", value: 768 },
  { label: "Large", value: 1024 },
  { label: "Max", value: 1280 },
];

export function AdvancedSettings({ settings, onChange }: AdvancedSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleRatioChange = (ratio: typeof ASPECT_RATIOS[0]) => {
    const longEdge = Math.max(settings.width, settings.height);
    let w, h;
    // Logic: Fix the long edge to the current long edge (or closest standard size), adjust short edge.
    if (ratio.width >= ratio.height) {
      w = longEdge;
      h = Math.round((longEdge * ratio.height / ratio.width) / 8) * 8;
    } else {
      h = longEdge;
      w = Math.round((longEdge * ratio.width / ratio.height) / 8) * 8;
    }
    onChange({ width: w, height: h });
  };

  const handleSizeChange = (sizeValue: number) => {
    const longEdge = Math.max(settings.width, settings.height);
    if (longEdge === 0) return; // prevent div by zero
    const scale = sizeValue / longEdge;
    const w = Math.round((settings.width * scale) / 8) * 8;
    const h = Math.round((settings.height * scale) / 8) * 8;
    onChange({ width: w, height: h });
  };

  const currentRatio = ASPECT_RATIOS.find(r => 
    Math.abs((settings.width / settings.height) - (r.width / r.height)) < 0.01
  );

  const longEdge = Math.max(settings.width, settings.height);
  const currentSize = SIZES.find(s => Math.abs(s.value - longEdge) < 8); // Tolerance for rounding

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
          
          {/* Aspect Ratio & Size */}
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-[11px] uppercase text-stone-500 font-bold tracking-wider pl-1">Aspect Ratio</label>
                <span className="text-[10px] font-mono text-stone-400">{settings.width} × {settings.height}</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {ASPECT_RATIOS.map((r) => {
                  const Icon = r.icon;
                  const isActive = currentRatio?.label === r.label;
                  return (
                    <button
                      key={r.label}
                      onClick={() => handleRatioChange(r)}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
                        isActive
                          ? "bg-orange-50 border-orange-200 text-orange-600 ring-1 ring-orange-100"
                          : "bg-white border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50"
                      }`}
                      title={r.label}
                    >
                      <Icon size={18} className="mb-1" />
                      <span className="text-[10px] font-medium">{r.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[11px] uppercase text-stone-500 font-bold tracking-wider pl-1">Image Size</label>
              <div className="grid grid-cols-4 gap-2">
                {SIZES.map((s) => {
                  const isActive = currentSize?.value === s.value;
                  return (
                    <button
                      key={s.value}
                      onClick={() => handleSizeChange(s.value)}
                      className={`px-2 py-2 rounded-xl border text-xs font-medium transition-all ${
                        isActive
                          ? "bg-orange-50 border-orange-200 text-orange-600 ring-1 ring-orange-100"
                          : "bg-white border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50"
                      }`}
                    >
                      {s.label}
                      <div className="text-[9px] opacity-60 font-normal mt-0.5">{s.value}px</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Inference Steps */}
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
              onChange={(e) => onChange({ steps: Number(e.target.value) })}
              className="w-full h-1.5 bg-stone-200 rounded-full appearance-none cursor-pointer accent-stone-800 hover:accent-orange-500 transition-all"
            />
            <p className="text-[10px] text-stone-400 pl-1">
              Quality vs. Speed. Turbo models work best with 4-10 steps.
            </p>
          </div>

          {/* Guidance Scale */}
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
              onChange={(e) => onChange({ guidance: Number(e.target.value) })}
              className="w-full h-1.5 bg-stone-200 rounded-full appearance-none cursor-pointer accent-stone-800 hover:accent-orange-500 transition-all"
            />
            <p className="text-[10px] text-stone-400 pl-1">
              Prompt adherence. Higher values respect the prompt more strictly.
            </p>
          </div>

          {/* Batch Size */}
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
              onChange={(e) => onChange({ images: Number(e.target.value) })}
              className="w-full h-1.5 bg-stone-200 rounded-full appearance-none cursor-pointer accent-stone-800 hover:accent-orange-500 transition-all"
            />
            <p className="text-[10px] text-stone-400 pl-1">
              Generate up to 4 variations at once.
            </p>
          </div>

          {/* Seed */}
          <div className="space-y-2">
             <div className="flex justify-between text-xs items-center">
              <label className="text-stone-500 font-bold uppercase tracking-wider pl-1">Seed</label>
              <button 
                className="text-[10px] text-orange-600 hover:text-orange-700 font-medium transition-colors" 
                onClick={() => onChange({ seed: null })} 
                title="Click to randomize"
              >
                Reset to Random
              </button>
            </div>
            <input
              type="number"
              placeholder="Random (-1)"
              value={settings.seed ?? ""}
              onChange={(e) => onChange({ seed: e.target.value ? Number(e.target.value) : null })}
              className="w-full bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-700 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 outline-none font-mono transition-all shadow-sm placeholder-stone-300"
            />
          </div>

        </div>
      )}
    </div>
  );
}
