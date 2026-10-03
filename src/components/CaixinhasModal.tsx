import React, { useState, useMemo } from 'react';
import {
  X,
  Package,
  Plus,
  TrendingUp,
  PiggyBank,
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
  Target,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Pencil,
  History,
  ShieldCheck,
  Compass,
  Car,
  Plane,
  Heart,
  Wallet
} from 'lucide-react';
import { Caixinha, TransacaoCaixinha } from '../types';

interface CaixinhasModalProps {
  isOpen: boolean;
  onClose: () => void;
  caixinhas: Caixinha[];
  onSaveCaixinha: (caixinha: Caixinha) => void;
  onDeleteCaixinha: (id: string) => void;
  onDeposit: (id: string, valor: number, descricao?: string) => void;
  onWithdraw: (id: string, valor: number, descricao?: string) => void;
}

const CATEGORIAS_CONFIG: {
  [key: string]: { label: string; icon: any; color: string; bg: string };
} = {
  emergencia: {
    label: 'Reserva de Emergência',
    icon: ShieldCheck,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/30',
  },
  sonhos: {
    label: 'Sonhos & Conquistas',
    icon: Sparkles,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/30',
  },
  viagem: {
    label: 'Viagem & Lazer',
    icon: Plane,
    color: 'text-sky-400',
    bg: 'bg-sky-500/10 border-sky-500/30',
  },
  bens: {
    label: 'Carro / Casa / Bens',
    icon: Car,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
  },
  investimento: {
    label: 'Investimentos & Futuro',
    icon: TrendingUp,
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10 border-indigo-500/30',
  },
  geral: {
    label: 'Outras Metas',
    icon: PiggyBank,
    color: 'text-pink-400',
    bg: 'bg-pink-500/10 border-pink-500/30',
  },
};

