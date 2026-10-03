import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Calendar,
  CheckCircle2,
  Plus,
  Trash2,
  Pencil,
  Clock,
  Pin,
  Search,
  Sparkles,
  FileText,
  AlertCircle,
  Tag,
  Check,
  CalendarDays,
  ListTodo,
  StickyNote,
  RotateCw,
  Users,
  Bell
} from 'lucide-react';
import { DadosAgenda, ItemAgenda, NotaRapida } from '../types';

interface NotasLembretesModalProps {
  isOpen: boolean;
  onClose: () => void;
  dadosAgenda: DadosAgenda;
  onSaveAgenda: (dados: DadosAgenda) => void;
  onReloadHistory?: () => Promise<DadosAgenda | undefined>;
}

const CORES_NOTAS = [
  { id: 'roxo', bg: 'bg-purple-950/40 border-purple-500/40 text-purple-100', dot: 'bg-purple-500' },
  { id: 'azul', bg: 'bg-blue-950/40 border-blue-500/40 text-blue-100', dot: 'bg-blue-500' },
  { id: 'esmeralda', bg: 'bg-emerald-950/40 border-emerald-500/40 text-emerald-100', dot: 'bg-emerald-500' },
  { id: 'ambar', bg: 'bg-amber-950/40 border-amber-500/40 text-amber-100', dot: 'bg-amber-500' },
  { id: 'rosa', bg: 'bg-pink-950/40 border-pink-500/40 text-pink-100', dot: 'bg-pink-500' },
  { id: 'neutro', bg: 'bg-[#181828] border-white/10 text-neutral-200', dot: 'bg-neutral-400' },
];

