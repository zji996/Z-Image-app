import { Settings2, Info } from "lucide-react";
import { useState } from "react";

interface AdvancedSettingsProps {
  settings: {
    width: number;
    height: number;
    steps: number;
    guidance: number;
    seed: number | null;
  };
  onChange: (key: string, value: number | null) => void;
}

export function AdvancedSettings({ settings, onChange }: AdvancedSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between bg-slate-900 hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center space-x-2 text-slate-300">
          <Settings2 size={18} />
          <span className="font-medium text-sm">Advanced Settings</span>
        </div>
        <span className={`text-xs text-slate-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
          ▼
        </span>
      </button>

      {isOpen && (
        <div className="p-5 space-y-6 animate-in slide-in-from-top-2 fade-in duration-200">
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs uppercase text-slate-500 font-semibold tracking-wider">Width</label>
              <select
                value={settings.width}
                onChange={(e) => onChange("width", Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 outline-none"
              >
                <option value={512}>512 px</option>
                <option value={768}>768 px</option>
                <option value={1024}>1024 px</option>
                <option value={1536}>1536 px</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase text-slate-500 font-semibold tracking-wider">Height</label>
              <select
                value={settings.height}
                onChange={(e) => onChange("height", Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 outline-none"
              >
                <option value={512}>512 px</option>
                <option value={768}>768 px</option>
                <option value={1024}>1024 px</option>
                <option value={1536}>1536 px</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-xs">
              <label className="text-slate-500 font-semibold uppercase tracking-wider">Inference Steps</label>
              <span className="text-slate-300 font-mono">{settings.steps}</span>
            </div>
            <input
              type="range"
              min="1"
              max="50"
              step="1"
              value={settings.steps}
              onChange={(e) => onChange("steps", Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <p className="text-[10px] text-slate-600">
              Higher steps may improve quality but take longer. Turbo is optimized for 4-10 steps.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-xs">
              <label className="text-slate-500 font-semibold uppercase tracking-wider">Guidance Scale</label>
              <span className="text-slate-300 font-mono">{settings.guidance.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="20"
              step="0.5"
              value={settings.guidance}
              onChange={(e) => onChange("guidance", Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
             <p className="text-[10px] text-slate-600">
              How closely the image follows the prompt.
            </p>
          </div>

          <div className="space-y-2">
             <div className="flex justify-between text-xs">
              <label className="text-slate-500 font-semibold uppercase tracking-wider">Seed</label>
              <span className="text-slate-300 font-mono cursor-pointer hover:text-cyan-400" onClick={() => onChange("seed", null)} title="Click to reset">
                {settings.seed === null ? "Random" : settings.seed}
              </span>
            </div>
            <input
              type="number"
              placeholder="Random (-1)"
              value={settings.seed ?? ""}
              onChange={(e) => onChange("seed", e.target.value ? Number(e.target.value) : null)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 outline-none font-mono"
            />
          </div>

        </div>
      )}
    </div>
  );
}
