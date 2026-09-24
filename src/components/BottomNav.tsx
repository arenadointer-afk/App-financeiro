import React from 'react';
import { Plus, History, Calculator, TrendingUp, Settings } from 'lucide-react';

interface BottomNavProps {
  onOpenAdd: () => void;
  onOpenHistory: () => void;
  onOpenCalc: () => void;
  onOpenFlow: () => void;
  onOpenSettings: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = React.memo(({
  onOpenAdd,
  onOpenHistory,
  onOpenCalc,
  onOpenFlow,
  onOpenSettings,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0c0c16]/95 backdrop-blur-2xl border-t border-white/10 px-3 py-2 pb-5 sm:pb-3 flex justify-around items-center max-w-lg mx-auto sm:rounded-t-2xl touch-manipulation select-none">
      <button
        type="button"
        onClick={onOpenAdd}
        className="flex flex-col items-center gap-1 text-emerald-400 hover:text-emerald-300 font-semibold text-[11px] p-1.5 transition-transform duration-75 active:scale-90 touch-manipulation"
      >
        <div className="w-10 h-10 rounded-xl bg-emerald-600/25 border border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-600/20 pointer-events-none">
          <Plus className="w-5 h-5 text-emerald-400" />
        </div>
        <span>Nova</span>
      </button>

      <button
        type="button"
        onClick={onOpenFlow}
        className="flex flex-col items-center gap-1 text-neutral-400 hover:text-purple-300 font-medium text-[11px] p-1.5 transition-transform duration-75 active:scale-90 touch-manipulation"
      >
        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center pointer-events-none">
          <TrendingUp className="w-5 h-5" />
        </div>
        <span>Fluxo</span>
      </button>

      <button
        type="button"
        onClick={onOpenHistory}
        className="flex flex-col items-center gap-1 text-neutral-400 hover:text-purple-300 font-medium text-[11px] p-1.5 transition-transform duration-75 active:scale-90 touch-manipulation"
      >
        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center pointer-events-none">
          <History className="w-5 h-5" />
        </div>
        <span>Histórico</span>
      </button>

      <button
        type="button"
        onClick={onOpenCalc}
        className="flex flex-col items-center gap-1 text-neutral-400 hover:text-purple-300 font-medium text-[11px] p-1.5 transition-transform duration-75 active:scale-90 touch-manipulation"
      >
        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center pointer-events-none">
          <Calculator className="w-5 h-5" />
        </div>
        <span>Calc</span>
      </button>

      <button
        type="button"
        onClick={onOpenSettings}
        className="flex flex-col items-center gap-1 text-neutral-400 hover:text-purple-300 font-medium text-[11px] p-1.5 transition-transform duration-75 active:scale-90 touch-manipulation"
      >
        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center pointer-events-none">
          <Settings className="w-5 h-5" />
        </div>
        <span>Opções</span>
      </button>
    </nav>
  );
});
