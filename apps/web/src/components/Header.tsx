type ViewMode = "studio" | "history";

interface HeaderProps {
  authKey: string;
  onAuthKeyChange: (value: string) => void;
  activeView: ViewMode;
  onChangeView: (view: ViewMode) => void;
}

export function Header({ authKey, onAuthKeyChange, activeView, onChangeView }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-50/80 backdrop-blur-md sticky top-0 z-10 transition-colors duration-300">
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-3">
          <div className="size-8 rounded-lg bg-gradient-to-br from-stone-800 to-stone-600 flex items-center justify-center text-white font-bold shadow-lg shadow-stone-200">
            Z
          </div>
          <h1 className="text-xl font-bold text-stone-800 tracking-tight">
            Z-Image
          </h1>
        </div>
        <nav className="hidden md:flex items-center space-x-2 text-xs">
          <button
            type="button"
            onClick={() => onChangeView("studio")}
            className={`px-4 py-1.5 rounded-full font-medium transition-all duration-200 ${
              activeView === "studio"
                ? "bg-white text-stone-800 shadow-sm ring-1 ring-stone-200"
                : "text-stone-500 hover:text-stone-800 hover:bg-stone-100"
            }`}
          >
            Studio
          </button>
          <button
            type="button"
            onClick={() => onChangeView("history")}
            className={`px-4 py-1.5 rounded-full font-medium transition-all duration-200 ${
              activeView === "history"
                ? "bg-white text-stone-800 shadow-sm ring-1 ring-stone-200"
                : "text-stone-500 hover:text-stone-800 hover:bg-stone-100"
            }`}
          >
            History
          </button>
        </nav>
      </div>
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <span
            className={`inline-flex h-2 w-2 rounded-full transition-colors duration-300 ${
              authKey ? "bg-emerald-400" : "bg-stone-300"
            }`}
          />
          <span className="text-[11px] text-stone-400 uppercase tracking-wide font-medium">
            {authKey ? "Authenticated" : "Guest"}
          </span>
        </div>
        <input
          type="password"
          value={authKey}
          onChange={(e) => onAuthKeyChange(e.target.value)}
          placeholder="Auth Key"
          className="text-xs px-3 py-1.5 rounded-lg bg-white border border-stone-200 text-stone-600 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 font-mono transition-all shadow-sm w-32 focus:w-48"
        />
        <div className="text-xs text-stone-400 font-mono hidden sm:block">
          v0.1.0
        </div>
      </div>
    </header>
  );
}