export const CaixinhasModal: React.FC<CaixinhasModalProps> = ({
  isOpen,
  onClose,
  caixinhas,
  onSaveCaixinha,
  onDeleteCaixinha,
  onDeposit,
  onWithdraw,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('todas');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCaixinha, setEditingCaixinha] = useState<Caixinha | null>(null);

  // Modal de Transação (Guardar / Resgatar)
  const [transactionModal, setTransactionModal] = useState<{
    isOpen: boolean;
    caixinhaId: string;
    caixinhaNome: string;
    tipo: 'deposito' | 'resgate';
    saldoAtual: number;
  } | null>(null);
  const [transacaoValor, setTransacaoValor] = useState('');
  const [transacaoDescricao, setTransacaoDescricao] = useState('');

  // Modal de Histórico/Extrato
  const [historicoCaixinha, setHistoricoCaixinha] = useState<Caixinha | null>(null);

  // Form de Criar/Editar Caixinha
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState<Caixinha['categoria']>('emergencia');
  const [saldoInicial, setSaldoInicial] = useState('');
  const [meta, setMeta] = useState('');
  const [prazoMeta, setPrazoMeta] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Cálculos Gerais
  const totalGuardado = useMemo(() => {
    return caixinhas.reduce((acc, c) => acc + (Number(c.saldo) || 0), 0);
  }, [caixinhas]);

  const totalMetas = useMemo(() => {
    return caixinhas.reduce((acc, c) => acc + (Number(c.meta) || 0), 0);
  }, [caixinhas]);

  const rendimentoEstimadoMensal = useMemo(() => {
    // Estimativa de ~0.85% a.m. (100% do CDI líquido aprox)
    return totalGuardado * 0.0085;
  }, [totalGuardado]);

  const caixinhasFiltradas = useMemo(() => {
    if (activeCategory === 'todas') return caixinhas;
    return caixinhas.filter((c) => c.categoria === activeCategory);
  }, [caixinhas, activeCategory]);

  const formatCurrency = (val: number) => {
    return (val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleOpenCreate = () => {
    setEditingCaixinha(null);
    setNome('');
    setCategoria('emergencia');
    setSaldoInicial('');
    setMeta('');
    setPrazoMeta('');
    setObservacoes('');
    setShowAddForm(true);
  };

  const handleOpenEdit = (c: Caixinha) => {
    setEditingCaixinha(c);
    setNome(c.nome);
    setCategoria(c.categoria);
    setSaldoInicial(String(c.saldo || '0'));
    setMeta(c.meta ? String(c.meta) : '');
    setPrazoMeta(c.prazoMeta || '');
    setObservacoes(c.observacoes || '');
    setShowAddForm(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      alert('Por favor, informe o nome da caixinha.');
      return;
    }

    const valorSaldo = parseFloat(saldoInicial.replace(',', '.')) || 0;
    const valorMeta = meta ? parseFloat(meta.replace(',', '.')) : undefined;

    if (editingCaixinha) {
      const updated: Caixinha = {
        ...editingCaixinha,
        nome: nome.trim(),
        categoria,
        saldo: valorSaldo,
        meta: valorMeta,
        prazoMeta: prazoMeta || undefined,
        observacoes: observacoes.trim() || undefined,
      };
      onSaveCaixinha(updated);
      showToast(`Caixinha "${updated.nome}" atualizada com sucesso!`);
    } else {
      const nova: Caixinha = {
        id: 'caixinha_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        nome: nome.trim(),
        categoria,
        saldo: valorSaldo,
        meta: valorMeta,
        prazoMeta: prazoMeta || undefined,
        rendimentoMensalPct: 1.0,
        dataCriacao: new Date().toISOString(),
        observacoes: observacoes.trim() || undefined,
        historico: valorSaldo > 0 ? [
          {
            id: 'tx_' + Date.now(),
            tipo: 'deposito',
            valor: valorSaldo,
            data: new Date().toISOString(),
            descricao: 'Depósito inicial',
          },
        ] : [],
      };
      onSaveCaixinha(nova);
      showToast(`Nova caixinha "${nova.nome}" criada com sucesso!`);
    }

    setShowAddForm(false);
  };

  const handleConfirmTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionModal) return;

    const val = parseFloat(transacaoValor.replace(',', '.'));
    if (!val || val <= 0) {
      alert('Informe um valor válido maior que zero.');
      return;
    }

    if (transactionModal.tipo === 'resgate' && val > transactionModal.saldoAtual) {
      alert('O valor de resgate não pode ser maior que o saldo disponível na caixinha!');
      return;
    }

    if (transactionModal.tipo === 'deposito') {
      onDeposit(transactionModal.caixinhaId, val, transacaoDescricao.trim() || 'Depósito na caixinha');
      showToast(`+ R$ ${formatCurrency(val)} guardados em "${transactionModal.caixinhaNome}"!`);
    } else {
      onWithdraw(transactionModal.caixinhaId, val, transacaoDescricao.trim() || 'Resgate da caixinha');
      showToast(`- R$ ${formatCurrency(val)} resgatados de "${transactionModal.caixinhaNome}"!`);
    }

    setTransactionModal(null);
    setTransacaoValor('');
    setTransacaoDescricao('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#0f0f1c] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-white">
        
        {/* Toast Notificação */}
        {toastMsg && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-black font-semibold text-xs py-2 px-4 rounded-full shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 animate-bounce">
            <CheckCircle2 className="w-4 h-4" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Topo do Modal */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-[#141424]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/25 border border-purple-500/30 flex items-center justify-center text-purple-300 shadow-md shadow-purple-600/20">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold font-display text-white">
                  Caixinhas & Metas
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                  Rendimento 100% CDI
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Guarde dinheiro para seus sonhos, reserve para emergências e acompanhe metas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo com Scroll */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          
          {/* Dashboard Resumo Financeiro */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Saldo Total Guardado */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-purple-900/30 via-[#181829] to-neutral-900 border border-purple-500/30 relative overflow-hidden">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-neutral-400 font-medium">Total Guardado</span>
                <PiggyBank className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-xl sm:text-2xl font-bold font-display text-white">
                R$ {formatCurrency(totalGuardado)}
              </div>
              <span className="text-[11px] text-purple-300/80 mt-1 block">
                {caixinhas.length} {caixinhas.length === 1 ? 'caixinha ativa' : 'caixinhas ativas'}
              </span>
            </div>

            {/* Total em Metas */}
            <div className="p-4 rounded-xl bg-[#141424] border border-white/10 relative overflow-hidden">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-neutral-400 font-medium">Meta Total</span>
                <Target className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl sm:text-2xl font-bold font-display text-emerald-400">
                R$ {formatCurrency(totalMetas)}
              </div>
              <span className="text-[11px] text-neutral-400 mt-1 block">
                {totalMetas > 0
                  ? `${Math.min(100, Math.round((totalGuardado / totalMetas) * 100))}% da meta atingida`
                  : 'Nenhuma meta definida'}
              </span>
            </div>

            {/* Rendimento Mensal Estimado */}
            <div className="p-4 rounded-xl bg-[#141424] border border-white/10 relative overflow-hidden">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-neutral-400 font-medium">Rendimento Estimado</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl sm:text-2xl font-bold font-display text-emerald-300">
                + R$ {formatCurrency(rendimentoEstimadoMensal)}/mês
              </div>
              <span className="text-[11px] text-neutral-400 mt-1 block">
                Baseado em ~100% CDI
              </span>
            </div>
          </div>

          {/* Barra de Filtro de Categorias & Botão Nova Caixinha */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full text-xs no-scrollbar">
              <button
                type="button"
                onClick={() => setActiveCategory('todas')}
                className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
                  activeCategory === 'todas'
                    ? 'bg-purple-600 text-white shadow'
                    : 'bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10'
                }`}
              >
                Todas ({caixinhas.length})
              </button>
              {Object.entries(CATEGORIAS_CONFIG).map(([key, cfg]) => {
                const count = caixinhas.filter((c) => c.categoria === key).length;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveCategory(key)}
                    className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      activeCategory === key
                        ? 'bg-purple-600 text-white shadow'
                        : 'bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <cfg.icon className="w-3.5 h-3.5" />
                    <span>{cfg.label.split(' ')[0]}</span>
                    {count > 0 && <span className="opacity-75">({count})</span>}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleOpenCreate}
              className="py-2 px-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Caixinha</span>
            </button>
          </div>

          {/* Lista de Caixinhas */}
          {caixinhasFiltradas.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl bg-white/[0.02] border border-white/5">
              <div className="w-16 h-16 rounded-2xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-3 text-purple-300">
                <PiggyBank className="w-8 h-8 opacity-70" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">Nenhuma caixinha encontrada</h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto mb-4">
                Comece a organizar suas economias guardando dinheiro para sua reserva de emergência, viagens ou sonhos.
              </p>
              <button
                type="button"
                onClick={handleOpenCreate}
                className="py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-xs inline-flex items-center gap-2 shadow-lg shadow-purple-600/30"
              >
                <Plus className="w-4 h-4" />
                <span>Criar Minha Primeira Caixinha</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {caixinhasFiltradas.map((c) => {
                const cfg = CATEGORIAS_CONFIG[c.categoria] || CATEGORIAS_CONFIG.geral;
                const Icon = cfg.icon;
                const percentual = c.meta && c.meta > 0 ? Math.min(100, (c.saldo / c.meta) * 100) : null;
                const falta = c.meta && c.meta > c.saldo ? c.meta - c.saldo : 0;

                return (
                  <div
                    key={c.id}
                    className="p-4 rounded-2xl bg-[#141424] border border-white/10 hover:border-purple-500/40 transition-all flex flex-col justify-between group shadow-md"
                  >
                    <div>
                      {/* Topo do Card */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-9 h-9 rounded-xl ${cfg.bg} flex items-center justify-center ${cfg.color} shrink-0`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-white leading-tight">{c.nome}</h4>
                            <span className="text-[10px] text-neutral-400 block">{cfg.label}</span>
                          </div>
                        </div>

                        {/* Ações Rápidas */}
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => setHistoricoCaixinha(c)}
                            title="Ver histórico de movimentações"
                            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-purple-300"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(c)}
                            title="Editar caixinha"
                            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Tem certeza que deseja excluir a caixinha "${c.nome}"?`)) {
                                onDeleteCaixinha(c.id);
                                showToast(`Caixinha "${c.nome}" excluída.`);
                              }
                            }}
                            title="Excluir caixinha"
                            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-red-500/20 flex items-center justify-center text-neutral-400 hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Valores */}
                      <div className="my-2.5">
                        <span className="text-[10px] text-neutral-400 font-medium block uppercase tracking-wider">
                          Saldo Guardado
                        </span>
                        <div className="text-2xl font-bold font-display text-white">
                          R$ {formatCurrency(c.saldo)}
                        </div>
                      </div>

                      {/* Meta e Barra de Progresso */}
                      {c.meta && c.meta > 0 ? (
                        <div className="space-y-1.5 my-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-neutral-400">
                              Meta: <strong className="text-neutral-200">R$ {formatCurrency(c.meta)}</strong>
                            </span>
                            <span className="font-bold text-emerald-400">
                              {percentual ? percentual.toFixed(0) : 0}%
                            </span>
                          </div>
                          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-purple-500 to-emerald-400 rounded-full transition-all duration-500"
                              style={{ width: `${percentual}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-neutral-400 pt-0.5">
                            {falta > 0 ? (
                              <span>Faltam R$ {formatCurrency(falta)}</span>
                            ) : (
                              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Meta Concluída!
                              </span>
                            )}
                            {c.prazoMeta && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(c.prazoMeta + 'T00:00:00').toLocaleDateString('pt-BR')}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="py-1 text-[11px] text-neutral-500">
                          Sem meta estipulada
                        </div>
                      )}

                      {c.observacoes && (
                        <p className="text-[11px] text-neutral-400 italic line-clamp-1 mt-1">
                          "{c.observacoes}"
                        </p>
                      )}
                    </div>

                    {/* Botões de Ação Guardar / Resgatar */}
                    <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-white/5">
                      <button
                        type="button"
                        onClick={() => {
                          setTransactionModal({
                            isOpen: true,
                            caixinhaId: c.id,
                            caixinhaNome: c.nome,
                            tipo: 'deposito',
                            saldoAtual: c.saldo,
                          });
                          setTransacaoValor('');
                          setTransacaoDescricao('');
                        }}
                        className="py-2 px-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 active:scale-95 text-emerald-300 rounded-xl border border-emerald-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                      >
                        <ArrowDownLeft className="w-3.5 h-3.5" />
                        <span>Guardar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setTransactionModal({
                            isOpen: true,
                            caixinhaId: c.id,
                            caixinhaNome: c.nome,
                            tipo: 'resgate',
                            saldoAtual: c.saldo,
                          });
                          setTransacaoValor('');
                          setTransacaoDescricao('');
                        }}
                        className="py-2 px-2.5 bg-white/5 hover:bg-white/10 active:scale-95 text-neutral-300 rounded-xl border border-white/10 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <span>Resgatar</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Rodapé Informativo */}
        <div className="p-3.5 bg-[#121220] border-t border-white/10 flex items-center justify-between text-xs text-neutral-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Sincronizado na nuvem (dados_caixinhas)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white/10 hover:bg-white/15 text-white font-medium rounded-lg text-xs transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Modal Criar / Editar Caixinha */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#161626] border border-white/15 rounded-2xl p-5 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className="font-bold text-base font-display">
                {editingCaixinha ? 'Editar Caixinha' : 'Nova Caixinha'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-neutral-400 font-semibold mb-1">Nome da Caixinha *</label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Reserva de Emergência, Viagem Disney, Reforma"
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-neutral-400 font-semibold mb-1">Categoria / Objetivo</label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value as any)}
                  className="w-full px-3 py-2.5 bg-[#1b1b2f] border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="emergencia">🛡️ Reserva de Emergência</option>
                  <option value="sonhos">✨ Sonhos & Conquistas</option>
                  <option value="viagem">✈️ Viagem & Lazer</option>
                  <option value="bens">🚗 Carro / Casa / Bens</option>
                  <option value="investimento">📈 Investimentos & Futuro</option>
                  <option value="geral">🐷 Outras Metas</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-neutral-400 font-semibold mb-1">
                    {editingCaixinha ? 'Saldo Atual (R$)' : 'Depósito Inicial (R$)'}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={saldoInicial}
                    onChange={(e) => setSaldoInicial(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-neutral-400 font-semibold mb-1">Valor da Meta (R$)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={meta}
                    onChange={(e) => setMeta(e.target.value)}
                    placeholder="Ex: 5000,00"
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-400 font-semibold mb-1">Prazo Objetivo (Opcional)</label>
                <input
                  type="date"
                  value={prazoMeta}
                  onChange={(e) => setPrazoMeta(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-neutral-400 font-semibold mb-1">Observações ou Dicas</label>
                <input
                  type="text"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Ex: Guardar R$ 200 todo mês após o pagamento"
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-neutral-300 font-medium rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-bold rounded-xl shadow-lg shadow-purple-600/30"
                >
                  {editingCaixinha ? 'Salvar Alterações' : 'Criar Caixinha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Transação (Guardar / Resgatar) */}
      {transactionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-[#161626] border border-white/15 rounded-2xl p-5 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  transactionModal.tipo === 'deposito'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {transactionModal.tipo === 'deposito' ? (
                    <ArrowDownLeft className="w-4 h-4" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">
                    {transactionModal.tipo === 'deposito' ? 'Guardar Dinheiro' : 'Resgatar Dinheiro'}
                  </h3>
                  <span className="text-[11px] text-neutral-400">{transactionModal.caixinhaNome}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTransactionModal(null)}
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmTransaction} className="space-y-3.5 text-xs">
              <div className="p-3 bg-white/5 rounded-xl flex items-center justify-between text-[11px]">
                <span className="text-neutral-400">Saldo Disponível:</span>
                <span className="font-bold text-white font-mono">
                  R$ {formatCurrency(transactionModal.saldoAtual)}
                </span>
              </div>

              <div>
                <label className="block text-neutral-400 font-semibold mb-1">
                  Valor a {transactionModal.tipo === 'deposito' ? 'Guardar' : 'Resgatar'} (R$) *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  autoFocus
                  required
                  value={transacaoValor}
                  onChange={(e) => setTransacaoValor(e.target.value)}
                  placeholder="0,00"
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white font-mono text-base font-bold focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-neutral-400 font-semibold mb-1">Descrição / Motivo</label>
                <input
                  type="text"
                  value={transacaoDescricao}
                  onChange={(e) => setTransacaoDescricao(e.target.value)}
                  placeholder={
                    transactionModal.tipo === 'deposito'
                      ? 'Ex: Sobra do salário, Economia da semana'
                      : 'Ex: Troca de pneu, Pagamento pontual'
                  }
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTransactionModal(null)}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-neutral-300 font-medium rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2.5 font-bold rounded-xl active:scale-95 shadow-lg text-white ${
                    transactionModal.tipo === 'deposito'
                      ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                      : 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/30'
                  }`}
                >
                  {transactionModal.tipo === 'deposito' ? 'Confirmar Depósito' : 'Confirmar Resgate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Histórico da Caixinha */}
      {historicoCaixinha && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#161626] border border-white/15 rounded-2xl p-5 shadow-2xl text-white max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-purple-400" />
                <div>
                  <h3 className="font-bold text-sm text-white">Extrato da Caixinha</h3>
                  <span className="text-[11px] text-neutral-400">{historicoCaixinha.nome}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHistoricoCaixinha(null)}
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {!historicoCaixinha.historico || historicoCaixinha.historico.length === 0 ? (
                <div className="text-center py-8 text-xs text-neutral-400">
                  Nenhuma movimentação registrada nesta caixinha ainda.
                </div>
              ) : (
                historicoCaixinha.historico
                  .slice()
                  .reverse()
                  .map((tx) => (
                    <div
                      key={tx.id}
                      className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            tx.tipo === 'deposito'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          {tx.tipo === 'deposito' ? (
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div>
                          <span className="font-semibold text-white block">
                            {tx.descricao || (tx.tipo === 'deposito' ? 'Depósito' : 'Resgate')}
                          </span>
                          <span className="text-[10px] text-neutral-400">
                            {new Date(tx.data).toLocaleDateString('pt-BR')} às{' '}
                            {new Date(tx.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`font-bold font-mono text-sm ${
                          tx.tipo === 'deposito' ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {tx.tipo === 'deposito' ? '+' : '-'} R$ {formatCurrency(tx.valor)}
                      </span>
                    </div>
                  ))
              )}
            </div>

            <div className="pt-3 border-t border-white/10 mt-3 text-right">
              <button
                type="button"
                onClick={() => setHistoricoCaixinha(null)}
                className="px-4 py-1.5 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold rounded-lg"
              >
                Fechar Extrato
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
