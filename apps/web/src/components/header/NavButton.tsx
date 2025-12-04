import type { ReactNode } from "react";

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}

export function NavButton({ active, onClick, icon, label }: NavButtonProps) {
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

