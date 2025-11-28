export function Header() {
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
      <div className="text-xs text-slate-500 font-mono">
        v0.1.0-beta
      </div>
    </header>
  );
}
