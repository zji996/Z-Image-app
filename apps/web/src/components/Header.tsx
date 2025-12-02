import { Sparkles, Clock } from "lucide-react";

type ViewMode = "studio" | "history";

interface HeaderProps {
  authKey: string;
  onAuthKeyChange: (value: string) => void;
  activeView: ViewMode;
  onChangeView: (view: ViewMode) => void;
}

export function Header({ authKey, onAuthKeyChange, activeView, onChangeView }: HeaderProps) {
  return (
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
            label="Studio"
          />
          <NavButton
            active={activeView === "history"}
            onClick={() => onChangeView("history")}
            icon={<Clock size={14} />}
            label="History"
          />
        </nav>
      </div>
      
      {/* Right side controls */}
      <div className="flex items-center gap-3 lg:gap-4">
        {/* Auth status indicator */}
        <div className="hidden sm:flex items-center gap-2">
          <span
            className={`inline-flex size-2 rounded-full transition-colors duration-300 ${
              authKey ? "bg-emerald-400 shadow-sm shadow-emerald-200" : "bg-stone-300"
            }`}
          />
          <span className="text-[10px] text-stone-400 uppercase tracking-wide font-medium">
            {authKey ? "Authenticated" : "Guest"}
          </span>
        </div>
        
        {/* Auth key input */}
        <input
          type="password"
          value={authKey}
          onChange={(e) => onAuthKeyChange(e.target.value)}
          placeholder="API Key"
          className="text-xs px-3 py-2 rounded-xl bg-white border border-stone-200 text-stone-600 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 font-mono transition-all shadow-sm w-24 sm:w-32 focus:w-36 sm:focus:w-44"
        />
        
        {/* Version badge - hidden on mobile */}
        <div className="hidden md:block text-[10px] text-stone-400 font-mono bg-stone-100 px-2 py-1 rounded-lg">
          v0.1.0
        </div>
      </div>
    </header>
  );
}

/* Mobile Bottom Navigation Bar */
interface MobileNavProps {
  activeView: ViewMode;
  onChangeView: (view: ViewMode) => void;
}

export function MobileNav({ activeView, onChangeView }: MobileNavProps) {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 glass border-t border-stone-200 pb-safe animate-slide-up">
      <div className="flex items-stretch h-16">
        <MobileNavButton
          active={activeView === "studio"}
          onClick={() => onChangeView("studio")}
          icon={<Sparkles size={20} />}
          label="Studio"
        />
        <MobileNavButton
          active={activeView === "history"}
          onClick={() => onChangeView("history")}
          icon={<Clock size={20} />}
          label="History"
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
  icon: React.ReactNode; 
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
  icon: React.ReactNode; 
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
