import React from 'react';
import { Plus, History, Calculator, TrendingUp, Settings } from 'lucide-react';

interface BottomNavProps {
  onOpenAdd: () => void;
  onOpenHistory: () => void;
  onOpenCalc: () => void;
  onOpenFlow: () => void;
  onOpenSettings: () => void;
  hasAppUpdate?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = React.memo(({
  onOpenAdd,
  onOpenHistory,
  onOpenCalc,
  onOpenFlow,
  onOpenSettings,
  hasAppUpdate = false,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0c0c16]/95 backdrop-blur-2xl border-t border-white/10 px-2 py-1 pb-2 sm:pb-1.5 flex justify-around items-center max-w-lg mx-auto sm:rounded-t-2xl shadow-lg touch-manipulation select-none">
      <button
        type="button"
        onClick={onOpenAdd}
        className="flex flex-col items-center gap-0.5 text-emerald-400 hover:text-emerald-300 font-semibold text-[10px] px-3 py-1 rounded-xl transition-all duration-75 active:scale-90 touch-manipulation"
      >
        <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/35 flex items-center justify-center pointer-events-none">
          <Plus className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
        </div>
        <span className="leading-none">Nova</span>
      </button>

      <button
        type="button"
        onClick={onOpenFlow}
        className="flex flex-col items-center gap-0.5 text-neutral-400 hover:text-purple-300 font-medium text-[10px] px-3 py-1 rounded-xl transition-all duration-75 active:scale-90 touch-manipulation"
      >
        <div className="w-7 h-7 rounded-lg flex items-center justify-center pointer-events-none">
          <TrendingUp className="w-4 h-4" />
        </div>
        <span className="leading-none">Fluxo</span>
      </button>

      <button
        type="button"
        onClick={onOpenHistory}
        className="flex flex-col items-center gap-0.5 text-neutral-400 hover:text-purple-300 font-medium text-[10px] px-3 py-1 rounded-xl transition-all duration-75 active:scale-90 touch-manipulation"
      >
        <div className="w-7 h-7 rounded-lg flex items-center justify-center pointer-events-none">
          <History className="w-4 h-4" />
        </div>
        <span className="leading-none">Histórico</span>
      </button>

      <button
        type="button"
        onClick={onOpenCalc}
        className="flex flex-col items-center gap-0.5 text-neutral-400 hover:text-purple-300 font-medium text-[10px] px-3 py-1 rounded-xl transition-all duration-75 active:scale-90 touch-manipulation"
      >
        <div className="w-7 h-7 rounded-lg flex items-center justify-center pointer-events-none">
          <Calculator className="w-4 h-4" />
        </div>
        <span className="leading-none">Calc</span>
      </button>

      <button
        type="button"
        onClick={onOpenSettings}
        className={`relative flex flex-col items-center gap-0.5 font-medium text-[10px] px-3 py-1 rounded-xl transition-all duration-75 active:scale-90 touch-manipulation ${
          hasAppUpdate ? 'text-emerald-400 hover:text-emerald-300 font-bold' : 'text-neutral-400 hover:text-purple-300'
        }`}
      >
        <div className="relative w-7 h-7 rounded-lg flex items-center justify-center pointer-events-none">
          <Settings className={`w-4 h-4 ${hasAppUpdate ? 'animate-spin-slow text-emerald-400' : ''}`} />
          {hasAppUpdate && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0c0c16] animate-pulse" />
          )}
        </div>
        <span className="leading-none">{hasAppUpdate ? 'Atualizar' : 'Opções'}</span>
      </button>
    </nav>
  );
});
