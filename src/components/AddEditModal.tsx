import React, { useState, useEffect } from 'react';
import { X, Calendar, DollarSign, User, RefreshCw, Layers, QrCode, Tag } from 'lucide-react';
import { Conta } from '../types';

interface AddEditModalProps {
  isOpen: boolean;
  contaToEdit?: Conta | null;
  onSave: (contaData: Partial<Conta>) => void;
  onClose: () => void;
}

export const AddEditModal: React.FC<AddEditModalProps> = ({
  isOpen,
  contaToEdit,
  onSave,
  onClose,
}) => {
  const [nome, setNome] = useState('');
  const [valorTotal, setValorTotal] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [pagador, setPagador] = useState('Leonardo');
  const [customPagador, setCustomPagador] = useState('');
  const [isRecorrente, setIsRecorrente] = useState(false);
  const [qtdParcelas, setQtdParcelas] = useState('');
  const [codigoPix, setCodigoPix] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (contaToEdit) {
        setNome(contaToEdit.nome || '');
        setValorTotal(
          (contaToEdit.valorTotalOriginal || contaToEdit.valor).toString()
        );
        setVencimento(contaToEdit.vencimento || new Date().toISOString().split('T')[0]);
        if (contaToEdit.pagador === 'Leonardo' || contaToEdit.pagador === 'Vitórya') {
          setPagador(contaToEdit.pagador);
          setCustomPagador('');
        } else if (contaToEdit.pagador) {
          setPagador('Outro');
          setCustomPagador(contaToEdit.pagador);
        } else {
          setPagador('Leonardo');
          setCustomPagador('');
        }
        setIsRecorrente(!!contaToEdit.recorrente || !!(contaToEdit.totalParcelas && contaToEdit.totalParcelas > 0));
        setQtdParcelas(contaToEdit.totalParcelas ? contaToEdit.totalParcelas.toString() : '');
        setCodigoPix(contaToEdit.codigoPix || '');
      } else {
        setNome('');
        setValorTotal('');
        setVencimento(new Date().toISOString().split('T')[0]);
        setPagador('Leonardo');
        setCustomPagador('');
        setIsRecorrente(false);
        setQtdParcelas('');
        setCodigoPix('');
      }
    }
  }, [isOpen, contaToEdit]);

  if (!isOpen) return null;

  const totalNum = parseFloat(valorTotal.replace(',', '.')) || 0;
  const qtdNum = parseInt(qtdParcelas, 10) || 0;

  // Cálculo da prévia de parcelamento
  let previaTexto = '';
  let valorFinalCalculado = totalNum;

  if (isRecorrente) {
    if (qtdNum > 0 && totalNum > 0) {
      valorFinalCalculado = totalNum / qtdNum;
      previaTexto = `Ficam ${qtdNum}x de R$ ${valorFinalCalculado.toFixed(2)}`;
    } else if (qtdNum === 0 && totalNum > 0) {
      previaTexto = `Valor fixo todo mês: R$ ${totalNum.toFixed(2)}`;
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      alert('Por favor, informe a descrição da conta.');
      return;
    }
    if (isNaN(totalNum) || totalNum <= 0) {
      alert('Por favor, informe um valor válido.');
      return;
    }
    if (!vencimento) {
      alert('Informe a data de vencimento.');
      return;
    }

    const pagadorFinal = pagador === 'Outro' ? (customPagador.trim() || 'Outro') : pagador;

    onSave({
      nome: nome.trim(),
      valor: isRecorrente && qtdNum > 0 ? valorFinalCalculado : totalNum,
      valorTotalOriginal: isRecorrente && qtdNum > 0 ? totalNum : null,
      vencimento,
      pagador: pagadorFinal,
      recorrente: isRecorrente,
      totalParcelas: isRecorrente && qtdNum > 0 ? qtdNum : null,
      parcelaAtual: contaToEdit?.parcelaAtual ?? (isRecorrente && qtdNum > 0 ? 1 : null),
      codigoPix: codigoPix.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#13131f] border border-white/10 rounded-2xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
          <h2 className="text-lg font-bold text-white font-display flex items-center gap-2">
            {contaToEdit ? '✏️ Editar Conta' : '➕ Nova Conta'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {/* Nome da conta */}
          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
              Nome ou Descrição
            </label>
            <input
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Tênis Nike, Fatura Cartão, Energia"
              className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50"
            />
          </div>

          {/* Valor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                Valor Total (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 font-mono text-sm">
                  R$
                </span>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={valorTotal}
                  onChange={(e) => setValorTotal(e.target.value)}
                  placeholder="0,00"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm font-semibold text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50"
                />
              </div>
            </div>

            {/* Vencimento */}
            <div>
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                Vencimento
              </label>
              <input
                type="date"
                required
                value={vencimento}
                onChange={(e) => setVencimento(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50"
              />
            </div>
          </div>

          {/* Pagador */}
          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
              Quem vai pagar?
            </label>
            <div className="flex gap-2 touch-manipulation select-none">
              {['Leonardo', 'Vitórya', 'Outro'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPagador(p)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-transform duration-75 active:scale-95 touch-manipulation ${
                    pagador === p
                      ? 'bg-purple-600/30 border-purple-500 text-purple-200 font-semibold'
                      : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            {pagador === 'Outro' && (
              <input
                type="text"
                value={customPagador}
                onChange={(e) => setCustomPagador(e.target.value)}
                placeholder="Digite o nome do pagador"
                className="w-full mt-2 px-3.5 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
              />
            )}
          </div>

          {/* Box de Parcelamento / Recorrência */}
          <div className="bg-[#1a1a2a] border border-white/10 rounded-xl p-3.5 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isRecorrente}
                onChange={(e) => setIsRecorrente(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-purple-600 focus:ring-purple-500 focus:ring-offset-0"
              />
              <span className="text-xs font-medium text-white flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
                É compra parcelada ou conta fixa mensal?
              </span>
            </label>

            {isRecorrente && (
              <div className="pt-2 border-t border-white/10 space-y-2">
                <div>
                  <label className="block text-[11px] text-neutral-400 mb-1">
                    Número de parcelas (deixe 0 para conta fixa todo mês)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={qtdParcelas}
                    onChange={(e) => setQtdParcelas(e.target.value)}
                    placeholder="Ex: 10 (ou 0 para recorrente)"
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                {previaTexto && (
                  <div className="p-2 bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs font-semibold text-center">
                    ✨ {previaTexto}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Código Pix opcional */}
          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <QrCode className="w-3.5 h-3.5 text-neutral-400" />
              Código Pix Copia e Cola (Opcional)
            </label>
            <input
              type="text"
              value={codigoPix}
              onChange={(e) => setCodigoPix(e.target.value)}
              placeholder="Cole a chave Pix ou código Copia e Cola"
              className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-neutral-500 font-mono focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Botões */}
          <div className="flex gap-2 pt-2 touch-manipulation select-none">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-white/5 hover:bg-white/10 active:bg-white/20 active:scale-95 text-neutral-300 text-sm font-semibold rounded-xl border border-white/10 transition-transform duration-75 touch-manipulation"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-600/30 transition-transform duration-75 touch-manipulation"
            >
              Salvar Conta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
