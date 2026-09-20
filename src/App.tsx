import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Filter,
  Plus,
  RefreshCw,
  TrendingUp,
  History,
  ShieldCheck,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Layers,
} from 'lucide-react';
import { Conta, LogAtividade, UserProfile, FiltroContas } from './types';
import {
  auth,
  onAuthStateChanged,
  subscribeToFinancialData,
  saveFinancialDataToCloud,
  subscribeToUserProfile,
  saveUserProfileToCloud,
  signOut,
} from './lib/firebase';
import { getMesAno, proximoMes, isoParaBR, formatCurrency } from './lib/utils';
import { Header } from './components/Header';
import { MonthGroup } from './components/MonthGroup';
import { BottomNav } from './components/BottomNav';
import { LockScreen } from './components/LockScreen';
import { AddEditModal } from './components/AddEditModal';
import { PaymentModal } from './components/PaymentModal';
import { SecurityChallengeModal } from './components/SecurityChallengeModal';
import { CalculatorModal } from './components/CalculatorModal';
import { CashFlowModal } from './components/CashFlowModal';
import { ActivityLogsModal } from './components/ActivityLogsModal';
import { SettingsModal } from './components/SettingsModal';

export default function App() {
  // Estado de bloqueio / autenticação
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [isCloudSynced, setIsCloudSynced] = useState<boolean>(false);

  // Perfil do usuário
  const [profile, setProfile] = useState<UserProfile>(() => {
    const savedName = localStorage.getItem('nomePerfil') || 'Sutello';
    const savedFoto = localStorage.getItem('fotoPerfil') || '';
    const savedBio = localStorage.getItem('biometriaAtivada') === 'true';
    const savedPin = localStorage.getItem('pinAcesso') || '2007';
    return {
      nome: savedName,
      fotoPerfil: savedFoto,
      biometriaAtivada: savedBio,
      pinAcesso: savedPin,
    };
  });

  // Dados principais
  const [contas, setContas] = useState<Conta[]>(() => {
    try {
      const saved = localStorage.getItem('contas');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [logs, setLogs] = useState<LogAtividade[]>(() => {
    try {
      const saved = localStorage.getItem('logs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Filtros e busca
  const [filtro, setFiltro] = useState<FiltroContas>('todas');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isPrivate, setIsPrivate] = useState<boolean>(() => {
    return localStorage.getItem('modoPrivado') === 'true';
  });

  // Modais
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [contaToEdit, setContaToEdit] = useState<Conta | null>(null);

  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [contaToPay, setContaToPay] = useState<Conta | null>(null);

  const [isChallengeOpen, setIsChallengeOpen] = useState(false);
  const [challengeAction, setChallengeAction] = useState({
    name: '',
    callback: () => {},
  });

  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [isFlowOpen, setIsFlowOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // 1. Monitorar estado de autenticação do Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (user) {
        setIsCloudSynced(true);
        // Sincroniza em tempo real dados da nuvem
        const unsubData = subscribeToFinancialData(user.uid, (cloudContas, cloudLogs) => {
          if (cloudContas && cloudContas.length > 0) {
            setContas(cloudContas);
            localStorage.setItem('contas', JSON.stringify(cloudContas));
          }
          if (cloudLogs && cloudLogs.length > 0) {
            setLogs(cloudLogs);
            localStorage.setItem('logs', JSON.stringify(cloudLogs));
          }
        });

        // Sincroniza em tempo real perfil da nuvem
        const unsubProfile = subscribeToUserProfile(user.uid, (cloudProfile) => {
          setProfile((prev) => {
            const updated = {
              ...prev,
              ...cloudProfile,
              nome: cloudProfile.nome || prev.nome,
              fotoPerfil: cloudProfile.fotoPerfil || prev.fotoPerfil,
            };
            if (cloudProfile.nome) localStorage.setItem('nomePerfil', cloudProfile.nome);
            if (cloudProfile.fotoPerfil) localStorage.setItem('fotoPerfil', cloudProfile.fotoPerfil);
            return updated;
          });
        });

        return () => {
          unsubData();
          unsubProfile();
        };
      } else {
        setIsCloudSynced(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // 2. Persistir localmente e na nuvem
  const saveData = useCallback(
    (newContas: Conta[], newLogs: LogAtividade[]) => {
      setContas(newContas);
      setLogs(newLogs);
      localStorage.setItem('contas', JSON.stringify(newContas));
      localStorage.setItem('logs', JSON.stringify(newLogs));

      if (auth.currentUser) {
        saveFinancialDataToCloud(auth.currentUser.uid, newContas, newLogs);
      }
    },
    []
  );

  const addLog = useCallback(
    (acao: LogAtividade['acao'], detalhe: string, backup?: Conta | null, relatedId?: string | number | null) => {
      setLogs((prevLogs) => {
        const newLog: LogAtividade = {
          id: Date.now() + Math.floor(Math.random() * 1000),
          data: new Date().toISOString(),
          acao,
          detalhe,
          backup: backup ? JSON.parse(JSON.stringify(backup)) : null,
          relatedId,
        };
        const updated = [newLog, ...prevLogs.slice(0, 50)];
        localStorage.setItem('logs', JSON.stringify(updated));
        if (auth.currentUser) {
          saveFinancialDataToCloud(auth.currentUser.uid, contas, updated);
        }
        return updated;
      });
    },
    [contas]
  );

  // 3. Desafio Matemático de Segurança para Ações Críticas
  const requireSecurity = (actionName: string, actionCallback: () => void) => {
    setChallengeAction({
      name: actionName,
      callback: actionCallback,
    });
    setIsChallengeOpen(true);
  };

  // 4. CRUD de Contas
  const handleSaveConta = (contaData: Partial<Conta>) => {
    if (contaToEdit) {
      // Edição
      const updated = contas.map((c) => {
        if (c.id === contaToEdit.id) {
          return {
            ...c,
            ...contaData,
          } as Conta;
        }
        return c;
      });
      addLog('EDITADO', `Editou conta: ${contaData.nome}`);
      saveData(updated, logs);
    } else {
      // Nova conta
      const nova: Conta = {
        id: `conta_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        nome: contaData.nome || 'Sem título',
        pagador: contaData.pagador || 'Leonardo',
        valor: contaData.valor || 0,
        valorTotalOriginal: contaData.valorTotalOriginal || null,
        vencimento: contaData.vencimento || new Date().toISOString().split('T')[0],
        paga: false,
        oculta: false,
        recorrente: !!contaData.recorrente,
        totalParcelas: contaData.totalParcelas || null,
        parcelaAtual: contaData.parcelaAtual || (contaData.totalParcelas ? 1 : null),
        codigoPix: contaData.codigoPix || '',
      };
      const updated = [...contas, nova];
      const detalhe = nova.totalParcelas
        ? `${nova.totalParcelas}x de R$ ${nova.valor.toFixed(2)}`
        : `R$ ${nova.valor.toFixed(2)}`;
      addLog('CRIADO', `Conta: ${nova.nome} (${nova.pagador}) - ${detalhe}`);
      saveData(updated, logs);
    }
  };

  // Pagar total
  const handlePayFull = (conta: Conta) => {
    const backup = JSON.parse(JSON.stringify(conta));
    let idNova: string | null = null;
    let contasAtualizadas = contas.map((c) => {
      if (c.id === conta.id) {
        return {
          ...c,
          paga: true,
          dataPagamento: new Date().toISOString().split('T')[0],
        };
      }
      return c;
    });

    // Se for recorrente ou parcelada (e ainda restam parcelas), gera próxima
    if (conta.recorrente || (conta.totalParcelas && conta.totalParcelas > 0)) {
      let deveCriarProxima = true;
      if (conta.totalParcelas && conta.totalParcelas > 0) {
        if ((conta.parcelaAtual || 1) >= conta.totalParcelas) {
          deveCriarProxima = false;
        }
      }

      if (deveCriarProxima) {
        const novaConta: Conta = {
          ...conta,
          id: `conta_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          paga: false,
          dataPagamento: null,
          vencimento: proximoMes(conta.vencimento),
          parcelaAtual: (conta.parcelaAtual || 1) + 1,
        };
        idNova = String(novaConta.id);
        contasAtualizadas = [...contasAtualizadas, novaConta];
      }
    }

    addLog('PAGO', `Pagou ${conta.nome} - R$ ${conta.valor.toFixed(2)}`, backup, idNova);
    saveData(contasAtualizadas, logs);
  };

  // Pagar parcial
  const handlePayPartial = (conta: Conta, valorPago: number, jogarRestanteProximoMes: boolean) => {
    const backup = JSON.parse(JSON.stringify(conta));
    const restante = Math.max(0, conta.valor - valorPago);

    // Cria registro do valor pago hoje
    const novaParcialPaga: Conta = {
      ...conta,
      id: `conta_parcial_${Date.now()}`,
      nome: `${conta.nome} (Parcial)`,
      valor: valorPago,
      paga: true,
      dataPagamento: new Date().toISOString().split('T')[0],
    };

    // Atualiza a conta original com o valor restante
    const contasAtualizadas = contas.map((c) => {
      if (c.id === conta.id) {
        return {
          ...c,
          valor: restante,
          vencimento: jogarRestanteProximoMes ? proximoMes(c.vencimento) : c.vencimento,
        };
      }
      return c;
    });

    const finalLista = [...contasAtualizadas, novaParcialPaga];
    addLog(
      'PARCIAL',
      `Pagou R$ ${valorPago.toFixed(2)} de ${conta.nome}, restou R$ ${restante.toFixed(2)}`,
      backup,
      novaParcialPaga.id
    );
    saveData(finalLista, logs);
  };

  // Reverter pagamento
  const handleUndoPay = (conta: Conta) => {
    requireSecurity('DESFAZER PAGAMENTO', () => {
      const backup = JSON.parse(JSON.stringify(conta));
      const updated = contas.map((c) => {
        if (c.id === conta.id) {
          return {
            ...c,
            paga: false,
            dataPagamento: null,
          };
        }
        return c;
      });
      addLog('ESTORNO', `Reverteu pagamento de ${conta.nome}`, backup);
      saveData(updated, logs);
    });
  };

  // Excluir conta
  const handleDeleteConta = (conta: Conta) => {
    requireSecurity('EXCLUIR CONTA', () => {
      const backup = JSON.parse(JSON.stringify(conta));
      const updated = contas.filter((c) => c.id !== conta.id);
      addLog('EXCLUÍDO', `Apagou a conta ${conta.nome}`, backup);
      saveData(updated, logs);
    });
  };

  // Adiar conta
  const handlePostponeConta = (conta: Conta) => {
    requireSecurity('ADIAR VENCIMENTO', () => {
      const backup = JSON.parse(JSON.stringify(conta));
      const novaData = proximoMes(conta.vencimento);
      const updated = contas.map((c) => {
        if (c.id === conta.id) {
          return {
            ...c,
            vencimento: novaData,
          };
        }
        return c;
      });
      addLog('ADIADO', `Adiou ${conta.nome} para ${isoParaBR(novaData)}`, backup);
      saveData(updated, logs);
    });
  };

  // Clonar conta
  const handleCloneConta = (conta: Conta) => {
    const nova: Conta = {
      ...conta,
      id: `conta_clone_${Date.now()}`,
      nome: `${conta.nome} (Cópia)`,
      paga: false,
      dataPagamento: null,
    };
    const updated = [...contas, nova];
    addLog('CRIADO', `Clonou a conta ${conta.nome}`);
    saveData(updated, logs);
  };

  // Copiar código Pix
  const handleCopyPix = (conta: Conta) => {
    if (conta.codigoPix) {
      navigator.clipboard.writeText(conta.codigoPix);
      alert('Código Pix copiado para a área de transferência! 📋');
    } else {
      const novoPix = prompt('Cole aqui o código Pix para salvar nesta conta:');
      if (novoPix && novoPix.trim()) {
        const updated = contas.map((c) => {
          if (c.id === conta.id) {
            return { ...c, codigoPix: novoPix.trim() };
          }
          return c;
        });
        saveData(updated, logs);
        alert('Código Pix salvo com sucesso!');
      }
    }
  };

  // Desfazer ação pelo histórico de logs
  const handleUndoLog = (log: LogAtividade) => {
    if (!log.backup) return;
    if (!confirm(`Deseja desfazer a ação "${log.acao}: ${log.detalhe}"?`)) return;

    let novaLista = [...contas];

    if (log.acao === 'EXCLUÍDO') {
      novaLista.push(log.backup);
    } else if (log.relatedId) {
      novaLista = novaLista.filter((c) => String(c.id) !== String(log.relatedId));
      const idxOrig = novaLista.findIndex((c) => String(c.id) === String(log.backup?.id));
      if (idxOrig !== -1) {
        novaLista[idxOrig] = log.backup;
      } else {
        novaLista.push(log.backup);
      }
    } else {
      const idx = novaLista.findIndex((c) => String(c.id) === String(log.backup?.id));
      if (idx !== -1) {
        novaLista[idx] = log.backup;
      } else {
        novaLista.push(log.backup);
      }
    }

    const logsAtualizados = logs.filter((l) => l.id !== log.id);
    saveData(novaLista, logsAtualizados);
    alert('Ação desfeita com sucesso!');
  };

  // Limpeza de logs
  const handleClearLogs = (mode: 'hoje' | 'mes' | 'tudo') => {
    if (!confirm('Deseja realmente limpar estes registros de atividade?')) return;
    if (mode === 'tudo') {
      saveData(contas, []);
    } else if (mode === 'hoje') {
      const hoje = new Date().toISOString().split('T')[0];
      const filtrados = logs.filter((l) => !l.data.startsWith(hoje));
      saveData(contas, filtrados);
    } else if (mode === 'mes') {
      const mesAtual = new Date().toISOString().substring(0, 7);
      const filtrados = logs.filter((l) => !l.data.startsWith(mesAtual));
      saveData(contas, filtrados);
    }
  };

  // Backup JSON
  const handleExportBackup = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({ contas, logs, profile }));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `backup_financeiro_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (parsed && Array.isArray(parsed.contas)) {
          saveData(parsed.contas, parsed.logs || []);
          if (parsed.profile) {
            setProfile(parsed.profile);
            if (auth.currentUser) saveUserProfileToCloud(auth.currentUser.uid, parsed.profile);
          }
          alert('Backup restaurado com sucesso!');
          setIsSettingsOpen(false);
        } else {
          alert('Arquivo de backup inválido.');
        }
      } catch {
        alert('Erro ao ler o arquivo de backup.');
      }
    };
    reader.readAsText(file);
  };

  // Atualizar perfil
  const handleSaveProfile = (newProfile: Partial<UserProfile>) => {
    setProfile((prev) => {
      const updated = { ...prev, ...newProfile };
      localStorage.setItem('nomePerfil', updated.nome);
      localStorage.setItem('fotoPerfil', updated.fotoPerfil);
      localStorage.setItem('biometriaAtivada', String(updated.biometriaAtivada));
      localStorage.setItem('pinAcesso', updated.pinAcesso);

      if (auth.currentUser) {
        saveUserProfileToCloud(auth.currentUser.uid, updated);
      }
      return updated;
    });
  };

  // Alternar modo privado
  const togglePrivacy = () => {
    setIsPrivate((prev) => {
      const next = !prev;
      localStorage.setItem('modoPrivado', String(next));
      return next;
    });
  };

  // Logout / Bloqueio
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error(e);
    }
    setIsUnlocked(false);
    setIsSettingsOpen(false);
  };

  // 5. Agrupamento por Mês e Filtros
  const gruposMes = useMemo(() => {
    const termo = searchTerm.trim().toLowerCase();

    // Filtra contas
    const contasFiltradas = contas.filter((c) => {
      if (termo && !c.nome.toLowerCase().includes(termo) && !c.pagador?.toLowerCase().includes(termo)) {
        return false;
      }
      if (c.oculta && !c.paga) return false;

      if (filtro === 'pagas') return c.paga;
      if (filtro === 'pendentes') return !c.paga;
      if (filtro === 'atrasadas') {
        if (c.paga) return false;
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const venc = new Date(`${c.vencimento}T12:00:00`);
        return venc.getTime() < hoje.getTime();
      }
      return true; // todas
    });

    // Agrupa por Mês (MM/AAAA)
    const mapMeses: { [mes: string]: Conta[] } = {};
    const ordenadas = [...contasFiltradas].sort(
      (a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime()
    );

    ordenadas.forEach((c) => {
      const mesKey = getMesAno(c.vencimento);
      if (!mapMeses[mesKey]) mapMeses[mesKey] = [];
      mapMeses[mesKey].push(c);
    });

    return mapMeses;
  }, [contas, filtro, searchTerm]);

  // Estatísticas gerais
  const statsGerais = useMemo(() => {
    let totalPendente = 0;
    let totalPago = 0;
    let qtdAtrasadas = 0;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    contas.forEach((c) => {
      if (c.oculta && !c.paga) return;
      if (c.paga) {
        totalPago += c.valor;
      } else {
        totalPendente += c.valor;
        const venc = new Date(`${c.vencimento}T12:00:00`);
        if (venc.getTime() < hoje.getTime()) qtdAtrasadas++;
      }
    });

    return { totalPendente, totalPago, qtdAtrasadas };
  }, [contas]);

  // Se o app estiver bloqueado, exibe tela de segurança (LockScreen)
  if (!isUnlocked) {
    return (
      <LockScreen
        onUnlock={() => setIsUnlocked(true)}
        configuredPin={profile.pinAcesso || '2007'}
        isFirebaseAuthenticated={!!firebaseUser}
        userEmail={firebaseUser?.email}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#08080f] text-neutral-100 flex flex-col font-sans pb-24">
      {/* Header Superior */}
      <Header
        profile={profile}
        isPrivate={isPrivate}
        isCloudSynced={isCloudSynced}
        onTogglePrivacy={togglePrivacy}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLockApp={() => setIsUnlocked(false)}
      />

      {/* Conteúdo Principal */}
      <main className="flex-1 w-full max-w-lg mx-auto px-4 pt-4 space-y-4">
        {/* Barra de Busca e Atalhos */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar conta ou pagador..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#121222] border border-white/10 rounded-2xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setContaToEdit(null);
              setIsAddEditOpen(true);
            }}
            className="h-10 px-4 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-purple-600/25 active:scale-95 transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nova Conta</span>
          </button>
        </div>

        {/* Cards de Resumo Geral */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <div className="bg-[#121222] border border-white/5 rounded-2xl p-3.5">
            <span className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider block">
              Total Pendente
            </span>
            <span
              className={`text-base sm:text-lg font-bold font-display text-red-400 ${
                isPrivate ? 'privacy-blur' : ''
              }`}
            >
              {formatCurrency(statsGerais.totalPendente, isPrivate)}
            </span>
          </div>

          <div className="bg-[#121222] border border-white/5 rounded-2xl p-3.5">
            <span className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider block">
              Total Pago
            </span>
            <span
              className={`text-base sm:text-lg font-bold font-display text-emerald-400 ${
                isPrivate ? 'privacy-blur' : ''
              }`}
            >
              {formatCurrency(statsGerais.totalPago, isPrivate)}
            </span>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-[#121222] border border-white/5 rounded-2xl p-3.5 flex items-center justify-between sm:flex-col sm:items-start">
            <span className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider block">
              Atrasadas
            </span>
            <span
              className={`text-base sm:text-lg font-bold font-display ${
                statsGerais.qtdAtrasadas > 0 ? 'text-amber-400' : 'text-neutral-400'
              }`}
            >
              {statsGerais.qtdAtrasadas} {statsGerais.qtdAtrasadas === 1 ? 'conta' : 'contas'}
            </span>
          </div>
        </div>

        {/* Filtros em Pílulas */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {(
            [
              { id: 'todas', label: 'Todas' },
              { id: 'pendentes', label: 'Pendentes' },
              { id: 'pagas', label: 'Pagas' },
              { id: 'atrasadas', label: 'Atrasadas' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFiltro(item.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                filtro === item.id
                  ? 'bg-purple-600 border-purple-500 text-white shadow-sm shadow-purple-600/30'
                  : 'bg-[#121222] border-white/10 text-neutral-400 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Lista de Grupos por Mês */}
        <div className="space-y-4">
          {Object.keys(gruposMes).length === 0 ? (
            <div className="bg-[#121222]/50 border border-white/5 rounded-2xl p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white/5 mx-auto flex items-center justify-center text-neutral-500">
                <CreditCard className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-neutral-300">Nenhuma conta encontrada</h3>
              <p className="text-xs text-neutral-500 max-w-xs mx-auto">
                {searchTerm
                  ? 'Tente buscar com outro termo ou alterar os filtros acima.'
                  : 'Comece adicionando sua primeira conta ou despesa parcelada.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setContaToEdit(null);
                  setIsAddEditOpen(true);
                }}
                className="py-2 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-md"
              >
                <Plus className="w-4 h-4" />
                Criar Nova Conta
              </button>
            </div>
          ) : (
            Object.keys(gruposMes).map((mes) => (
              <MonthGroup
                key={mes}
                mes={mes}
                contas={gruposMes[mes]}
                isPrivate={isPrivate}
                onPay={(c) => {
                  setContaToPay(c);
                  setIsPaymentOpen(true);
                }}
                onUndoPay={handleUndoPay}
                onEdit={(c) => {
                  requireSecurity('EDITAR CONTA', () => {
                    setContaToEdit(c);
                    setIsAddEditOpen(true);
                  });
                }}
                onPostpone={handlePostponeConta}
                onClone={handleCloneConta}
                onDelete={handleDeleteConta}
                onCopyPix={handleCopyPix}
                onShareWhatsApp={(c) => {
                  import('./lib/utils').then(({ compartilharIndividualWhatsApp }) => {
                    compartilharIndividualWhatsApp(c);
                  });
                }}
                onDownloadReceipt={(c) => {
                  import('./lib/utils').then(({ gerarComprovanteIndividualPdf }) => {
                    gerarComprovanteIndividualPdf(c, profile.nome);
                  });
                }}
              />
            ))
          )}
        </div>
      </main>

      {/* Navegação Inferior Fixa */}
      <BottomNav
        onOpenAdd={() => {
          setContaToEdit(null);
          setIsAddEditOpen(true);
        }}
        onOpenHistory={() => setIsLogsOpen(true)}
        onOpenCalc={() => setIsCalcOpen(true)}
        onOpenFlow={() => setIsFlowOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Modais Globais */}
      <AddEditModal
        isOpen={isAddEditOpen}
        contaToEdit={contaToEdit}
        onSave={handleSaveConta}
        onClose={() => {
          setIsAddEditOpen(false);
          setContaToEdit(null);
        }}
      />

      <PaymentModal
        isOpen={isPaymentOpen}
        conta={contaToPay}
        onPayFull={(c) => {
          requireSecurity('PAGAR MÊS ATUAL', () => handlePayFull(c));
        }}
        onPayPartial={(c, val, prox) => {
          requireSecurity('PAGAMENTO PARCIAL', () => handlePayPartial(c, val, prox));
        }}
        onClose={() => {
          setIsPaymentOpen(false);
          setContaToPay(null);
        }}
      />

      <SecurityChallengeModal
        isOpen={isChallengeOpen}
        actionName={challengeAction.name}
        onConfirm={() => {
          setIsChallengeOpen(false);
          challengeAction.callback();
        }}
        onCancel={() => setIsChallengeOpen(false)}
      />

      <CalculatorModal isOpen={isCalcOpen} onClose={() => setIsCalcOpen(false)} />

      <CashFlowModal
        isOpen={isFlowOpen}
        contas={contas}
        isPrivate={isPrivate}
        onClose={() => setIsFlowOpen(false)}
      />

      <ActivityLogsModal
        isOpen={isLogsOpen}
        logs={logs}
        onUndo={handleUndoLog}
        onClear={handleClearLogs}
        onClose={() => setIsLogsOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        profile={profile}
        userEmail={firebaseUser?.email}
        onSaveProfile={handleSaveProfile}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
        onLogout={handleLogout}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
