import { useState } from "react";
import { Sparkles, Clock, Key } from "lucide-react";
import { useI18n } from "../i18n";
import { ApiKeyModal, MobileNav, LanguageToggle, NavButton } from "./header";

export { MobileNav };

type ViewMode = "studio" | "history";

interface HeaderProps {
  authKey: string;
  onAuthKeyChange: (value: string) => void;
  activeView: ViewMode;
  onChangeView: (view: ViewMode) => void;
}

export function Header({ authKey, onAuthKeyChange, activeView, onChangeView }: HeaderProps) {
  const [showKeyModal, setShowKeyModal] = useState(false);
  const { t } = useI18n();
  
  return (
    <>
      <header className="flex items-center justify-between px-4 lg:px-6 py-3 lg:py-4 border-b border-stone-200 glass sticky top-0 z-30 animate-fade-in">
        {/* Logo & Brand */}
        <div className="flex items-center gap-3 lg:gap-6">
          <div className="flex items-center gap-2.5">
            <div className="size-8 lg:size-9 rounded-xl bg-gradient-to-br from-stone-800 to-stone-600 flex items-center justify-center text-white font-bold shadow-lg shadow-stone-300/50 transition-transform hover:scale-105">
              Z
            </div>
            <h1 className="text-lg lg:text-xl font-bold text-stone-800 tracking-tight">
              Z-Image
            </h1>
          </div>
          
          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1 text-xs">
            <NavButton
              active={activeView === "studio"}
              onClick={() => onChangeView("studio")}
              icon={<Sparkles size={14} />}
              label={t("header.nav.studio")}
            />
            <NavButton
              active={activeView === "history"}
              onClick={() => onChangeView("history")}
              icon={<Clock size={14} />}
              label={t("header.nav.history")}
            />
          </nav>
        </div>
        
        {/* Right side controls */}
        <div className="flex items-center gap-3 lg:gap-4">
          {/* Auth status indicator - desktop */}
          <div className="hidden sm:flex items-center gap-2">
            <span
              className={`inline-flex size-2 rounded-full transition-colors duration-300 ${
                authKey ? "bg-emerald-400 shadow-sm shadow-emerald-200" : "bg-stone-300"
              }`}
            />
            <span className="text-[10px] text-stone-400 uppercase tracking-wide font-medium">
              {authKey ? t("header.status.authenticated") : t("header.status.guest")}
            </span>
          </div>
          
          {/* Unified key button opens modal on all viewports */}
          <button
            type="button"
            onClick={() => setShowKeyModal(true)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all text-xs font-medium ${
              authKey 
                ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
                : "bg-stone-50 border-stone-200 text-stone-500"
            }`}
          >
            <Key size={14} />
            <span>{authKey ? t("header.button.keySet") : t("header.button.setKey")}</span>
          </button>

          <LanguageToggle />

          {/* Version badge - hidden on mobile */}
          <div className="hidden md:block text-[10px] text-stone-400 font-mono bg-stone-100 px-2 py-1 rounded-lg">
            v0.1.0
          </div>
        </div>
      </header>
      
      {/* API Key Modal */}
      {showKeyModal && (
        <ApiKeyModal
          authKey={authKey}
          onAuthKeyChange={onAuthKeyChange}
          onClose={() => setShowKeyModal(false)}
        />
      )}
    </>
  );
}
