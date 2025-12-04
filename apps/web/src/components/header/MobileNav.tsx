import type { ReactNode } from "react";
import { Sparkles, Clock } from "lucide-react";
import { useI18n } from "../../i18n";

type ViewMode = "studio" | "history";

interface MobileNavProps {
  activeView: ViewMode;
  onChangeView: (view: ViewMode) => void;
}

export function MobileNav({ activeView, onChangeView }: MobileNavProps) {
  const { t } = useI18n();
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 glass border-t border-stone-200 pb-safe animate-slide-up">
      <div className="flex items-stretch h-16">
        <MobileNavButton
          active={activeView === "studio"}
          onClick={() => onChangeView("studio")}
          icon={<Sparkles size={20} />}
          label={t("header.nav.studio")}
        />
        <MobileNavButton
          active={activeView === "history"}
          onClick={() => onChangeView("history")}
          icon={<Clock size={20} />}
          label={t("header.nav.history")}
        />
      </div>
    </nav>
  );
}

interface MobileNavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}

function MobileNavButton({ active, onClick, icon, label }: MobileNavButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all duration-200 ${
        active
          ? "text-orange-600"
          : "text-stone-400 active:text-stone-600"
      }`}
    >
      <span className={`transition-transform duration-200 ${active ? "scale-110" : ""}`}>
        {icon}
      </span>
      <span className={`text-[10px] font-semibold tracking-wide ${active ? "text-orange-600" : "text-stone-500"}`}>
        {label}
      </span>
    </button>
  );
}

