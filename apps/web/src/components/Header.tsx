import { useState, useRef, useEffect } from "react";
import type { ReactNode } from "react";
import { Sparkles, Clock, Key, X, Eye, EyeOff, Check } from "lucide-react";
import { useI18n } from "../i18n";
import type { Locale, TranslationKey } from "../i18n/translations";

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
          
          {/* Mobile: Key button to open modal */}
          <button
            type="button"
            onClick={() => setShowKeyModal(true)}
            className={`lg:hidden flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all text-xs font-medium ${
              authKey 
                ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
                : "bg-stone-50 border-stone-200 text-stone-500"
            }`}
          >
            <Key size={14} />
            <span>{authKey ? t("header.button.keySet") : t("header.button.setKey")}</span>
          </button>
          
          {/* Desktop: inline input */}
          <input
            type="password"
            value={authKey}
            onChange={(e) => onAuthKeyChange(e.target.value)}
            placeholder={t("header.apiKey.placeholder")}
            className="hidden lg:block text-xs px-3 py-2 rounded-xl bg-white border border-stone-200 text-stone-600 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 font-mono transition-all shadow-sm w-32 focus:w-48"
          />
          
          <LanguageToggle />

          {/* Version badge - hidden on mobile */}
          <div className="hidden md:block text-[10px] text-stone-400 font-mono bg-stone-100 px-2 py-1 rounded-lg">
            v0.1.0
          </div>
        </div>
      </header>
      
      {/* API Key Modal for mobile */}
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

/* API Key Modal for mobile */
interface ApiKeyModalProps {
  authKey: string;
  onAuthKeyChange: (value: string) => void;
  onClose: () => void;
}

function ApiKeyModal({ authKey, onAuthKeyChange, onClose }: ApiKeyModalProps) {
  const [localKey, setLocalKey] = useState(authKey);
  const [showKey, setShowKey] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n();
  
  useEffect(() => {
    // Auto focus input when modal opens
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);
  
  const handleSave = () => {
    onAuthKeyChange(localKey.trim());
    onClose();
  };
  
  const handleClear = () => {
    setLocalKey("");
    inputRef.current?.focus();
  };
  
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm animate-backdrop-in"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="absolute inset-x-4 top-20 bg-white rounded-2xl shadow-2xl overflow-hidden animate-modal-in ring-1 ring-black/5">
        <div className="p-4 border-b border-stone-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key size={18} className="text-stone-400" />
              <h3 className="font-semibold text-stone-800">{t("header.apiKey.modalTitle")}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-stone-100 rounded-lg text-stone-400 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-stone-500 uppercase tracking-wider">
              {t("header.apiKey.label")}
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type={showKey ? "text" : "password"}
                value={localKey}
                onChange={(e) => setLocalKey(e.target.value)}
                placeholder={t("header.apiKey.inputPlaceholder")}
                className="w-full px-4 py-3 pr-20 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 font-mono transition-all"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="p-1.5 hover:bg-stone-200 rounded-lg text-stone-400 transition-colors"
                  title={showKey ? t("header.apiKey.hide") : t("header.apiKey.show")}
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                {localKey && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="p-1.5 hover:bg-stone-200 rounded-lg text-stone-400 transition-colors"
                    title={t("header.apiKey.clear")}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
            {localKey && (
              <p className="text-[10px] text-stone-400 font-mono">
                {t("header.apiKey.length", { count: localKey.length })}
              </p>
            )}
          </div>
          
          <p className="text-xs text-stone-500 leading-relaxed">
            {t("header.apiKey.notice")}
          </p>
        </div>
        
        <div className="p-4 bg-stone-50 border-t border-stone-100 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-100 rounded-xl transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-2.5 text-sm font-medium bg-stone-900 text-white rounded-xl hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
          >
            <Check size={16} />
            {t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* Mobile Bottom Navigation Bar */
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

/* Shared nav button for desktop */
function NavButton({ 
  active, 
  onClick, 
  icon, 
  label 
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: ReactNode; 
  label: string; 
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
        active
          ? "bg-white text-stone-800 shadow-sm ring-1 ring-stone-200"
          : "text-stone-500 hover:text-stone-800 hover:bg-stone-100"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/* Mobile nav button */
function MobileNavButton({ 
  active, 
  onClick, 
  icon, 
  label 
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: ReactNode; 
  label: string; 
}) {
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

const LANGUAGE_OPTIONS = [
  { value: "en", shortLabel: "EN", labelKey: "header.lang.english" },
  { value: "zh", shortLabel: "中", labelKey: "header.lang.chinese" },
] as const satisfies ReadonlyArray<{ value: Locale; shortLabel: string; labelKey: TranslationKey }>;

function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="flex flex-col items-stretch text-[10px] text-stone-400 gap-1">
      <span className="hidden md:block uppercase tracking-wide">{t("header.lang.label")}</span>
      <div className="inline-flex rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm" role="group" aria-label={t("header.lang.label")}>
        {LANGUAGE_OPTIONS.map((option) => {
          const isActive = locale === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setLocale(option.value)}
              className={`px-2.5 py-1 text-xs font-semibold transition-colors ${
                isActive ? "bg-stone-900 text-white" : "text-stone-500 hover:text-stone-900"
              }`}
              aria-pressed={isActive}
              title={t(option.labelKey)}
            >
              <span aria-hidden="true">{option.shortLabel}</span>
              <span className="sr-only">{t(option.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
