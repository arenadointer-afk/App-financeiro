import React, { useState } from 'react';
import { CheckCircle2, Split, ArrowRight, X, AlertCircle } from 'lucide-react';
import { Conta } from '../types';
import { formatCurrency, isoParaBR } from '../lib/utils';

interface PaymentModalProps {
  isOpen: boolean;
  conta: Conta | null;
  onPayFull: (conta: Conta) => void;
  onPayPartial: (conta: Conta, valorPago: number, jogarRestanteProximoMes: boolean) => void;
  onClose: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  conta,
  onPayFull,
  onPayPartial,
  onClose,
}) => {
  const [tipoPagamento, setTipoPagamento] = useState<'total' | 'parcial'>('total');
  const [valorParcial, setValorParcial] = useState('');
  const [jogarProximoMes, setJogarProximoMes] = useState(true);

  if (!isOpen || !conta) return null;

  const valorPagoNum = parseFloat(valorParcial.replace(',', '.')) || 0;
  const restante = Math.max(0, conta.valor - valorPagoNum);

  const handleConfirm = () => {
    if (tipoPagamento === 'total') {
      onPayFull(conta);
      onClose();
    } else {
      if (isNaN(valorPagoNum) || valorPagoNum <= 0) {
        alert('Informe um valor parcial válido.');
        return;
      }
      if (valorPagoNum >= conta.valor) {
        // Se pagou tudo ou mais, é total
        onPayFull(conta);
        onClose();
        return;
      }
      onPayPartial(conta, valorPagoNum, jogarProximoMes);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-[#13131f] border border-emerald-500/20 rounded-2xl p-6 shadow-2xl text-left">
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-display">Registrar Pagamento</h3>
              <p className="text-[11px] text-neutral-400 truncate max-w-[200px]">{conta.nome}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 bg-white/5 rounded-xl border border-white/10 mb-4">
          <div className="text-xs text-neutral-400">Valor da parcela / conta</div>
          <div className="text-2xl font-bold font-display text-white mt-0.5">
            {formatCurrency(conta.valor)}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            Vencimento: {isoParaBR(conta.vencimento)}
            {conta.totalParcelas && ` • Parcela ${conta.parcelaAtual || 1} de ${conta.totalParcelas}`}
          </div>
        </div>

        {/* Seleção do Tipo */}
        <div className="grid grid-cols-2 gap-2 mb-4 touch-manipulation select-none">
          <button
            type="button"
            onClick={() => setTipoPagamento('total')}
            className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-transform duration-75 active:scale-95 touch-manipulation ${
              tipoPagamento === 'total'
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 pointer-events-none" />
            Pagar Mês Atual
          </button>

          <button
            type="button"
            onClick={() => setTipoPagamento('parcial')}
            className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-transform duration-75 active:scale-95 touch-manipulation ${
              tipoPagamento === 'parcial'
                ? 'bg-purple-500/20 border-purple-500 text-purple-300 shadow-sm'
                : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
            }`}
          >
            <Split className="w-4 h-4 pointer-events-none" />
            Pagamento Parcial
          </button>
        </div>

        {/* Se for pagamento parcial */}
        {tipoPagamento === 'parcial' && (
          <div className="space-y-3 p-3.5 bg-black/40 border border-white/10 rounded-xl mb-4 text-xs">
            <div>
              <label className="block text-neutral-400 mb-1 font-medium">
                Quanto foi pago hoje? (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={valorParcial}
                onChange={(e) => setValorParcial(e.target.value)}
                placeholder="Ex: 50.00"
                autoFocus
                className="w-full px-3 py-2 bg-white/5 border border-white/15 rounded-lg text-sm text-white font-semibold focus:outline-none focus:border-purple-500"
              />
            </div>

            {valorPagoNum > 0 && valorPagoNum < conta.valor && (
              <div className="text-neutral-300 flex justify-between items-center py-1">
                <span>Restante a pagar:</span>
                <span className="font-bold text-red-400">{formatCurrency(restante)}</span>
              </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer pt-1 text-neutral-300">
              <input
                type="checkbox"
                checked={jogarProximoMes}
                onChange={(e) => setJogarProximoMes(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-purple-600 focus:ring-purple-500"
              />
              <span>Transferir o restante para o próximo mês?</span>
            </label>
          </div>
        )}

        <div className="flex gap-2 touch-manipulation select-none">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 active:bg-white/20 active:scale-95 text-neutral-400 text-xs font-semibold rounded-xl border border-white/10 transition-transform duration-75 touch-manipulation"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/30 transition-transform duration-75 touch-manipulation"
          >
            Confirmar Pagamento
          </button>
        </div>
      </div>
    </div>
  );
};
