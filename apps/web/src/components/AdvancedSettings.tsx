import { Settings2, Square, RectangleHorizontal, RectangleVertical, Smartphone, Monitor, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../i18n";

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
  { labelKey: "advanced.size.small", value: 512 },
  { labelKey: "advanced.size.normal", value: 768 },
  { labelKey: "advanced.size.large", value: 1024 },
  { labelKey: "advanced.size.max", value: 1280 },
] as const;

export function AdvancedSettings({ settings, onChange }: AdvancedSettingsProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  const handleRatioChange = (ratio: typeof ASPECT_RATIOS[0]) => {
    const longEdge = Math.max(settings.width, settings.height);
    let w, h;
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
    if (longEdge === 0) return;
    const scale = sizeValue / longEdge;
    const w = Math.round((settings.width * scale) / 8) * 8;
    const h = Math.round((settings.height * scale) / 8) * 8;
    onChange({ width: w, height: h });
  };

  const currentRatio = ASPECT_RATIOS.find(r => 
    Math.abs((settings.width / settings.height) - (r.width / r.height)) < 0.01
  );

  const longEdge = Math.max(settings.width, settings.height);
  const currentSize = SIZES.find(s => Math.abs(s.value - longEdge) < 8);

  return (
    <div className="bg-white rounded-2xl lg:rounded-3xl border border-stone-200 overflow-hidden shadow-sm transition-all duration-300 hover:shadow-md">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 lg:px-6 py-3.5 lg:py-4 flex items-center justify-between bg-white hover:bg-stone-50/50 transition-colors"
      >
        <div className="flex items-center gap-2.5 lg:gap-3 text-stone-600">
          <Settings2 size={18} className="text-stone-400" />
          <span className="font-semibold text-sm">{t("advanced.title")}</span>
        </div>
        <ChevronDown 
          size={16} 
          className={`text-stone-400 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} 
        />
      </button>

      {isOpen && (
        <div className="p-4 lg:p-6 space-y-6 lg:space-y-8 animate-fade-in bg-stone-50/50">
          
          {/* Aspect Ratio & Size */}
          <div className="space-y-5 lg:space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-[10px] lg:text-[11px] uppercase text-stone-500 font-bold tracking-wider pl-1">
                  {t("advanced.aspectRatio")}
                </label>
                <span className="text-[10px] font-mono text-stone-400">
                  {settings.width} × {settings.height}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5 lg:gap-2">
                {ASPECT_RATIOS.map((r) => {
                  const Icon = r.icon;
                  const isActive = currentRatio?.label === r.label;
                  return (
                    <button
                      key={r.label}
                      onClick={() => handleRatioChange(r)}
                      className={`flex flex-col items-center justify-center p-2 lg:p-2.5 rounded-xl border transition-all ${
                        isActive
                          ? "bg-orange-50 border-orange-200 text-orange-600 ring-1 ring-orange-100"
                          : "bg-white border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50 active:scale-95"
                      }`}
                      title={r.label}
                    >
                      <Icon size={16} className="mb-1" />
                      <span className="text-[9px] lg:text-[10px] font-medium">{r.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] lg:text-[11px] uppercase text-stone-500 font-bold tracking-wider pl-1">
                {t("advanced.imageSize")}
              </label>
              <div className="grid grid-cols-4 gap-1.5 lg:gap-2">
                {SIZES.map((s) => {
                  const isActive = currentSize?.value === s.value;
                  return (
                    <button
                      key={s.value}
                      onClick={() => handleSizeChange(s.value)}
                      className={`px-2 py-2 lg:py-2.5 rounded-xl border text-xs font-medium transition-all ${
                        isActive
                          ? "bg-orange-50 border-orange-200 text-orange-600 ring-1 ring-orange-100"
                          : "bg-white border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50 active:scale-95"
                      }`}
                    >
                      {t(s.labelKey)}
                      <div className="text-[8px] lg:text-[9px] opacity-60 font-normal mt-0.5">{s.value}px</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Inference Steps */}
          <div className="space-y-3 lg:space-y-4">
            <div className="flex justify-between text-xs items-center">
              <label className="text-stone-500 font-bold uppercase tracking-wider text-[10px] lg:text-xs">
                {t("advanced.stepsLabel")}
              </label>
              <span className="bg-white px-2 py-1 rounded-lg text-stone-600 font-mono border border-stone-200 text-[10px] shadow-sm">
                {settings.steps}
              </span>
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
              {t("advanced.stepsHint")}
            </p>
          </div>

          {/* Guidance Scale */}
          <div className="space-y-3 lg:space-y-4">
            <div className="flex justify-between text-xs items-center">
              <label className="text-stone-500 font-bold uppercase tracking-wider text-[10px] lg:text-xs">
                {t("advanced.guidanceLabel")}
              </label>
              <span className="bg-white px-2 py-1 rounded-lg text-stone-600 font-mono border border-stone-200 text-[10px] shadow-sm">
                {settings.guidance.toFixed(1)}
              </span>
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
              {t("advanced.guidanceHint")}
            </p>
          </div>

          {/* Batch Size */}
          <div className="space-y-3 lg:space-y-4">
            <div className="flex justify-between text-xs items-center">
              <label className="text-stone-500 font-bold uppercase tracking-wider text-[10px] lg:text-xs">
                {t("advanced.batchLabel")}
              </label>
              <span className="bg-white px-2 py-1 rounded-lg text-stone-600 font-mono border border-stone-200 text-[10px] shadow-sm">
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
              {t("advanced.batchHint")}
            </p>
          </div>

          {/* Seed */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs items-center">
              <label className="text-stone-500 font-bold uppercase tracking-wider text-[10px] lg:text-xs pl-1">
                {t("advanced.seedLabel")}
              </label>
              <button 
                className="text-[10px] text-orange-600 hover:text-orange-700 font-medium transition-colors active:scale-95" 
                onClick={() => onChange({ seed: null })} 
                title={t("advanced.seedResetTitle")}
              >
                {t("advanced.seedReset")}
              </button>
            </div>
            <input
              type="number"
              placeholder={t("advanced.seedPlaceholder")}
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
