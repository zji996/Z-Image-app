interface HeaderProps {
  authKey: string;
  onAuthKeyChange: (value: string) => void;
}

export function Header({ authKey, onAuthKeyChange }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="flex items-center space-x-3">
        <div className="size-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-white font-bold shadow-lg shadow-cyan-500/20">
          Z
        </div>
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-100 to-slate-400">
          Z-Image App
        </h1>
      </div>
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <span
            className={`inline-flex h-2 w-2 rounded-full ${
              authKey ? "bg-emerald-400" : "bg-slate-500"
            }`}
          />
          <span className="text-[11px] text-slate-400 uppercase tracking-wide">
            {authKey ? "Authenticated" : "Guest"}
          </span>
        </div>
        <input
          type="password"
          value={authKey}
          onChange={(e) => onAuthKeyChange(e.target.value)}
          placeholder="Auth Key (optional)"
          className="text-xs px-3 py-1.5 rounded-md bg-slate-900 border border-slate-700 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/60 focus:border-cyan-500/60 font-mono"
        />
        <div className="text-xs text-slate-500 font-mono">
          v0.1.0-beta
        </div>
      </div>
    </header>
  );
}