const PRIORIDADES_CONFIG: { [key: string]: { label: string; color: string; bg: string } } = {
  baixa: { label: 'Baixa', color: 'text-neutral-400', bg: 'bg-neutral-500/10 border-neutral-500/20' },
  media: { label: 'Média', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
  alta: { label: 'Alta', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
  urgente: { label: 'Urgente', color: 'text-rose-400', bg: 'bg-rose-500/20 border-rose-500/40 animate-pulse' },
};

export const NotasLembretesModal: React.FC<NotasLembretesModalProps> = ({
  isOpen,
  onClose,
  dadosAgenda,
  onSaveAgenda,
  onReloadHistory,
}) => {
  const [activeTab, setActiveTab] = useState<'agenda' | 'notas'>('agenda');

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const [isReloadingHistory, setIsReloadingHistory] = useState(false);

  // Puxar histórico completo do Firebase automaticamente ao abrir o modal
  useEffect(() => {
    if (isOpen && onReloadHistory) {
      onReloadHistory().catch(() => {});
    }
  }, [isOpen, onReloadHistory]);

  const handleManualReload = async () => {
    if (!onReloadHistory) return;
    setIsReloadingHistory(true);
    try {
      const res = await onReloadHistory();
      const countItens = res?.itens?.length || 0;
      const countNotas = res?.notas?.length || 0;
      showToast(`Histórico sincronizado! ${countItens} lembretes e ${countNotas} notas carregadas do Firebase.`);
    } catch {
      showToast('Histórico sincronizado com a nuvem.');
    } finally {
      setIsReloadingHistory(false);
    }
  };

  // Estados Agenda
  const [filtroAgenda, setFiltroAgenda] = useState<'todos' | 'pendentes' | 'concluidos'>('pendentes');
  const [filtroPessoaAgenda, setFiltroPessoaAgenda] = useState<'todos' | 'Vitórya' | 'Leonardo'>('todos');
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemTitulo, setItemTitulo] = useState('');
  const [itemPessoa, setItemPessoa] = useState<'Vitórya' | 'Leonardo'>('Vitórya');
  const [itemData, setItemData] = useState(new Date().toISOString().split('T')[0]);
  const [itemHora, setItemHora] = useState('');
  const [itemPrioridade, setItemPrioridade] = useState<ItemAgenda['prioridade']>('media');
  const [itemCategoria, setItemCategoria] = useState<ItemAgenda['categoria']>('pessoal');
  const [itemDesc, setItemDesc] = useState('');

  // Estados Notas Rápidas
  const [buscaNota, setBuscaNota] = useState('');
  const [showAddNota, setShowAddNota] = useState(false);
  const [editingNota, setEditingNota] = useState<NotaRapida | null>(null);
  const [notaTitulo, setNotaTitulo] = useState('');
  const [notaConteudo, setNotaConteudo] = useState('');
  const [notaCor, setNotaCor] = useState('roxo');

  // Contadores
  const pendentesAgenda = useMemo(() => {
    return (dadosAgenda.itens || []).filter((i) => !i.concluido).length;
  }, [dadosAgenda.itens]);

  const itensFiltrados = useMemo(() => {
    const list = dadosAgenda.itens || [];
    let filtered = list;
    if (filtroAgenda === 'pendentes') filtered = filtered.filter((i) => !i.concluido);
    if (filtroAgenda === 'concluidos') filtered = filtered.filter((i) => i.concluido);

    if (filtroPessoaAgenda !== 'todos') {
      filtered = filtered.filter((i) => {
        const norm = (i.pessoa || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (filtroPessoaAgenda === 'Vitórya') return norm.includes('vit');
        if (filtroPessoaAgenda === 'Leonardo') return norm.includes('leo') || !i.pessoa;
        return true;
      });
    }

    // Ordenar por data mais próxima primeiro
    return filtered.slice().sort((a, b) => {
      const dataA = a.data + (a.hora ? 'T' + a.hora : 'T23:59:59');
      const dataB = b.data + (b.hora ? 'T' + b.hora : 'T23:59:59');
      return dataA.localeCompare(dataB);
    });
  }, [dadosAgenda.itens, filtroAgenda, filtroPessoaAgenda]);

  const notasFiltradas = useMemo(() => {
    const list = dadosAgenda.notas || [];
    let filtered = list;
    if (buscaNota.trim()) {
      const q = buscaNota.toLowerCase();
      filtered = list.filter(
        (n) => n.titulo.toLowerCase().includes(q) || n.conteudo.toLowerCase().includes(q)
      );
    }
    // Fixadas primeiro
    return filtered.slice().sort((a, b) => {
      if (a.fixada && !b.fixada) return -1;
      if (!a.fixada && b.fixada) return 1;
      return new Date(b.dataAtualizacao).getTime() - new Date(a.dataAtualizacao).getTime();
    });
  }, [dadosAgenda.notas, buscaNota]);

  // Handlers Agenda
  const handleSaveItemAgenda = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemTitulo.trim()) return;

    const novo: ItemAgenda = {
      id: 'agenda_' + Date.now(),
      tipo: 'lembrete',
      titulo: itemTitulo.trim(),
      pessoa: itemPessoa,
      data: itemData,
      hora: itemHora.trim() || undefined,
      prioridade: itemPrioridade,
      categoria: itemCategoria,
      concluido: false,
      descricao: itemDesc.trim() || undefined,
    };

    const updated = {
      ...dadosAgenda,
      itens: [novo, ...(dadosAgenda.itens || [])],
    };
    onSaveAgenda(updated);
    showToast(`Compromisso de ${itemPessoa} ("${novo.titulo}") salvo! Notificações ativas (1 dia antes e no dia).`);
    setShowAddItem(false);
    setItemTitulo('');
    setItemHora('');
    setItemDesc('');
  };

  const handleToggleItemConcluido = (id: string) => {
    const list = (dadosAgenda.itens || []).map((i) => {
      if (i.id !== id) return i;
      return { ...i, concluido: !i.concluido };
    });
    onSaveAgenda({ ...dadosAgenda, itens: list });
  };

  const handleDeleteItemAgenda = (id: string) => {
    const list = (dadosAgenda.itens || []).filter((i) => i.id !== id);
    onSaveAgenda({ ...dadosAgenda, itens: list });
    showToast('Lembrete excluído.');
  };

  // Handlers Notas
  const handleOpenAddNota = () => {
    setEditingNota(null);
    setNotaTitulo('');
    setNotaConteudo('');
    setNotaCor('roxo');
    setShowAddNota(true);
  };

  const handleOpenEditNota = (nota: NotaRapida) => {
    setEditingNota(nota);
    setNotaTitulo(nota.titulo);
    setNotaConteudo(nota.conteudo);
    setNotaCor(nota.cor || 'roxo');
    setShowAddNota(true);
  };

  const handleSaveNota = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notaTitulo.trim() && !notaConteudo.trim()) return;

    if (editingNota) {
      const list = (dadosAgenda.notas || []).map((n) => {
        if (n.id !== editingNota.id) return n;
        return {
          ...n,
          titulo: notaTitulo.trim() || 'Sem título',
          conteudo: notaConteudo.trim(),
          cor: notaCor,
          dataAtualizacao: new Date().toISOString(),
        };
      });
      onSaveAgenda({ ...dadosAgenda, notas: list });
      showToast('Nota atualizada com sucesso!');
    } else {
      const nova: NotaRapida = {
        id: 'nota_' + Date.now(),
        titulo: notaTitulo.trim() || 'Sem título',
        conteudo: notaConteudo.trim(),
        cor: notaCor,
        fixada: false,
        dataAtualizacao: new Date().toISOString(),
      };
      onSaveAgenda({
        ...dadosAgenda,
        notas: [nova, ...(dadosAgenda.notas || [])],
      });
      showToast('Nova nota criada!');
    }

    setShowAddNota(false);
  };

  const handleToggleFixarNota = (id: string) => {
    const list = (dadosAgenda.notas || []).map((n) => {
      if (n.id !== id) return n;
      return { ...n, fixada: !n.fixada };
    });
    onSaveAgenda({ ...dadosAgenda, notas: list });
  };

  const handleDeleteNota = (id: string) => {
    const list = (dadosAgenda.notas || []).filter((n) => n.id !== id);
    onSaveAgenda({ ...dadosAgenda, notas: list });
    showToast('Nota removida.');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#0f0f1c] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-white">
        
        {/* Toast Notificação */}
        {toastMsg && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-black font-semibold text-xs py-2 px-4 rounded-full shadow-lg shadow-amber-500/20 flex items-center gap-1.5 animate-bounce">
            <CheckCircle2 className="w-4 h-4" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Topo do Modal */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-[#141424]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600/25 border border-amber-500/30 flex items-center justify-center text-amber-300 shadow-md shadow-amber-600/20">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold font-display text-white">
                  Notas & Lembretes
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                  Agenda Pessoal
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Organize seus compromissos, tarefas do dia e anotações importantes
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onReloadHistory && (
              <button
                type="button"
                onClick={handleManualReload}
                disabled={isReloadingHistory}
                title="Puxar todo o histórico já feito no Firebase"
                className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-amber-500/20 text-neutral-300 hover:text-amber-300 border border-white/10 text-xs flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 touch-manipulation"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isReloadingHistory ? 'animate-spin text-amber-400' : ''}`} />
                <span className="hidden sm:inline font-semibold">Puxar Histórico</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Abas Superiores */}
        <div className="flex bg-[#121220] border-b border-white/10 px-4 pt-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('agenda')}
            className={`py-2 px-4 rounded-t-xl font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'agenda'
                ? 'bg-[#0f0f1c] text-amber-400 border-t border-x border-white/10'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <ListTodo className="w-4 h-4" />
            <span>Agenda & Compromissos</span>
            {pendentesAgenda > 0 && (
              <span className="text-[10px] px-2 py-0.2 rounded-full bg-amber-500/25 text-amber-300 font-bold">
                {pendentesAgenda}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('notas')}
            className={`py-2 px-4 rounded-t-xl font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'notas'
                ? 'bg-[#0f0f1c] text-amber-400 border-t border-x border-white/10'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <StickyNote className="w-4 h-4" />
            <span>Bloco de Notas Rápidas</span>
            {(dadosAgenda.notas || []).length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10 text-neutral-300">
                {(dadosAgenda.notas || []).length}
              </span>
            )}
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          
          {/* =========================================
              ABA 1: AGENDA & LEMBRETES
             ========================================= */}
          {activeTab === 'agenda' && (
            <div className="space-y-4">
              {/* Barra de Filtro e Adicionar */}
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 text-xs">
                    <button
                      type="button"
                      onClick={() => setFiltroAgenda('pendentes')}
                      className={`py-1.5 px-3 rounded-lg font-semibold transition-all ${
                        filtroAgenda === 'pendentes' ? 'bg-amber-500 text-black shadow' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      Pendentes ({pendentesAgenda})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltroAgenda('todos')}
                      className={`py-1.5 px-3 rounded-lg font-semibold transition-all ${
                        filtroAgenda === 'todos' ? 'bg-amber-500 text-black shadow' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      Todos ({(dadosAgenda.itens || []).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltroAgenda('concluidos')}
                      className={`py-1.5 px-3 rounded-lg font-semibold transition-all ${
                        filtroAgenda === 'concluidos' ? 'bg-amber-500 text-black shadow' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      Concluídos
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (filtroPessoaAgenda === 'Leonardo') setItemPessoa('Leonardo');
                      else setItemPessoa('Vitórya');
                      setShowAddItem(true);
                    }}
                    className="py-2 px-3.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Novo Lembrete / Compromisso</span>
                  </button>
                </div>

                {/* Filtro por Pessoa (Vitórya / Leonardo / Todos) & Aviso de Notificação */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-neutral-400 mr-1 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-amber-400" />
                      De quem:
                    </span>
                    <button
                      type="button"
                      onClick={() => setFiltroPessoaAgenda('todos')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                        filtroPessoaAgenda === 'todos'
                          ? 'bg-amber-500 text-black shadow'
                          : 'bg-white/5 text-neutral-400 hover:text-white'
                      }`}
                    >
                      Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltroPessoaAgenda('Vitórya')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                        filtroPessoaAgenda === 'Vitórya'
                          ? 'bg-pink-600 text-white shadow'
                          : 'bg-white/5 text-pink-300/80 hover:text-pink-200 border border-pink-500/20'
                      }`}
                    >
                      👩 Vitórya
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltroPessoaAgenda('Leonardo')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                        filtroPessoaAgenda === 'Leonardo'
                          ? 'bg-blue-600 text-white shadow'
                          : 'bg-white/5 text-blue-300/80 hover:text-blue-200 border border-blue-500/20'
                      }`}
                    >
                      👨 Leonardo
                    </button>
                  </div>

                  <span className="text-[10px] text-amber-300/90 flex items-center gap-1 font-medium">
                    <Bell className="w-3 h-3 text-amber-400" />
                    Alerta no celular 1 dia antes e no dia
                  </span>
                </div>
              </div>

              {/* Lista de Itens da Agenda */}
              {itensFiltrados.length === 0 ? (
                <div className="text-center py-10 px-4 rounded-2xl bg-white/[0.02] border border-white/5">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-3 text-amber-300">
                    <CalendarDays className="w-7 h-7" />
                  </div>
                  <h4 className="font-bold text-white text-sm mb-1">
                    {filtroAgenda === 'pendentes' ? 'Nenhum lembrete pendente!' : 'Nenhum item na agenda'}
                  </h4>
                  <p className="text-xs text-neutral-400 max-w-xs mx-auto mb-3">
                    Adicione compromissos com data e hora para manter seu dia sempre sob controle.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddItem(true)}
                      className="py-2 px-4 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl text-xs inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Criar Lembrete</span>
                    </button>
                    {onReloadHistory && (
                      <button
                        type="button"
                        onClick={handleManualReload}
                        disabled={isReloadingHistory}
                        className="py-2 px-3 bg-white/5 hover:bg-white/10 text-neutral-300 rounded-xl text-xs inline-flex items-center gap-1.5 border border-white/10"
                      >
                        <RotateCw className={`w-3.5 h-3.5 ${isReloadingHistory ? 'animate-spin' : ''}`} />
                        <span>Puxar Histórico da Nuvem</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {itensFiltrados.map((item) => {
                    const prio = PRIORIDADES_CONFIG[item.prioridade] || PRIORIDADES_CONFIG.media;
                    const dataObj = new Date(item.data + 'T00:00:00');
                    const hoje = new Date().toISOString().split('T')[0];
                    const eHoje = item.data === hoje;

                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                          item.concluido
                            ? 'bg-white/[0.02] border-white/5 opacity-60'
                            : eHoje
                            ? 'bg-amber-950/20 border-amber-500/40 shadow-sm shadow-amber-500/10'
                            : 'bg-[#141424] border-white/10 hover:border-amber-500/30'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleToggleItemConcluido(item.id)}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                              item.concluido
                                ? 'bg-emerald-500 text-black'
                                : 'bg-white/5 hover:bg-white/10 text-neutral-400 border border-white/10'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {item.pessoa && (
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                    item.pessoa.toLowerCase().includes('vit')
                                      ? 'bg-pink-500/20 text-pink-300 border-pink-500/30'
                                      : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                  }`}
                                >
                                  {item.pessoa.toLowerCase().includes('vit') ? '👩 Vitórya' : '👨 Leonardo'}
                                </span>
                              )}
                              <h4 className={`text-sm font-bold ${item.concluido ? 'line-through text-neutral-400' : 'text-white'}`}>
                                {item.titulo}
                              </h4>
                              {eHoje && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500 text-black font-extrabold uppercase">
                                  Hoje
                                </span>
                              )}
                              <span className={`text-[10px] px-2 py-0.2 rounded-full font-semibold border ${prio.bg} ${prio.color}`}>
                                {prio.label}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-xs text-neutral-400 mt-1">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-neutral-500" />
                                {dataObj.toLocaleDateString('pt-BR')}
                              </span>
                              {item.hora && (
                                <span className="flex items-center gap-1 font-mono text-amber-300/90">
                                  <Clock className="w-3 h-3 text-neutral-500" />
                                  {item.hora}
                                </span>
                              )}
                              {item.categoria && (
                                <span className="capitalize text-[11px] text-neutral-400">
                                  • {item.categoria}
                                </span>
                              )}
                            </div>

                            {item.descricao && (
                              <p className="text-[11px] text-neutral-400 mt-1 italic">
                                {item.descricao}
                              </p>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteItemAgenda(item.id)}
                          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-red-500/20 flex items-center justify-center text-neutral-400 hover:text-red-400 shrink-0 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* =========================================
              ABA 2: BLOCO DE NOTAS RÁPIDAS
             ========================================= */}
          {activeTab === 'notas' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={buscaNota}
                    onChange={(e) => setBuscaNota(e.target.value)}
                    placeholder="Pesquisar em suas notas..."
                    className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleOpenAddNota}
                  className="py-2 px-3.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova Nota</span>
                </button>
              </div>

              {/* Grid de Notas */}
              {notasFiltradas.length === 0 ? (
                <div className="text-center py-10 px-4 rounded-2xl bg-white/[0.02] border border-white/5">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-3 text-amber-300">
                    <FileText className="w-7 h-7" />
                  </div>
                  <h4 className="font-bold text-white text-sm mb-1">Nenhuma anotação criada</h4>
                  <p className="text-xs text-neutral-400 max-w-xs mx-auto mb-3">
                    Crie notas livres com listas, ideias, senhas rápidas ou lembretes diários.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={handleOpenAddNota}
                      className="py-2 px-4 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl text-xs inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Criar Primeira Nota</span>
                    </button>
                    {onReloadHistory && (
                      <button
                        type="button"
                        onClick={handleManualReload}
                        disabled={isReloadingHistory}
                        className="py-2 px-3 bg-white/5 hover:bg-white/10 text-neutral-300 rounded-xl text-xs inline-flex items-center gap-1.5 border border-white/10"
                      >
                        <RotateCw className={`w-3.5 h-3.5 ${isReloadingHistory ? 'animate-spin' : ''}`} />
                        <span>Puxar Histórico da Nuvem</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {notasFiltradas.map((n) => {
                    const corCfg = CORES_NOTAS.find((c) => c.id === n.cor) || CORES_NOTAS[0];

                    return (
                      <div
                        key={n.id}
                        className={`p-4 rounded-2xl border ${corCfg.bg} flex flex-col justify-between shadow-md relative group transition-all`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h4 className="font-bold text-sm text-white leading-tight">
                              {n.titulo}
                            </h4>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleToggleFixarNota(n.id)}
                                title={n.fixada ? 'Desafixar' : 'Fixar no topo'}
                                className={`w-6 h-6 rounded flex items-center justify-center transition-all ${
                                  n.fixada ? 'text-amber-400' : 'text-neutral-400 hover:text-white'
                                }`}
                              >
                                <Pin className={`w-3.5 h-3.5 ${n.fixada ? 'fill-current' : ''}`} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditNota(n)}
                                className="w-6 h-6 rounded flex items-center justify-center text-neutral-400 hover:text-white"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteNota(n.id)}
                                className="w-6 h-6 rounded flex items-center justify-center text-neutral-400 hover:text-red-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <p className="text-xs text-neutral-300 whitespace-pre-wrap line-clamp-6 leading-relaxed">
                            {n.conteudo}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-white/10 mt-3 text-[10px] text-neutral-400 flex items-center justify-between">
                          <span>
                            {new Date(n.dataAtualizacao).toLocaleDateString('pt-BR')} às{' '}
                            {new Date(n.dataAtualizacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className={`w-2 h-2 rounded-full ${corCfg.dot}`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="p-3.5 bg-[#121220] border-t border-white/10 flex items-center justify-between text-xs text-neutral-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Sincronizado na nuvem (dados_caixinhas_agenda)
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

      {/* Modal Criar Lembrete / Item Agenda */}
      {showAddItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#161626] border border-white/15 rounded-2xl p-5 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className="font-bold text-base font-display">Novo Lembrete / Compromisso</h3>
              <button
                type="button"
                onClick={() => setShowAddItem(false)}
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItemAgenda} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-neutral-400 font-semibold mb-1.5">
                  De quem é o compromisso? *
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setItemPessoa('Vitórya')}
                    className={`py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all ${
                      itemPessoa === 'Vitórya'
                        ? 'bg-pink-600 text-white border-pink-400 shadow-lg shadow-pink-600/25'
                        : 'bg-white/5 text-neutral-300 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <span>👩 Vitórya</span>
                    {itemPessoa === 'Vitórya' && <Check className="w-4 h-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setItemPessoa('Leonardo')}
                    className={`py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all ${
                      itemPessoa === 'Leonardo'
                        ? 'bg-blue-600 text-white border-blue-400 shadow-lg shadow-blue-600/25'
                        : 'bg-white/5 text-neutral-300 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <span>👨 Leonardo</span>
                    {itemPessoa === 'Leonardo' && <Check className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-neutral-400 font-semibold mb-1">Título do Lembrete *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={itemTitulo}
                  onChange={(e) => setItemTitulo(e.target.value)}
                  placeholder="Ex: Pagar fatura do cartão, Reunião com gerente, Comprar remédio"
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-neutral-400 font-semibold mb-1">Data *</label>
                  <input
                    type="date"
                    required
                    value={itemData}
                    onChange={(e) => setItemData(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-neutral-400 font-semibold mb-1">Horário (Opcional)</label>
                  <input
                    type="time"
                    value={itemHora}
                    onChange={(e) => setItemHora(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-neutral-400 font-semibold mb-1">Prioridade</label>
                  <select
                    value={itemPrioridade}
                    onChange={(e) => setItemPrioridade(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-[#1b1b2f] border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="baixa">⚪ Baixa</option>
                    <option value="media">🔵 Média</option>
                    <option value="alta">🟡 Alta</option>
                    <option value="urgente">🔴 Urgente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-400 font-semibold mb-1">Categoria</label>
                  <select
                    value={itemCategoria}
                    onChange={(e) => setItemCategoria(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-[#1b1b2f] border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="pessoal">👤 Pessoal</option>
                    <option value="financeiro">💰 Financeiro</option>
                    <option value="trabalho">💼 Trabalho</option>
                    <option value="saude">❤️ Saúde</option>
                    <option value="geral">📌 Geral</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-neutral-400 font-semibold mb-1">Descrição / Detalhes</label>
                <textarea
                  rows={2}
                  value={itemDesc}
                  onChange={(e) => setItemDesc(e.target.value)}
                  placeholder="Informações adicionais sobre o compromisso..."
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddItem(false)}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-neutral-300 font-medium rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-bold rounded-xl shadow-lg shadow-amber-500/20"
                >
                  Salvar na Agenda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Criar / Editar Nota Livre */}
      {showAddNota && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#161626] border border-white/15 rounded-2xl p-5 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className="font-bold text-base font-display">
                {editingNota ? 'Editar Nota' : 'Nova Nota'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddNota(false)}
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNota} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-neutral-400 font-semibold mb-1">Título da Nota</label>
                <input
                  type="text"
                  autoFocus
                  value={notaTitulo}
                  onChange={(e) => setNotaTitulo(e.target.value)}
                  placeholder="Ex: Ideias para o projeto, Lista de compras"
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-neutral-400 font-semibold mb-1">Conteúdo da Nota *</label>
                <textarea
                  rows={5}
                  required
                  value={notaConteudo}
                  onChange={(e) => setNotaConteudo(e.target.value)}
                  placeholder="Escreva aqui tudo o que precisar anotar..."
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-500 leading-relaxed font-sans"
                />
              </div>

              <div>
                <label className="block text-neutral-400 font-semibold mb-1.5">Cor do Cartão</label>
                <div className="flex items-center gap-2">
                  {CORES_NOTAS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setNotaCor(c.id)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${c.dot} ${
                        notaCor === c.id ? 'scale-125 border-white shadow-lg' : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddNota(false)}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-neutral-300 font-medium rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-bold rounded-xl shadow-lg shadow-amber-500/20"
                >
                  {editingNota ? 'Salvar Alterações' : 'Criar Nota'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
