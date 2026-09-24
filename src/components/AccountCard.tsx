import React, { useState } from 'react';
import {
  CheckCircle2,
  Undo2,
  ChevronDown,
  ChevronUp,
  QrCode,
  Edit2,
  CalendarPlus,
  Copy,
  FileText,
  Share2,
  Trash2,
  Clock,
  AlertTriangle,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { Conta } from '../types';
import { formatCurrency, isoParaBR, getInfoVencimento } from '../lib/utils';

interface AccountCardProps {
  conta: Conta;
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

export const AccountCard: React.FC<AccountCardProps> = React.memo(({
  conta,
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
  const [expanded, setExpanded] = useState(false);
  const vencInfo = getInfoVencimento(conta.vencimento);

  // Ícone intuitivo por nome da conta
  const getCategoryIcon = (nome: string) => {
    const n = nome.toLowerCase();
    if (n.includes('luz') || n.includes('energia') || n.includes('enel') || n.includes('cemig')) return '⚡';
    if (n.includes('agua') || n.includes('água') || n.includes('sabesp') || n.includes('copasa')) return '💧';
    if (n.includes('net') || n.includes('wifi') || n.includes('internet') || n.includes('claro') || n.includes('vivo')) return '🌐';
    if (n.includes('card') || n.includes('cartao') || n.includes('cartão') || n.includes('nubank') || n.includes('fatura') || n.includes('inter')) return '💳';
    if (n.includes('aluguel') || n.includes('condomínio') || n.includes('condominio') || n.includes('casa')) return '🏠';
    if (n.includes('mercado') || n.includes('compra') || n.includes('supermercado')) return '🛒';
    if (n.includes('carro') || n.includes('moto') || n.includes('gasolina') || n.includes('combustivel')) return '🚗';
    return '📄';
  };

  return (
    <div
      className={`border rounded-2xl p-4 transition-all ${
        conta.paga
          ? 'bg-[#10101c]/60 border-white/5 opacity-70 hover:opacity-100'
          : vencInfo.classe === 'vencido'
          ? 'bg-red-500/5 border-red-500/30 shadow-sm'
          : vencInfo.classe === 'hoje'
          ? 'bg-amber-500/5 border-amber-500/30'
          : 'bg-[#141422] border-white/10 hover:border-white/20'
      }`}
    >
      {/* Topo do Card */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <span className="text-xl shrink-0 p-1.5 bg-white/5 rounded-xl border border-white/10">
            {getCategoryIcon(conta.nome)}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4
                className={`font-semibold text-sm truncate ${
                  conta.paga ? 'line-through text-neutral-400' : 'text-white'
                }`}
              >
                {conta.nome}
              </h4>
              {conta.pagador && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
                  {conta.pagador}
                </span>
              )}
            </div>
            <div className="text-[11px] text-neutral-400 mt-0.5 flex items-center gap-2 flex-wrap">
              <span>🗓 {isoParaBR(conta.vencimento)}</span>
              {conta.totalParcelas && conta.totalParcelas > 0 ? (
                <span className="text-purple-400 font-medium">
                  🔢 {conta.parcelaAtual || 1}/{conta.totalParcelas}
                </span>
              ) : conta.recorrente ? (
                <span className="text-emerald-400 font-medium flex items-center gap-0.5">
                  <RefreshCw className="w-3 h-3" /> Fixa
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div>
          {conta.paga ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3" /> PAGO
            </span>
          ) : vencInfo.classe === 'vencido' ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse">
              <AlertTriangle className="w-3 h-3" /> VENCIDO
            </span>
          ) : vencInfo.classe === 'hoje' ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
              <Clock className="w-3 h-3" /> HOJE
            </span>
          ) : (
            <span className="text-[10px] font-medium text-neutral-400 px-2 py-0.5 rounded-full bg-white/5">
              {vencInfo.texto}
            </span>
          )}
        </div>
      </div>

      {/* Valor */}
      <div className="mt-3 flex items-baseline justify-between">
        <div>
          <span className="text-xs text-neutral-400 block font-medium">Valor</span>
          <span
            className={`text-xl font-bold font-display tracking-tight ${
              isPrivate ? 'privacy-blur' : 'text-white'
            }`}
          >
            {formatCurrency(conta.valor, isPrivate)}
          </span>
        </div>

        {conta.valorTotalOriginal && conta.totalParcelas && conta.totalParcelas > 0 && (
          <div className="text-right text-[11px] text-neutral-400">
            <span>Total da compra: </span>
            <span className={`font-semibold text-neutral-300 ${isPrivate ? 'privacy-blur' : ''}`}>
              {formatCurrency(conta.valorTotalOriginal, isPrivate)}
            </span>
          </div>
        )}
      </div>

      {/* Ações Primárias */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/5 touch-manipulation select-none">
        {!conta.paga ? (
          <button
            type="button"
            onClick={() => onPay(conta)}
            className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.97] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/25 transition-transform duration-75 touch-manipulation"
          >
            <CheckCircle2 className="w-4 h-4 pointer-events-none" />
            PAGAR
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onUndoPay(conta)}
            className="flex-1 py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.97] text-neutral-300 font-medium text-xs flex items-center justify-center gap-1.5 border border-white/10 transition-transform duration-75 touch-manipulation"
          >
            <Undo2 className="w-4 h-4 pointer-events-none" />
            DESFAZER
          </button>
        )}

        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className={`w-10 h-9 rounded-xl flex items-center justify-center transition-transform duration-75 active:scale-95 border touch-manipulation ${
            expanded
              ? 'bg-purple-600/30 text-purple-300 border-purple-500/40'
              : 'bg-white/5 hover:bg-white/10 text-neutral-400 border-white/10'
          }`}
          title="Mais opções"
        >
          {expanded ? <ChevronUp className="w-4 h-4 pointer-events-none" /> : <ChevronDown className="w-4 h-4 pointer-events-none" />}
        </button>
      </div>

      {/* Menu Secundário Expansível */}
      {expanded && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-3 pt-3 border-t border-white/10 text-xs animate-in slide-in-from-top-2 duration-100 touch-manipulation select-none">
          <button
            type="button"
            onClick={() => onCopyPix(conta)}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/20 active:scale-95 text-neutral-300 flex items-center justify-center gap-1.5 transition-transform duration-75 border border-white/5 touch-manipulation"
          >
            <QrCode className="w-3.5 h-3.5 text-purple-400 pointer-events-none" />
            Pix
          </button>

          <button
            type="button"
            onClick={() => onEdit(conta)}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/20 active:scale-95 text-neutral-300 flex items-center justify-center gap-1.5 transition-transform duration-75 border border-white/5 touch-manipulation"
          >
            <Edit2 className="w-3.5 h-3.5 text-blue-400 pointer-events-none" />
            Editar
          </button>

          <button
            type="button"
            onClick={() => onPostpone(conta)}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/20 active:scale-95 text-neutral-300 flex items-center justify-center gap-1.5 transition-transform duration-75 border border-white/5 touch-manipulation"
          >
            <CalendarPlus className="w-3.5 h-3.5 text-amber-400 pointer-events-none" />
            Adiar +1 Mês
          </button>

          <button
            type="button"
            onClick={() => onClone(conta)}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/20 active:scale-95 text-neutral-300 flex items-center justify-center gap-1.5 transition-transform duration-75 border border-white/5 touch-manipulation"
          >
            <Copy className="w-3.5 h-3.5 text-emerald-400 pointer-events-none" />
            Clonar
          </button>

          <button
            type="button"
            onClick={() => onDownloadReceipt(conta)}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/20 active:scale-95 text-neutral-300 flex items-center justify-center gap-1.5 transition-transform duration-75 border border-white/5 touch-manipulation"
          >
            <FileText className="w-3.5 h-3.5 text-cyan-400 pointer-events-none" />
            Recibo PDF
          </button>

          <button
            type="button"
            onClick={() => onShareWhatsApp(conta)}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/20 active:scale-95 text-neutral-300 flex items-center justify-center gap-1.5 transition-transform duration-75 border border-white/5 touch-manipulation"
          >
            <Share2 className="w-3.5 h-3.5 text-green-400 pointer-events-none" />
            WhatsApp
          </button>

          <button
            type="button"
            onClick={() => onDelete(conta)}
            className="col-span-2 p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 active:scale-95 text-red-400 flex items-center justify-center gap-1.5 transition-transform duration-75 border border-red-500/20 touch-manipulation"
          >
            <Trash2 className="w-3.5 h-3.5 pointer-events-none" />
            Excluir Conta
          </button>
        </div>
      )}
    </div>
  );
});
