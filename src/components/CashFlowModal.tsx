import React, { useState, useMemo } from 'react';
import { Calendar, Eye, EyeOff, X, ArrowRight, TrendingUp, CheckCircle2, Clock } from 'lucide-react';
import { Conta } from '../types';
import { formatCurrency, isoParaBR } from '../lib/utils';

interface CashFlowModalProps {
  isOpen: boolean;
  contas: Conta[];
  isPrivate: boolean;
  onClose: () => void;
}

export const CashFlowModal: React.FC<CashFlowModalProps> = ({
  isOpen,
  contas,
  isPrivate,
  onClose,
}) => {
  const currentMonthStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [ocultos, setOcultos] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  const [anoAlvo, mesAlvo] = selectedMonth ? selectedMonth.split('-').map(Number) : [0, 0];

  // Agrupa por dia
  const diasAgrupados = useMemo(() => {
    if (!anoAlvo || !mesAlvo) return [];

    const mapDias: { [dia: string]: { itens: Conta[] } } = {};

    contas.forEach((c) => {
      if (!c.vencimento) return;
      const dt = new Date(`${c.vencimento}T12:00:00`);
      if (dt.getFullYear() === anoAlvo && dt.getMonth() + 1 === mesAlvo) {
        const diaStr = dt.getDate().toString().padStart(2, '0');
        if (!mapDias[diaStr]) {
          mapDias[diaStr] = { itens: [] };
        }
        mapDias[diaStr].itens.push(c);
      }
    });

    const chaves = Object.keys(mapDias).sort((a, b) => Number(a) - Number(b));

    return chaves.map((dia) => {
      const itens = mapDias[dia].itens;
      let totalDia = 0;
      let pagoDia = 0;

      itens.forEach((it) => {
        const uid = String(it.id);
        if (!ocultos.has(uid)) {
          totalDia += it.valor || 0;
          if (it.paga) pagoDia += it.valor || 0;
        }
      });

      return {
        dia,
        itens,
        totalDia,
        pagoDia,
        pendenteDia: totalDia - pagoDia,
      };
    });
  }, [contas, anoAlvo, mesAlvo, ocultos]);

  const toggleOcultar = (uid: string) => {
    setOcultos((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const totalMesGeral = diasAgrupados.reduce((acc, d) => acc + d.totalDia, 0);
  const totalMesPago = diasAgrupados.reduce((acc, d) => acc + d.pagoDia, 0);
  const totalMesFalta = diasAgrupados.reduce((acc, d) => acc + d.pendenteDia, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#13131f] border border-purple-500/20 rounded-2xl p-6 shadow-2xl max-h-[90vh] flex flex-col text-left">
        {/* Topo */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-display">Fluxo do App</h3>
              <p className="text-xs text-neutral-400">Previsão diária de vencimentos e pagamentos</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Seletor de Mês & Totais rápidos */}
        <div className="py-4 border-b border-white/10 space-y-3 shrink-0">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-neutral-400 uppercase shrink-0">
              Mês Alvo:
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="flex-1 px-3 py-2 bg-white/5 border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500 font-semibold"
            />
          </div>

          <div className="grid grid-cols-3 gap-2 bg-[#181828] p-3 rounded-xl border border-white/5 text-center">
            <div>
              <span className="text-[10px] text-neutral-400 uppercase font-semibold block">Total Mês</span>
              <span className="text-xs sm:text-sm font-bold text-white font-display">
                {formatCurrency(totalMesGeral, isPrivate)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-emerald-400 uppercase font-semibold block">Já Pago</span>
              <span className="text-xs sm:text-sm font-bold text-emerald-400 font-display">
                {formatCurrency(totalMesPago, isPrivate)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-red-400 uppercase font-semibold block">Restante</span>
              <span className="text-xs sm:text-sm font-bold text-red-400 font-display">
                {formatCurrency(totalMesFalta, isPrivate)}
              </span>
            </div>
          </div>
        </div>

        {/* Lista de dias */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
          {diasAgrupados.length === 0 ? (
            <div className="text-center py-12 text-neutral-400 text-xs">
              Nenhuma conta agendada para este mês selecionado.
            </div>
          ) : (
            diasAgrupados.map((diaInfo) => (
              <div
                key={diaInfo.dia}
                className="bg-[#181828] border border-white/10 rounded-xl p-3.5 space-y-2.5"
              >
                {/* Header do dia */}
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-xs font-bold text-purple-300 font-display flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Dia {diaInfo.dia}/{mesAlvo.toString().padStart(2, '0')}
                  </span>
                  <span className="text-xs font-bold text-white font-mono">
                    {formatCurrency(diaInfo.totalDia, isPrivate)}
                  </span>
                </div>

                {/* Itens do dia */}
                <div className="space-y-1.5">
                  {diaInfo.itens.map((it) => {
                    const uid = String(it.id);
                    const isOculto = ocultos.has(uid);

                    return (
                      <div
                        key={uid}
                        className={`flex items-center justify-between py-1.5 px-2 rounded-lg text-xs transition-opacity ${
                          isOculto ? 'opacity-40 line-through bg-black/20' : 'hover:bg-white/5'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-medium text-white truncate flex items-center gap-1.5">
                            <span>{it.nome}</span>
                            {it.pagador && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300">
                                {it.pagador}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-neutral-400 flex items-center gap-1">
                            {it.paga ? (
                              <span className="text-emerald-400">✓ Pago</span>
                            ) : (
                              <span className="text-amber-400">⏳ Pendente</span>
                            )}
                            {it.totalParcelas && ` (${it.parcelaAtual}/${it.totalParcelas})`}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`font-semibold font-mono ${
                              it.paga ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {formatCurrency(it.valor, isPrivate)}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleOcultar(uid)}
                            title={isOculto ? 'Restaurar no fluxo' : 'Ocultar temporariamente'}
                            className="p-1 rounded bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white"
                          >
                            {isOculto ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Badges do dia */}
                <div className="flex items-center gap-2 pt-1 border-t border-white/5 text-[10px]">
                  {diaInfo.pagoDia > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-medium">
                      ✓ Pago {formatCurrency(diaInfo.pagoDia, isPrivate)}
                    </span>
                  )}
                  {diaInfo.pendenteDia > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 font-medium">
                      ⏳ Falta {formatCurrency(diaInfo.pendenteDia, isPrivate)}
                    </span>
                  )}
                </div>
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
            Fechar Fluxo
          </button>
        </div>
      </div>
    </div>
  );
};
