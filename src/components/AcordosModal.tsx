import React, { useState, useMemo } from 'react';
import {
  Handshake,
  Plus,
  X,
  CheckCircle2,
  Trash2,
  Sparkles,
  Calendar,
  AlertCircle,
  Building2,
  RotateCcw,
  Check,
  Pencil,
  Copy,
  MessageCircle,
  MoreHorizontal
} from 'lucide-react';
import { DividaLimpaNome } from '../types';
import { formatCurrency } from '../lib/utils';

interface AcordosModalProps {
  isOpen: boolean;
  onClose: () => void;
  dividas: DividaLimpaNome[];
  onSaveDivida: (divida: DividaLimpaNome) => void;
  onDeleteDivida: (id: string) => void;
  onPayDivida: (id: string) => void;
  onUndoDivida: (id: string) => void;
}

const mesesNomes: { [k: string]: string } = {
  '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
  '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
  '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
};

export const AcordosModal: React.FC<AcordosModalProps> = ({
  isOpen,
  onClose,
  dividas,
  onSaveDivida,
  onDeleteDivida,
  onPayDivida,
  onUndoDivida,
}) => {
  const [filtro, setFiltro] = useState<'pendentes' | 'quitados' | 'todos'>('todos');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDividaId, setEditingDividaId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form states
  const [nome, setNome] = useState('');
  const [valorOriginal, setValorOriginal] = useState('');
  const [valorTotal, setValorTotal] = useState('');
  const [vencimento, setVencimento] = useState(() => new Date().toISOString().split('T')[0]);
  const [parcelado, setParcelado] = useState(true);
  const [totalParcelas, setTotalParcelas] = useState('12');
  const [formError, setFormError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Resumo Geral Financeiro
  const stats = useMemo(() => {
    let totalFechado = 0;
    let totalPago = 0;
    let totalOriginal = 0;
    let qtdPendentes = 0;
    let qtdQuitados = 0;

    dividas.forEach((d) => {
      totalFechado += d.valor || 0;
      if (d.paga) {
        totalPago += d.valor || 0;
        qtdQuitados++;
      } else {
        qtdPendentes++;
      }

      if (d.valorOriginalDica && d.valorOriginalDica > (d.valorTotalOriginal || d.valor)) {
        totalOriginal += d.valorOriginalDica;
      } else {
        totalOriginal += d.valorTotalOriginal || d.valor;
      }
    });

    const restantePagar = Math.max(0, totalFechado - totalPago);
    const totalEconomizado = totalOriginal > totalFechado ? totalOriginal - totalFechado : 0;
    const percDescontoMedio = totalOriginal > 0 && totalEconomizado > 0
      ? Math.round((totalEconomizado / totalOriginal) * 100)
      : 0;

    return {
      totalFechado,
      totalPago,
      restantePagar,
      totalEconomizado,
      percDescontoMedio,
      qtdPendentes,
      qtdQuitados,
    };
  }, [dividas]);

  // Agrupamento por Mês com Datas Precisas:
  // 1) Sempre o mês atual em primeiro lugar, seguido pelos meses mais próximos
  // 2) Cada dívida só mostra o próximo mês quando a parcela atual dela for paga!
  const gruposMeses = useMemo(() => {
    const hoje = new Date();
    const mesAtualChave = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

    const normalizarData = (v: string) => {
      let venc = String(v || '').trim();
      if (!venc) return new Date().toISOString().split('T')[0];
      if (venc.includes('/')) {
        const p = venc.split('/');
        if (p.length === 3) return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
      }
      return venc;
    };

    // Ordenação estritamente cronológica por vencimento e número da parcela
    const ordenadas = [...dividas]
      .map((d) => ({ ...d, vencimento: normalizarData(d.vencimento) }))
      .sort((a, b) => {
        const tA = new Date((a.vencimento || '9999-12-31') + 'T12:00:00').getTime();
        const tB = new Date((b.vencimento || '9999-12-31') + 'T12:00:00').getTime();
        if (tA !== tB) return tA - tB;
        return (a.parcelaAtual || 1) - (b.parcelaAtual || 1);
      });

    // Regra solicitada: "a dívida só mostre o próximo mês quando pagar a parcela atual dela"
    // Se houver mais de uma parcela pendente da mesma dívida/credor, exibe apenas a parcela pendente atual (a mais próxima/menor parcela)
    const credorJaTemPendenteVisivel = new Set<string>();
    const dividasComControleDeParcela = ordenadas.filter((d) => {
      if (d.paga) return true; // Parcelas já pagas permanecem no histórico de seus meses
      const chaveCredor = (d.nome || '').trim().toLowerCase();
      if (!chaveCredor) return true;
      if (credorJaTemPendenteVisivel.has(chaveCredor)) {
        // Oculta parcelas de meses seguintes enquanto a parcela atual ainda não foi paga
        return false;
      }
      credorJaTemPendenteVisivel.add(chaveCredor);
      return true;
    });

    const mapa: { [chave: string]: DividaLimpaNome[] } = {};

    dividasComControleDeParcela.forEach((d) => {
      const venc = d.vencimento;
      const dt = new Date(venc + 'T12:00:00');
      const mm = (dt.getMonth() + 1).toString().padStart(2, '0');
      const yyyy = dt.getFullYear();
      const k = `${yyyy}-${mm}`;

      if (!mapa[k]) mapa[k] = [];
      mapa[k].push(d);
    });

    // Ordena os meses colocando SEMPRE o mês atual em primeiro lugar,
    // depois os meses futuros mais próximos em ordem crescente, e por fim meses anteriores mais próximos
    const chaves = Object.keys(mapa).sort((a, b) => {
      if (a === mesAtualChave && b !== mesAtualChave) return -1;
      if (b === mesAtualChave && a !== mesAtualChave) return 1;

      const isAFuturoOuAtual = a >= mesAtualChave;
      const isBFuturoOuAtual = b >= mesAtualChave;

      if (isAFuturoOuAtual && isBFuturoOuAtual) {
        return a.localeCompare(b); // Mais próximos do mês atual primeiro
      }
      if (isAFuturoOuAtual && !isBFuturoOuAtual) {
        // Se o mês passado ainda tiver conta pendente atrasada, mostra logo após o mês atual; senão prioriza os próximos meses
        const bTemPendente = mapa[b].some((x) => !x.paga);
        const aTemPendente = mapa[a].some((x) => !x.paga);
        if (bTemPendente && !aTemPendente) return 1;
        return -1;
      }
      if (!isAFuturoOuAtual && isBFuturoOuAtual) {
        const aTemPendente = mapa[a].some((x) => !x.paga);
        const bTemPendente = mapa[b].some((x) => !x.paga);
        if (aTemPendente && !bTemPendente) return -1;
        return 1;
      }
      // Ambos no passado: mês mais recente (mais próximo do atual) primeiro
      return b.localeCompare(a);
    });

    return chaves.map((k) => {
      const [yyyy, mm] = k.split('-');
      const isMesAtual = k === mesAtualChave;
      const nomeMes = `${mesesNomes[mm] || mm} ${yyyy}`;
      const todasDoMes = mapa[k];
      const visiveis = todasDoMes.filter((d) => {
        if (filtro === 'pendentes') return !d.paga;
        if (filtro === 'quitados') return d.paga;
        return true;
      });

      let totalMes = 0;
      let pagoMes = 0;
      todasDoMes.forEach((d) => {
        totalMes += d.valor;
        if (d.paga) pagoMes += d.valor;
      });
      const faltaMes = Math.max(0, totalMes - pagoMes);
      const pct = totalMes > 0 ? (pagoMes / totalMes) * 100 : 0;

      return {
        chave: k,
        nomeMes,
        isMesAtual,
        todasDoMes,
        visiveis,
        totalMes,
        pagoMes,
        faltaMes,
        pct,
      };
    }).filter((m) => m.visiveis.length > 0);
  }, [dividas, filtro]);

  // Prévia de cálculo no formulário
  const previaForm = useMemo(() => {
    const vTotal = parseFloat(valorTotal.replace(',', '.')) || 0;
    const vOrig = parseFloat(valorOriginal.replace(',', '.')) || 0;
    const qtd = parcelado ? parseInt(totalParcelas, 10) || 1 : 1;

    const valorParcela = vTotal > 0 && qtd > 0 ? vTotal / qtd : 0;
    const economia = vOrig > vTotal ? vOrig - vTotal : 0;
    const percDesconto = vOrig > 0 && economia > 0 ? Math.round((economia / vOrig) * 100) : 0;

    return {
      valorParcela,
      economia,
      percDesconto,
      qtd,
    };
  }, [valorTotal, valorOriginal, parcelado, totalParcelas]);

  if (!isOpen) return null;

  const handleResetForm = () => {
    setNome('');
    setValorOriginal('');
    setValorTotal('');
    setVencimento(new Date().toISOString().split('T')[0]);
    setParcelado(true);
    setTotalParcelas('12');
    setFormError(null);
    setEditingDividaId(null);
    setIsFormOpen(false);
  };

  const handleStartEdit = (d: DividaLimpaNome) => {
    setEditingDividaId(d.id);
    setNome(d.nome);
    setValorOriginal(d.valorOriginalDica ? String(d.valorOriginalDica) : '');
    setValorTotal(String(d.valorTotalOriginal || d.valor));
    setVencimento(d.vencimento);
    setParcelado(d.totalParcelas > 1);
    setTotalParcelas(String(d.totalParcelas || 1));
    setFormError(null);
    setIsFormOpen(true);
    setOpenMenuId(null);
  };

  const handleSalvarFormulario = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      setFormError('Informe o nome do credor (banco, loja ou empresa).');
      return;
    }
    const vAcordo = parseFloat(valorTotal.replace(',', '.'));
    if (!vAcordo || vAcordo <= 0) {
      setFormError('Informe o valor fechado do acordo.');
      return;
    }

    const vOrDica = parseFloat(valorOriginal.replace(',', '.')) || null;
    const qtd = parcelado ? parseInt(totalParcelas, 10) || 1 : 1;
    const valorParcela = vAcordo / qtd;

    if (editingDividaId) {
      const existing = dividas.find((x) => x.id === editingDividaId);
      const updated: DividaLimpaNome = {
        id: editingDividaId,
        nome: nome.trim(),
        valor: valorParcela,
        valorTotalOriginal: vAcordo,
        valorOriginalDica: vOrDica,
        vencimento: vencimento || new Date().toISOString().split('T')[0],
        paga: existing ? existing.paga : false,
        totalParcelas: qtd,
        parcelaAtual: existing ? existing.parcelaAtual : 1,
        dataCriacao: existing?.dataCriacao || new Date().toISOString(),
      };
      onSaveDivida(updated);
      showToast('Acordo atualizado com sucesso no dados_limpanome!');
    } else {
      const nova: DividaLimpaNome = {
        id: Date.now().toString(),
        nome: nome.trim(),
        valor: valorParcela,
        valorTotalOriginal: vAcordo,
        valorOriginalDica: vOrDica,
        vencimento: vencimento || new Date().toISOString().split('T')[0],
        paga: false,
        totalParcelas: qtd,
        parcelaAtual: 1,
        dataCriacao: new Date().toISOString(),
      };
      onSaveDivida(nova);
      showToast('Novo acordo salvo com sucesso no dados_limpanome!');
    }

    handleResetForm();
  };

  const handleCopyDados = (d: DividaLimpaNome) => {
    const dataBr = d.vencimento.split('-').reverse().join('/');
    const txt = `🏦 Acordo: ${d.nome} | Parcela ${d.parcelaAtual || 1}/${d.totalParcelas || 1} | R$ ${formatCurrency(d.valor)} | Vencimento: ${dataBr}`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(txt).then(() => {
        showToast(`Dados de ${d.nome} copiados!`);
      }).catch(() => {
        showToast(txt);
      });
    } else {
      showToast(txt);
    }
    setOpenMenuId(null);
  };

  const handleShareWhatsApp = (d: DividaLimpaNome) => {
    const dataBr = d.vencimento.split('-').reverse().join('/');
    const status = d.paga ? '✓ Quitado' : '⏳ Pendente';
    const texto = `🏦 *ACORDO / DÍVIDA*\n🏢 *Credor:* ${d.nome}\n📦 *Parcela ${d.parcelaAtual || 1} de ${d.totalParcelas || 1}*\n💰 *Valor:* R$ ${formatCurrency(d.valor)}\n📅 *Vencimento:* ${dataBr}\n📊 *Status:* ${status}\n\n_Registrado no dados_limpanome_`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
    setOpenMenuId(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#0d0d16] border border-purple-500/30 rounded-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden text-left relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toast Notificação */}
        {toastMessage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-purple-600 text-white text-xs font-semibold rounded-xl shadow-xl border border-purple-400 flex items-center gap-2 animate-in fade-in duration-150">
            <Check className="w-4 h-4 text-white" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Topo do Modal */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-purple-950/40 via-[#0d0d16] to-[#0d0d16]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/25 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-md">
              <Handshake className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white font-display">Acordos & Limpa Nome</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  dados_limpanome
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Sincronizado diretamente com a base do seu outro app
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors touch-manipulation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo Rolável */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Cards de Resumo Geral */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
              <span className="text-[10px] text-neutral-400 uppercase font-semibold block">Total</span>
              <span className="text-sm sm:text-base font-bold text-white">R$ {formatCurrency(stats.totalFechado)}</span>
            </div>

            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <span className="text-[10px] text-emerald-400 uppercase font-semibold block">Quitado</span>
              <span className="text-sm sm:text-base font-bold text-emerald-300">R$ {formatCurrency(stats.totalPago)}</span>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <span className="text-[10px] text-amber-400 uppercase font-semibold block">Pendente</span>
              <span className="text-sm sm:text-base font-bold text-amber-300">R$ {formatCurrency(stats.restantePagar)}</span>
            </div>

            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl">
              <span className="text-[10px] text-purple-400 uppercase font-semibold block flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-purple-400" />
                Economia
              </span>
              <span className="text-sm sm:text-base font-bold text-purple-300">
                R$ {formatCurrency(stats.totalEconomizado)}
                {stats.percDescontoMedio > 0 && (
                  <span className="text-[10px] ml-1 text-purple-400 font-normal">(-{stats.percDescontoMedio}%)</span>
                )}
              </span>
            </div>
          </div>

          {/* Filtros e Botão Adicionar */}
          <div className="flex items-center justify-between gap-2 flex-wrap border-b border-white/5 pb-3">
            <div className="flex p-1 bg-white/5 rounded-xl border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setFiltro('todos')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  filtro === 'todos'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Todas ({dividas.length})
              </button>
              <button
                type="button"
                onClick={() => setFiltro('pendentes')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  filtro === 'pendentes'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Pendentes ({stats.qtdPendentes})
              </button>
              <button
                type="button"
                onClick={() => setFiltro('quitados')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  filtro === 'quitados'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Quitadas ({stats.qtdQuitados})
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                if (isFormOpen) handleResetForm();
                else setIsFormOpen(true);
              }}
              className="py-2 px-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 transition-transform touch-manipulation"
            >
              {isFormOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{isFormOpen ? 'Fechar Formulário' : '+ Adicionar Acordo'}</span>
            </button>
          </div>

          {/* Formulário de Adicionar / Editar */}
          {isFormOpen && (
            <form
              onSubmit={handleSalvarFormulario}
              className="p-4 bg-white/5 border border-purple-500/30 rounded-2xl space-y-3 animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Handshake className="w-4 h-4 text-purple-400" />
                  {editingDividaId ? 'Editar Acordo' : 'Cadastrar Novo Acordo'}
                </span>
                <span className="text-[10px] text-purple-300">Grava em dados_limpanome</span>
              </div>

              {formError && (
                <div className="p-2.5 bg-red-500/15 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Nome do Credor */}
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
                    Credor (Banco / Loja / Empresa) *
                  </label>
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Nubank, Itaú, Casas Bahia..."
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Vencimento da 1ª Parcela */}
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
                    Vencimento da 1ª Parcela *
                  </label>
                  <input
                    type="date"
                    value={vencimento}
                    onChange={(e) => setVencimento(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Valor Original */}
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
                    Valor original da dívida (opcional)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={valorOriginal}
                    onChange={(e) => setValorOriginal(e.target.value)}
                    placeholder="Ex: 5000.00"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Valor do Acordo */}
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
                    Valor total fechado do acordo *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={valorTotal}
                    onChange={(e) => setValorTotal(e.target.value)}
                    placeholder="Ex: 1500.00"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Parcelado */}
              <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={parcelado}
                    onChange={(e) => setParcelado(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-purple-500 h-4 w-4 bg-white/10 border-white/20"
                  />
                  <span className="text-xs font-semibold text-white">Acordo parcelado?</span>
                </label>

                {parcelado && (
                  <div className="pt-2 flex items-center gap-3">
                    <div className="w-36">
                      <label className="block text-[10px] text-neutral-400 mb-1">Quantidade de parcelas</label>
                      <input
                        type="number"
                        min="1"
                        max="120"
                        value={totalParcelas}
                        onChange={(e) => setTotalParcelas(e.target.value)}
                        placeholder="Ex: 12"
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    {previaForm.valorParcela > 0 && (
                      <div className="flex-1 pt-4 text-xs font-semibold text-emerald-400">
                        {previaForm.qtd}x de R$ {formatCurrency(previaForm.valorParcela)}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Prévia de Desconto / Economia */}
              {previaForm.economia > 0 && (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      Economia negociada: <strong>R$ {formatCurrency(previaForm.economia)}</strong>
                    </span>
                  </div>
                  <span className="font-bold text-[11px] px-2 py-0.5 bg-emerald-500/20 rounded-full border border-emerald-500/30">
                    -{previaForm.percDesconto}% de desconto!
                  </span>
                </div>
              )}

              {/* Botões Salvar / Cancelar */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-neutral-300 text-xs rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md transition-transform"
                >
                  {editingDividaId ? 'Atualizar no dados_limpanome' : 'Salvar no dados_limpanome'}
                </button>
              </div>
            </form>
          )}

          {/* LISTA DE MESES (Com cronograma e datas 100% corretas) */}
          <div className="space-y-4">
            {gruposMeses.length === 0 ? (
              <div className="p-8 text-center bg-white/5 rounded-2xl border border-white/5 space-y-2">
                <Calendar className="w-8 h-8 text-neutral-600 mx-auto" />
                <p className="text-xs text-neutral-400">
                  {filtro === 'pendentes'
                    ? 'Nenhum acordo pendente. Todas as parcelas estão quitadas!'
                    : filtro === 'quitados'
                    ? 'Nenhuma parcela quitada ainda.'
                    : 'Nenhum acordo encontrado em dados_limpanome.'}
                </p>
                {!isFormOpen && (
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(true)}
                    className="text-xs text-purple-400 hover:underline pt-1 inline-block"
                  >
                    + Cadastrar primeiro acordo
                  </button>
                )}
              </div>
            ) : (
              gruposMeses.map((m) => (
                <div
                  key={m.chave}
                  className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3"
                >
                  {/* Cabeçalho do Mês */}
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-purple-400" />
                      <span>{m.nomeMes}</span>
                      {m.isMesAtual && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-600 text-white uppercase tracking-wider shadow">
                          Mês Atual
                        </span>
                      )}
                    </h4>
                    <span className="text-[11px] text-purple-300 font-semibold">
                      {m.visiveis.length} {m.visiveis.length === 1 ? 'conta' : 'contas'}
                    </span>
                  </div>

                  {/* Resumo do Mês */}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2.5 bg-black/30 rounded-xl">
                      <span className="text-[10px] text-neutral-400 block uppercase font-medium">Total</span>
                      <strong className="text-white text-sm">R$ {formatCurrency(m.totalMes)}</strong>
                    </div>
                    <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                      <span className="text-[10px] text-emerald-400 block uppercase font-medium">Quitado</span>
                      <strong className="text-emerald-300 text-sm">R$ {formatCurrency(m.pagoMes)}</strong>
                    </div>
                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                      <span className="text-[10px] text-amber-400 block uppercase font-medium">Pendente</span>
                      <strong className="text-amber-300 text-sm">R$ {formatCurrency(m.faltaMes)}</strong>
                    </div>
                  </div>

                  {/* Barra de Progresso do Mês */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-neutral-400">
                      <span>Progresso do mês</span>
                      <span className="font-semibold text-white">{m.pct.toFixed(0)}% pago</span>
                    </div>
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300"
                        style={{ width: `${m.pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Lista de Contas do Mês */}
                  <div className="space-y-2 pt-1">
                    {m.visiveis.map((d) => {
                      const dataFormatada = d.vencimento.split('-').reverse().join('/');

                      return (
                        <div
                          key={d.id}
                          className={`p-3.5 rounded-xl border transition-all ${
                            d.paga
                              ? 'bg-emerald-950/20 border-emerald-500/30'
                              : 'bg-black/40 border-white/10 hover:border-purple-500/30'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                                  d.paga
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                                }`}
                              >
                                <Building2 className="w-4 h-4" />
                              </div>
                              <div>
                                <h5 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                                  {d.nome}
                                  {d.paga ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" />
                                      Quitado
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                      Pendente
                                    </span>
                                  )}
                                </h5>
                                <div className="flex items-center gap-3 text-[11px] text-neutral-400 mt-0.5 flex-wrap">
                                  <span>📅 Vence em {dataFormatada}</span>
                                  <span>📦 Parcela {d.parcelaAtual || 1} de {d.totalParcelas || 1}</span>
                                </div>
                              </div>
                            </div>

                            <div className="text-right">
                              <span className="text-xs sm:text-sm font-bold text-white block">
                                R$ {formatCurrency(d.valor)}
                              </span>
                            </div>
                          </div>

                          {/* Ações da Parcela */}
                          <div className="mt-2.5 pt-2.5 border-t border-white/5 flex items-center justify-between gap-2">
                            <div>
                              {d.paga && (
                                <button
                                  type="button"
                                  onClick={() => onUndoDivida(d.id)}
                                  className="py-1 px-2.5 bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white rounded-lg text-xs flex items-center gap-1 transition-colors"
                                  title="Desfazer quitação desta parcela"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Desfazer</span>
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 ml-auto relative">
                              {!d.paga && (
                                <button
                                  type="button"
                                  onClick={() => onPayDivida(d.id)}
                                  className="py-1.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white rounded-lg text-xs font-bold shadow flex items-center gap-1 active:scale-95 transition-transform"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Quitar parcela</span>
                                </button>
                              )}

                              {/* Botão Menu ⋯ */}
                              <button
                                type="button"
                                onClick={() => setOpenMenuId(openMenuId === d.id ? null : d.id)}
                                className="p-1.5 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                title="Mais opções"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </button>

                              {/* Menu Suspenso */}
                              {openMenuId === d.id && (
                                <div className="absolute right-0 top-full mt-1 w-48 bg-[#151522] border border-white/15 rounded-xl shadow-2xl p-1 z-30 space-y-0.5 animate-in fade-in zoom-in-95 duration-100 text-left">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEdit(d)}
                                    className="w-full px-2.5 py-1.5 text-xs text-left text-neutral-300 hover:text-white hover:bg-white/10 rounded-lg flex items-center gap-2"
                                  >
                                    <Pencil className="w-3.5 h-3.5 text-purple-400" />
                                    <span>Editar acordo</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleCopyDados(d)}
                                    className="w-full px-2.5 py-1.5 text-xs text-left text-neutral-300 hover:text-white hover:bg-white/10 rounded-lg flex items-center gap-2"
                                  >
                                    <Copy className="w-3.5 h-3.5 text-blue-400" />
                                    <span>Copiar boleto / Pix</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleShareWhatsApp(d)}
                                    className="w-full px-2.5 py-1.5 text-xs text-left text-neutral-300 hover:text-white hover:bg-white/10 rounded-lg flex items-center gap-2"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Enviar no WhatsApp</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (confirm(`Deseja cancelar/excluir o acordo com ${d.nome}?`)) {
                                        onDeleteDivida(d.id);
                                      }
                                      setOpenMenuId(null);
                                    }}
                                    className="w-full px-2.5 py-1.5 text-xs text-left text-red-400 hover:bg-red-500/10 rounded-lg flex items-center gap-2 border-t border-white/5 pt-1.5 mt-1"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Cancelar / Excluir</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Rodapé */}
        <div className="p-3 border-t border-white/10 bg-[#0a0a12] flex items-center justify-between text-xs text-neutral-400">
          <span>{dividas.length} contas no total</span>
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-xl font-medium transition-all"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
