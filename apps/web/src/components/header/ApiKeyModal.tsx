import { useState, useRef, useEffect } from "react";
import { Key, X, Eye, EyeOff, Check } from "lucide-react";
import { useI18n } from "../../i18n";

interface ApiKeyModalProps {
  authKey: string;
  onAuthKeyChange: (value: string) => void;
  onClose: () => void;
}

export function ApiKeyModal({ authKey, onAuthKeyChange, onClose }: ApiKeyModalProps) {
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
    <div className="fixed inset-0 z-50 flex items-start lg:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm animate-backdrop-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative mx-4 mt-20 lg:mt-0 w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-modal-in ring-1 ring-black/5">
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

