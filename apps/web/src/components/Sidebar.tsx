import { Zap, Box, PenTool } from "lucide-react";

interface SidebarProps {}

export function Sidebar({}: SidebarProps) {
  return (
    <aside className="w-80 border-r border-slate-800 h-[calc(100vh-73px)] overflow-y-auto p-4 bg-slate-950 hidden lg:block">
      <div className="space-y-3 text-xs text-slate-500">
        <p className="font-semibold uppercase tracking-wider text-slate-400">
          Z-Image
        </p>
        <p className="text-slate-500">
          Text-to-image generation powered by the Z-Image family of models.
        </p>
      </div>
    </aside>
  );
}
