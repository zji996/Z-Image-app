import { useI18n } from "../i18n";

export function Sidebar() {
  const { t } = useI18n();
  return (
    <aside className="w-80 border-r border-slate-800 h-[calc(100vh-73px)] overflow-y-auto p-4 bg-slate-950 hidden lg:block">
      <div className="space-y-3 text-xs text-slate-500">
        <p className="font-semibold uppercase tracking-wider text-slate-400">
          Z-Image
        </p>
        <p className="text-slate-500">
          {t("sidebar.tagline")}
        </p>
      </div>
    </aside>
  );
}
