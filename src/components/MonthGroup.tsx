import React from 'react';
import { Calendar, Share2, FileDown, CheckCircle2 } from 'lucide-react';
import { Conta } from '../types';
import { AccountCard } from './AccountCard';
import { formatCurrency, compartilharMesWhatsApp, baixarPdfMes } from '../lib/utils';

interface MonthGroupProps {
  mes: string;
  contas: Conta[];
  isPrivate: boolean;
  onPay: (conta: Conta) => void;
  onUndoPay: (conta: Conta) => void;
  onEdit: (conta: Conta) => void;
  onPostpone: (conta: Conta) => void;
  onClone: (conta: Conta) => void;
  onDelete: (conta: Conta) => void;
  onCopyPix: (conta: Conta) => void;
  onShareWhatsApp: (conta: Conta) => void;
  onDownloadReceipt: (conta: Conta) => void;
}

export const MonthGroup: React.FC<MonthGroupProps> = React.memo(({
  mes,
  contas,
  isPrivate,
  onPay,
  onUndoPay,
  onEdit,
  onPostpone,
  onClone,
  onDelete,
  onCopyPix,
  onShareWhatsApp,
  onDownloadReceipt,
}) => {
  // Totais do mês
  let totalMes = 0;
  let pagoMes = 0;

  contas.forEach((c) => {
    if (c.oculta && !c.paga) return;
    totalMes += c.valor || 0;
    if (c.paga) pagoMes += c.valor || 0;
  });

  const faltaMes = totalMes - pagoMes;
  const pctPago = totalMes > 0 ? (pagoMes / totalMes) * 100 : 0;

  return (
    <div className="bg-[#0f0f1c] border border-white/10 rounded-2xl overflow-hidden shadow-lg transition-all">
      {/* Cabeçalho do Mês */}
      <div className="bg-[#151526] px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-purple-400" />
          <h3 className="font-bold text-white text-sm font-display tracking-tight">
            {mes}
          </h3>
          <span className="text-[11px] text-neutral-400 font-medium">
            ({contas.length} {contas.length === 1 ? 'conta' : 'contas'})
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => compartilharMesWhatsApp(mes, contas)}
            title="Compartilhar resumo do mês no WhatsApp"
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-emerald-500/20 text-neutral-400 hover:text-emerald-300 border border-white/10 flex items-center justify-center transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => baixarPdfMes(mes, contas)}
            title="Baixar extrato do mês em PDF"
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-purple-500/20 text-neutral-400 hover:text-purple-300 border border-white/10 flex items-center justify-center transition-colors"
          >
            <FileDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Resumo Financeiro do Mês */}
      <div className="px-4 py-3 border-b border-white/5 bg-[#121222]/50">
        <div className="grid grid-cols-3 gap-2 text-left mb-2.5">
          <div>
            <span className="text-[10px] text-neutral-400 uppercase font-semibold block">
              Total Mês
            </span>
            <span
              className={`text-sm sm:text-base font-bold text-white font-display ${
                isPrivate ? 'privacy-blur' : ''
              }`}
            >
              {formatCurrency(totalMes, isPrivate)}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-emerald-400 uppercase font-semibold block">
              Já Pago
            </span>
            <span
              className={`text-sm sm:text-base font-bold text-emerald-400 font-display ${
                isPrivate ? 'privacy-blur' : ''
              }`}
            >
              {formatCurrency(pagoMes, isPrivate)}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-red-400 uppercase font-semibold block">
              Falta Pagar
            </span>
            <span
              className={`text-sm sm:text-base font-bold text-red-400 font-display ${
                isPrivate ? 'privacy-blur' : ''
              }`}
            >
              {formatCurrency(faltaMes, isPrivate)}
            </span>
          </div>
        </div>

        {/* Barra de Progresso do Mês */}
        <div className="space-y-1">
          <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, Math.max(0, pctPago))}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-neutral-400 font-medium">
            <span>{pctPago.toFixed(0)}% concluído</span>
            {pctPago >= 100 && (
              <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                <CheckCircle2 className="w-2.5 h-2.5" /> 100% Pago!
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Lista de Contas */}
      <div className="p-3 space-y-2.5">
        {contas.map((conta) => (
          <AccountCard
            key={conta.id}
            conta={conta}
            isPrivate={isPrivate}
            onPay={onPay}
            onUndoPay={onUndoPay}
            onEdit={onEdit}
            onPostpone={onPostpone}
            onClone={onClone}
            onDelete={onDelete}
            onCopyPix={onCopyPix}
            onShareWhatsApp={onShareWhatsApp}
            onDownloadReceipt={onDownloadReceipt}
          />
        ))}
      </div>
    </div>
  );
});
