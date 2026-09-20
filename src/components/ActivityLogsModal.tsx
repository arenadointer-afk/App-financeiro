import React from 'react';
import { History, X, Undo2, Trash2 } from 'lucide-react';
import { LogAtividade } from '../types';

interface ActivityLogsModalProps {
  isOpen: boolean;
  logs: LogAtividade[];
  onUndo: (log: LogAtividade) => void;
  onClear: (mode: 'hoje' | 'mes' | 'tudo') => void;
  onClose: () => void;
}

export const ActivityLogsModal: React.FC<ActivityLogsModalProps> = ({
  isOpen,
  logs,
  onUndo,
  onClear,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#13131f] border border-white/10 rounded-2xl p-6 shadow-2xl max-h-[90vh] flex flex-col text-left">
        {/* Topo */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-600/20 text-purple-400 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-display">Histórico de Atividades</h3>
              <p className="text-xs text-neutral-400">Auditoria completa com opção de desfazer</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Botões de limpeza */}
        <div className="flex gap-2 py-3 border-b border-white/10 shrink-0 text-xs">
          <button
            onClick={() => onClear('hoje')}
            className="flex-1 py-1.5 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 font-medium border border-white/10 transition-colors"
          >
            Limpar Hoje
          </button>
          <button
            onClick={() => onClear('mes')}
            className="flex-1 py-1.5 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 font-medium border border-white/10 transition-colors"
          >
            Limpar Mês
          </button>
          <button
            onClick={() => onClear('tudo')}
            className="flex-1 py-1.5 px-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium border border-red-500/20 transition-colors flex items-center justify-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
            Limpar Tudo
          </button>
        </div>

        {/* Lista de logs */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2 pr-1">
          {logs.length === 0 ? (
            <div className="text-center py-12 text-neutral-400 text-xs">
              Nenhuma atividade registrada até o momento.
            </div>
          ) : (
            logs.map((l) => (
              <div
                key={l.id}
                className="bg-[#181828] border-l-2 border-l-purple-500 border border-white/5 rounded-xl p-3 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-300 font-display uppercase tracking-wide">
                    {l.acao}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-neutral-500">
                      {new Date(l.data).toLocaleString('pt-BR')}
                    </span>
                    {l.backup && (
                      <button
                        onClick={() => onUndo(l)}
                        title="Desfazer esta ação e restaurar a conta"
                        className="px-2 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-[10px] font-bold flex items-center gap-1 transition-colors border border-purple-500/30"
                      >
                        <Undo2 className="w-3 h-3" />
                        Desfazer
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-neutral-300">{l.detalhe}</div>
              </div>
            ))
          )}
        </div>

        {/* Rodapé */}
        <div className="pt-3 border-t border-white/10 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-semibold rounded-xl border border-white/10 transition-colors"
          >
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
};
