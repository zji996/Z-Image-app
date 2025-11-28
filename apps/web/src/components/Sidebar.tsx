import { Zap, Box, PenTool } from "lucide-react";

interface SidebarProps {
  activeModel: string;
  onSelectModel: (modelId: string) => void;
}

export function Sidebar({ activeModel, onSelectModel }: SidebarProps) {
  const models = [
    {
      id: "z-image-turbo",
      name: "Z-Image-Turbo",
      description: "Sub-second inference, 8 NFEs.",
      icon: Zap,
      badge: "FAST",
      badgeColor: "text-green-400 border-green-400/20 bg-green-400/10",
      disabled: false,
    },
    {
      id: "z-image-base",
      name: "Z-Image-Base",
      description: "Foundation model.",
      icon: Box,
      badge: "SOON",
      badgeColor: "text-slate-400 border-slate-400/20 bg-slate-400/10",
      disabled: true,
    },
    {
      id: "z-image-edit",
      name: "Z-Image-Edit",
      description: "Image-to-image editing.",
      icon: PenTool,
      badge: "SOON",
      badgeColor: "text-slate-400 border-slate-400/20 bg-slate-400/10",
      disabled: true,
    },
  ];

  return (
    <aside className="w-80 border-r border-slate-800 h-[calc(100vh-73px)] overflow-y-auto p-4 bg-slate-950 hidden lg:block">
      <div className="mb-6">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
          Select Model
        </h2>
        <div className="space-y-3">
          {models.map((model) => {
            const Icon = model.icon;
            const isActive = activeModel === model.id;
            
            return (
              <button
                key={model.id}
                onClick={() => !model.disabled && onSelectModel(model.id)}
                disabled={model.disabled}
                className={`w-full text-left p-4 rounded-xl border transition-all duration-200 group ${
                  isActive
                    ? "bg-cyan-950/30 border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.15)]"
                    : "bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:bg-slate-800"
                } ${model.disabled ? "opacity-50 cursor-not-allowed grayscale" : "cursor-pointer"}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className={`p-2 rounded-lg ${isActive ? "bg-cyan-500/20 text-cyan-400" : "bg-slate-800 text-slate-400"}`}>
                    <Icon size={20} />
                  </div>
                  {model.badge && (
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${model.badgeColor}`}>
                      {model.badge}
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  <h3 className={`font-medium ${isActive ? "text-cyan-100" : "text-slate-200"}`}>
                    {model.name}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {model.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
