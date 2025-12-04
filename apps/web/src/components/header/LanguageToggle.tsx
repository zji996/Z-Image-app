import { useI18n } from "../../i18n";
import type { Locale, TranslationKey } from "../../i18n/translations";

const LANGUAGE_OPTIONS = [
  { value: "en", shortLabel: "EN", labelKey: "header.lang.english" },
  { value: "zh", shortLabel: "中", labelKey: "header.lang.chinese" },
] as const satisfies ReadonlyArray<{ value: Locale; shortLabel: string; labelKey: TranslationKey }>;

export function LanguageToggle() {
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

