import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Search,
  Filter,
  Plus,
  Eye,
  EyeOff,
  Sun,
  Moon,
  RefreshCw,
  TrendingUp,
  History,
  ShieldCheck,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Layers,
  Package,
  Heart,
  Calendar,
  Handshake,
  PiggyBank,
} from 'lucide-react';
import {
  Conta,
  LogAtividade,
  UserProfile,
  FiltroContas,
  NotificacaoAlerta,
  MensagemTransmissao,
  Acordo,
  DividaLimpaNome,
  Caixinha,
  TransacaoCaixinha,
  DadosSaude,
  DadosAgenda,
} from './types';
import {
  auth,
  onAuthStateChangedSafe,
  subscribeToFinancialData,
  fetchFinancialDataFromCloud,
  saveFinancialDataToCloud,
  saveAcordosToCloud,
  subscribeToLimpaNomeData,
  subscribeToLimpaNomeDividas,
  fetchFullLimpaNomeDividasFromFirebase,
  saveLimpaNomeDividas,
  subscribeToUserProfile,
  saveUserProfileToCloud,
  subscribeToCaixinhasData,
  saveCaixinhasToCloud,
  reloadCaixinhasHistoryFromFirebase,
  subscribeToSaudeData,
  saveSaudeToCloud,
  reloadSaudeHistoryFromFirebase,
  subscribeToAgendaData,
  saveAgendaToCloud,
  reloadAgendaHistoryFromFirebase,
  subscribeToGlobalBroadcasts,
  markBroadcastViewedAndCleanupInCloud,
  signOut,
  syncPendingDataIfOnline,
  PENDING_SYNC_KEY,
  LAST_LOCAL_UPDATE_KEY,
  getDeviceId,
} from './lib/firebase';
import {
  notifyContaVencida,
  notifyContaVenceHoje,
  notifyContasVencidasAgrupadas,
  notifyContasVenceHojeAgrupadas,
  notifyParcelasConcluidas,
  notifyNovaConta,
  notifyContaPaga,
  notifyBroadcastAdmin,
  notifyAgendaCompromissos,
  checkAndNotifySaudePesagemMensal,
  notifyNovoPesoAdicionado,
  notifyMetaPesoAtingida,
  notifyCaixinhaMetaAtingida,
  checkAndNotifyRemediosHorario,
  notifyAppUpdateAvailable,
  syncBackgroundAlertsWithSW,
  isNativeApkPlatform,
  requestDeviceNotificationPermission,
} from './lib/deviceNotifications';
import {
  AppVersionInfo,
  checkAppUpdateNow,
  subscribeToAppUpdates,
  syncCurrentVersionToCloudIfNeeded,
} from './lib/appUpdater';
import { LocalNotifications } from '@capacitor/local-notifications';
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
import { InstallAppBanner } from './components/InstallAppBanner';
import { NotificationsModal } from './components/NotificationsModal';
import { AdminBroadcastModal } from './components/AdminBroadcastModal';
import { AcordosModal } from './components/AcordosModal';
import { CaixinhasModal } from './components/CaixinhasModal';
import { SaudeModal } from './components/SaudeModal';
import { NotasLembretesModal } from './components/NotasLembretesModal';

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
    const savedRecado = localStorage.getItem('bioPerfil');
    return {
      nome: savedName,
      fotoPerfil: savedFoto,
      biometriaAtivada: savedBio,
      pinAcesso: savedPin,
      bio: savedRecado !== null ? savedRecado : 'Foco, fé e prosperidade ✨',
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

  // Filtros e busca: Inicia com 'pendentes' para mostrar diretamente as contas a pagar na página inicial
  const [filtro, setFiltro] = useState<FiltroContas>('pendentes');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isPrivate, setIsPrivate] = useState<boolean>(() => {
    return localStorage.getItem('modoPrivado') === 'true';
  });

  // Tema Escuro / Claro individual por aparelho (padrão é sempre 'dark')
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('sutello_theme_mode');
    return saved === 'light' ? 'light' : 'dark';
  });
  const [screenshotBlockedAlert, setScreenshotBlockedAlert] = useState<boolean>(false);

  useEffect(() => {
    const rootEl = document.documentElement;
    if (themeMode === 'light') {
      rootEl.classList.add('light-mode');
    } else {
      rootEl.classList.remove('light-mode');
    }
    localStorage.setItem('sutello_theme_mode', themeMode);
  }, [themeMode]);

  const toggleThemeMode = useCallback(() => {
    setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  // Proteção contra Print / Captura e Gravação de Tela igual aplicativo de banco (sem desfocar ao abrir ou tocar na tela)
  useEffect(() => {
    // Certifica-se de que o app sempre abra 100% nítido e fluido
    document.body.classList.remove('screenshot-shield-active');

    let shieldTimer: ReturnType<typeof setTimeout> | null = null;
    let alertTimer: ReturnType<typeof setTimeout> | null = null;

    const triggerAntiPrintShield = () => {
      document.body.classList.add('screenshot-shield-active');
      setScreenshotBlockedAlert(true);
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText('Não foi possível capturar a tela devido à política de segurança.');
        }
      } catch {}
      if (shieldTimer) clearTimeout(shieldTimer);
      if (alertTimer) clearTimeout(alertTimer);

      shieldTimer = setTimeout(() => {
        document.body.classList.remove('screenshot-shield-active');
      }, 2200);
      alertTimer = setTimeout(() => {
        setScreenshotBlockedAlert(false);
      }, 4000);
    };

    // Bloqueia a API de gravação/compartilhamento de tela (getDisplayMedia)
    if (navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function') {
      navigator.mediaDevices.getDisplayMedia = async () => {
        triggerAntiPrintShield();
        throw new DOMException(
          'Não é possível gravar ou capturar a tela por motivos de segurança.',
          'NotAllowedError'
        );
      };
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'PrintScreen' ||
        e.code === 'PrintScreen' ||
        e.key === 'VolumeDown' ||
        e.key === 'AudioVolumeDown' ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'S' || e.key === 's' || e.key === '3' || e.key === '4' || e.key === '5' || e.key === 'I' || e.key === 'i')) ||
        ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P' || e.key === 's' || e.key === 'S')) ||
        e.key === 'F12'
      ) {
        e.preventDefault();
        e.stopPropagation();
        triggerAntiPrintShield();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
        e.preventDefault();
        triggerAntiPrintShield();
      }
    };

    // Detecta gestos de print com 3 dedos no celular (comum em Android / Xiaomi / Samsung / Motorola)
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches && e.touches.length >= 3) {
        triggerAntiPrintShield();
      }
    };

    // Protege contra cópia ou arraste de imagem da tela
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('keyup', handleKeyUp, { capture: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('contextmenu', handleContextMenu);

    return () => {
      if (shieldTimer) clearTimeout(shieldTimer);
      if (alertTimer) clearTimeout(alertTimer);
      document.body.classList.remove('screenshot-shield-active');
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('keyup', handleKeyUp, { capture: true });
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

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
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [transmissoes, setTransmissoes] = useState<MensagemTransmissao[]>([]);
  const [hasAppUpdate, setHasAppUpdate] = useState(false);
  const [remoteAppVersion, setRemoteAppVersion] = useState<AppVersionInfo | null>(null);

  // Módulo de Acordos e Dívidas (Limpa Nome)
  const [isAcordosOpen, setIsAcordosOpen] = useState(false);
  const [dividas, setDividas] = useState<DividaLimpaNome[]>(() => {
    try {
      const saved = localStorage.getItem('sutello_dividas');
      if (saved) return JSON.parse(saved);
      return [];
    } catch {
      return [];
    }
  });
  const [acordos, setAcordos] = useState<Acordo[]>(() => {
    try {
      const saved = localStorage.getItem('sutello_acordos');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Módulo de Caixinhas & Metas (dados_caixinhas)
  const [isCaixinhasOpen, setIsCaixinhasOpen] = useState(false);
  const [caixinhas, setCaixinhas] = useState<Caixinha[]>(() => {
    try {
      const saved = localStorage.getItem('sutello_caixinhas') || localStorage.getItem('dados_caixinhas') || localStorage.getItem('caixinhas');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Módulo de Saúde & Bem-Estar (dados_saude)
  const [isSaudeOpen, setIsSaudeOpen] = useState(false);
  const [saudeInitialTab, setSaudeInitialTab] = useState<'pesoxaltura' | 'remedios' | 'consultas' | 'metricas' | 'cartao'>('pesoxaltura');
  const [dadosSaude, setDadosSaude] = useState<DadosSaude>(() => {
    try {
      const saved = localStorage.getItem('sutello_saude') || localStorage.getItem('dados_saude') || localStorage.getItem('saude') || localStorage.getItem('pesoxaltura');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return { medicamentos: [], consultas: [], metricas: [], historicoPesoAltura: parsed };
        return parsed;
      }
      return { medicamentos: [], consultas: [], metricas: [], historicoPesoAltura: [] };
    } catch {
      return { medicamentos: [], consultas: [], metricas: [], historicoPesoAltura: [] };
    }
  });

  // Módulo de Notas & Lembretes / Agenda (dados_agenda)
  const [isAgendaOpen, setIsAgendaOpen] = useState(false);
  const [dadosAgenda, setDadosAgenda] = useState<DadosAgenda>(() => {
    try {
      const saved = localStorage.getItem('sutello_agenda') || localStorage.getItem('dados_agenda') || localStorage.getItem('agenda') || localStorage.getItem('notas');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return { itens: parsed, notas: [] };
        return parsed;
      }
      return { itens: [], notas: [] };
    } catch {
      return { itens: [], notas: [] };
    }
  });

  // Status de conexão e feedback de sincronização
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [syncToastMessage, setSyncToastMessage] = useState<string | null>(null);

  // IDs de notificações já visualizadas/dispensadas pelo usuário
  const [viewedNotificationIds, setViewedNotificationIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sutello_notificacoes_vistas');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Rastreamento de contas, pesos e caixinhas conhecidas para detectar atualizações em tempo real
  const knownContaIdsRef = useRef<Set<string | number>>(new Set());
  const hasInitializedContasRef = useRef<boolean>(false);
  const knownPesoIdsRef = useRef<Set<string>>(new Set());
  const hasInitializedSaudeRef = useRef<boolean>(false);
  const knownCaixinhaCompletedRef = useRef<Set<string>>(new Set());
  const hasInitializedCaixinhasRef = useRef<boolean>(false);
  const contasRef = useRef<Conta[]>(contas);
  const logsRef = useRef<LogAtividade[]>(logs);

  useEffect(() => {
    contasRef.current = contas;
    if (contas && contas.length > 0 && knownContaIdsRef.current.size === 0) {
      contas.forEach((c) => knownContaIdsRef.current.add(c.id));
    }
  }, [contas]);

  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  // Função central para aplicar ou conciliar dados da nuvem em todos os aparelhos (celular, notebook, PC e PWA na tela inicial)
  const reconcileCloudData = useCallback(
    (
      uid: string,
      cloudContas: Conta[] | undefined,
      cloudLogs: LogAtividade[] | undefined,
      cloudTimestamp: number,
      isFromOtherDevice: boolean,
      cloudExists: boolean = true,
      cloudTransmissoes?: MensagemTransmissao[],
      cloudAcordos?: Acordo[],
      cloudDividas?: DividaLimpaNome[]
    ) => {
      const hasPendingSync = localStorage.getItem(PENDING_SYNC_KEY) === 'true';
      const lastLocalUpdate = Number(localStorage.getItem(LAST_LOCAL_UPDATE_KEY) || '0');

      // Se acabou de criar uma conta nova, não sobe os dados locais da conta anterior!
      const isCreatingNewAccount = localStorage.getItem('sutello_is_creating_new_account') === 'true';
      if (isCreatingNewAccount) {
        localStorage.removeItem('sutello_is_creating_new_account');
        contasRef.current = [];
        logsRef.current = [];
        setContas([]);
        setLogs([]);
        setDividas([]);
        setAcordos([]);
        setCaixinhas([]);
        setDadosSaude({ medicamentos: [], consultas: [], metricas: [], historicoPesoAltura: [] });
        setDadosAgenda({ itens: [], notas: [] });
        return;
      }

      // Caso este aparelho tenha feito alterações locais mais recentes que ainda não subiram para a nuvem:
      if (hasPendingSync && lastLocalUpdate > cloudTimestamp && contasRef.current.length > 0) {
        saveFinancialDataToCloud(uid, contasRef.current, logsRef.current, 'sync_pending').then((ok) => {
          if (ok) {
            setIsCloudSynced(true);
            setSyncToastMessage('☁️ Alterações sincronizadas com todos os seus aparelhos!');
            setTimeout(() => setSyncToastMessage(null), 3500);
          }
        });
        return;
      }

      // Se a resposta inicial do cache local vier vazia antes do servidor responder, não apaga as contas já carregadas
      if (!cloudExists) {
        return;
      }

      if (cloudContas !== undefined) {
        // Evita sobrescrever uma lista já populada por um array vazio transitório do cache se não houve exclusão explícita
        if (cloudContas.length === 0 && contasRef.current.length > 0 && cloudTimestamp === 0) {
          return;
        }

        if (hasInitializedContasRef.current && isFromOtherDevice) {
          // 1. Notifica novas contas adicionadas em outro aparelho (notebook, celular, etc.)
          const recemAdicionadas = cloudContas.filter((c) => !knownContaIdsRef.current.has(c.id));
          recemAdicionadas.forEach((nova) => {
            notifyNovaConta(nova, nova.pagador || 'Outro aparelho');
          });

          // 2. Notifica contas marcadas como pagas em outro aparelho
          cloudContas.forEach((nova) => {
            const anterior = contasRef.current.find((ant) => ant.id === nova.id);
            if (anterior && !anterior.paga && nova.paga) {
              notifyContaPaga(nova, nova.pagador || 'Outro aparelho');
            }
          });

          setSyncToastMessage('🔄 Sincronizado em tempo real com outro aparelho!');
          setTimeout(() => setSyncToastMessage(null), 3500);
        } else {
          hasInitializedContasRef.current = true;
        }

        cloudContas.forEach((c) => knownContaIdsRef.current.add(c.id));

        contasRef.current = cloudContas;
        setContas(cloudContas);
        localStorage.setItem('contas', JSON.stringify(cloudContas));
        if (cloudTimestamp > 0) {
          localStorage.setItem(LAST_LOCAL_UPDATE_KEY, String(cloudTimestamp));
        }
        localStorage.removeItem(PENDING_SYNC_KEY);
      }

      if (cloudLogs !== undefined) {
        logsRef.current = cloudLogs;
        setLogs(cloudLogs);
        localStorage.setItem('logs', JSON.stringify(cloudLogs));
      }

      if (cloudTransmissoes !== undefined) {
        setTransmissoes((prev) => {
          const map = new Map<string, MensagemTransmissao>();
          cloudTransmissoes.forEach((m) => { if (m && m.id) map.set(m.id, m); });
          prev.forEach((m) => { if (m && m.id && !map.has(m.id)) map.set(m.id, m); });
          return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
        });
        try {
          const notifiedBroadcasts: string[] = JSON.parse(localStorage.getItem('sutello_notified_broadcasts') || '[]');
          cloudTransmissoes.forEach((msg) => {
            if (!notifiedBroadcasts.includes(msg.id)) {
              const targetTime = typeof msg.timestampAgendado === 'number' ? msg.timestampAgendado : msg.timestamp;
              const delayMs = targetTime - Date.now();
              const isRecent = Date.now() - targetTime < 1000 * 60 * 60 * 48;

              const extraRich = {
                linkUrl: msg.linkUrl,
                botaoTexto: msg.botaoTexto,
                imagemUrl: msg.imagemUrl,
                targetModal: msg.targetModal,
                targetSaudeTab: msg.targetSaudeTab,
              };

              if (delayMs > 1500 && delayMs <= 1000 * 60 * 60 * 12) {
                setTimeout(() => {
                  notifyBroadcastAdmin(msg.titulo, msg.mensagem, msg.urgencia, msg.id, extraRich);
                  setSyncToastMessage(`📢 ${msg.titulo}: ${msg.mensagem}`);
                  setTimeout(() => setSyncToastMessage(null), 6000);
                }, delayMs);
                notifiedBroadcasts.push(msg.id);
              } else if (delayMs <= 1500 && isRecent) {
                notifyBroadcastAdmin(msg.titulo, msg.mensagem, msg.urgencia, msg.id, extraRich);
                setSyncToastMessage(`📢 ${msg.titulo}: ${msg.mensagem}`);
                setTimeout(() => setSyncToastMessage(null), 6000);
                notifiedBroadcasts.push(msg.id);
              }
            }
          });
          localStorage.setItem('sutello_notified_broadcasts', JSON.stringify(notifiedBroadcasts.slice(-100)));
        } catch {}
      }

      if (Array.isArray(cloudAcordos) && cloudAcordos.length > 0) {
        setAcordos(cloudAcordos);
        try {
          localStorage.setItem('sutello_acordos', JSON.stringify(cloudAcordos));
        } catch {}
      }

      if (Array.isArray(cloudDividas) && cloudDividas.length > 0) {
        setDividas(cloudDividas);
        try {
          localStorage.setItem('sutello_dividas', JSON.stringify(cloudDividas));
        } catch {}
      }
    },
    []
  );

  // 1. Monitorar estado de autenticação do Firebase e sincronização em tempo real entre todos os aparelhos
  useEffect(() => {
    const unsubscribe = onAuthStateChangedSafe((user) => {
      setFirebaseUser(user);
      if (user) {
        const previousUid = localStorage.getItem('sutello_last_uid');
        if (previousUid && previousUid !== user.uid) {
          // Troca de conta: limpa o cache local da conta anterior para não misturar dados entre contas!
          contasRef.current = [];
          logsRef.current = [];
          knownContaIdsRef.current.clear();
          setContas([]);
          setLogs([]);
          setDividas([]);
          setAcordos([]);
          setCaixinhas([]);
          setDadosSaude({ medicamentos: [], consultas: [], metricas: [], historicoPesoAltura: [] });
          setDadosAgenda({ itens: [], notas: [] });
          localStorage.removeItem(PENDING_SYNC_KEY);
          localStorage.setItem('contas', JSON.stringify([]));
          localStorage.setItem('logs', JSON.stringify([]));
          localStorage.setItem('sutello_dividas', JSON.stringify([]));
          localStorage.setItem('sutello_acordos', JSON.stringify([]));
          localStorage.setItem('sutello_caixinhas', JSON.stringify([]));
          localStorage.setItem('sutello_saude', JSON.stringify({ medicamentos: [], consultas: [], metricas: [], historicoPesoAltura: [] }));
          localStorage.setItem('sutello_agenda', JSON.stringify({ itens: [], notas: [] }));
        }
        localStorage.setItem('sutello_last_uid', user.uid);
        setIsCloudSynced(true);

        // Busca imediata de TODOS os módulos direto do servidor ao autenticar (essencial para o App adicionado na Tela Inicial / PWA)
        fetchFinancialDataFromCloud(user.uid).then((res) => {
          if (res) {
            reconcileCloudData(
              user.uid,
              res.contas,
              res.logs,
              res.timestamp,
              false,
              res.exists,
              res.transmissoes,
              res.acordos,
              res.dividas
            );
          }
        });

        fetchFullLimpaNomeDividasFromFirebase(user.uid).then((dList) => {
          if (Array.isArray(dList) && dList.length > 0) {
            setDividas(dList);
          }
        }).catch(() => {});

        reloadCaixinhasHistoryFromFirebase(user.uid).then((cList) => {
          if (Array.isArray(cList) && cList.length > 0) {
            setCaixinhas(cList);
          }
        }).catch(() => {});

        reloadSaudeHistoryFromFirebase(user.uid).then((sData) => {
          if (
            sData &&
            ((sData.historicoPesoAltura?.length || 0) > 0 ||
              (sData.medicamentos?.length || 0) > 0 ||
              (sData.consultas?.length || 0) > 0 ||
              (sData.metricas?.length || 0) > 0)
          ) {
            setDadosSaude(sData);
          }
        }).catch(() => {});

        reloadAgendaHistoryFromFirebase(user.uid).then((aData) => {
          if (aData && ((aData.itens?.length || 0) > 0 || (aData.notas?.length || 0) > 0)) {
            setDadosAgenda(aData);
          }
        }).catch(() => {});

        // Sincroniza em tempo real dados da nuvem entre todos os aparelhos (celular, notebook, PC)
        const unsubData = subscribeToFinancialData(user.uid, (cloudContas, cloudLogs, meta) => {
          const myDeviceId = getDeviceId();
          const isFromOtherDevice = !!(meta?.updatedByDeviceId && meta.updatedByDeviceId !== myDeviceId);

          // Se for um snapshot vazio vindo apenas do cache local antes do servidor responder, ignora para não zerar a tela
          if (meta?.fromCache && (!cloudContas || cloudContas.length === 0) && (meta?.cloudTimestamp || 0) === 0) {
            return;
          }

          // Se for uma escrita pendente local deste mesmo aparelho, não precisa reprocessar
          if (meta?.hasPendingWrites && !isFromOtherDevice) {
            return;
          }

          reconcileCloudData(
            user.uid,
            cloudContas,
            cloudLogs,
            meta?.cloudTimestamp || 0,
            isFromOtherDevice,
            (meta?.cloudTimestamp || 0) > 0 || (cloudContas && cloudContas.length > 0),
            meta?.transmissoes,
            meta?.acordos
          );
        });

        // Sincroniza em tempo real dados da coleção dados_limpanome (exatamente como app.js)
        const unsubLimpaNome = subscribeToLimpaNomeDividas(user.uid, (cloudDividas) => {
          if (Array.isArray(cloudDividas) && cloudDividas.length > 0) {
            setDividas(cloudDividas);
            try {
              localStorage.setItem('sutello_dividas', JSON.stringify(cloudDividas));
            } catch {}
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
              bio: cloudProfile.bio !== undefined ? cloudProfile.bio : prev.bio,
            };
            if (cloudProfile.nome) localStorage.setItem('nomePerfil', cloudProfile.nome);
            if (cloudProfile.fotoPerfil) localStorage.setItem('fotoPerfil', cloudProfile.fotoPerfil);
            if (cloudProfile.bio !== undefined) localStorage.setItem('bioPerfil', cloudProfile.bio);
            return updated;
          });
        });

        // Sincroniza em tempo real caixinhas (dados_caixinhas)
        const unsubCaixinhas = subscribeToCaixinhasData(user.uid, (cloudCaixinhas) => {
          if (Array.isArray(cloudCaixinhas) && cloudCaixinhas.length > 0) {
            if (hasInitializedCaixinhasRef.current) {
              cloudCaixinhas.forEach((cx) => {
                if (cx.meta && cx.meta > 0 && (cx.saldo || 0) >= cx.meta) {
                  if (!knownCaixinhaCompletedRef.current.has(`${cx.id}_${cx.meta}`)) {
                    notifyCaixinhaMetaAtingida(cx);
                  }
                }
              });
            } else {
              hasInitializedCaixinhasRef.current = true;
            }
            cloudCaixinhas.forEach((cx) => {
              if (cx.meta && cx.meta > 0 && (cx.saldo || 0) >= cx.meta) {
                knownCaixinhaCompletedRef.current.add(`${cx.id}_${cx.meta}`);
              }
            });
            setCaixinhas(cloudCaixinhas);
          }
        });

        // Sincroniza em tempo real saúde (dados_saude)
        const unsubSaude = subscribeToSaudeData(user.uid, (cloudSaude) => {
          if (cloudSaude) {
            const listaPesos = cloudSaude.historicoPesoAltura || [];
            if (hasInitializedSaudeRef.current) {
              const novosPesos = listaPesos.filter((p) => p.id && !knownPesoIdsRef.current.has(p.id));
              novosPesos.forEach((novo) => {
                notifyNovoPesoAdicionado(novo);
                // Verifica se atingiu a meta de peso da pessoa
                const nomePessoa = (novo.pessoa || '').toLowerCase().includes('leo') ? 'Leonardo' : 'Vitórya';
                const metas = cloudSaude.metasPorPessoa || cloudSaude.perfilSaude?.metasPorPessoa || {};
                const metaDaPessoa = Number(metas[nomePessoa] || novo.metaPeso || 0);
                if (metaDaPessoa > 0) {
                  const pesosDaPessoa = listaPesos
                    .filter((r) => {
                      const rn = (r.pessoa || '').toLowerCase();
                      return nomePessoa === 'Leonardo' ? rn.includes('leo') : rn.includes('vit') || !r.pessoa;
                    })
                    .sort((a, b) => (a.data + (a.hora || '')).localeCompare(b.data + (b.hora || '')));
                  const pesoInicial = pesosDaPessoa.length > 0 ? pesosDaPessoa[0].peso : novo.peso;
                  const atingiuPerda = pesoInicial >= metaDaPessoa && novo.peso <= metaDaPessoa;
                  const atingiuGanho = pesoInicial < metaDaPessoa && novo.peso >= metaDaPessoa;
                  const exato = Math.abs(novo.peso - metaDaPessoa) <= 0.1;
                  if (atingiuPerda || atingiuGanho || exato) {
                    notifyMetaPesoAtingida(nomePessoa, novo.peso, metaDaPessoa, novo.id);
                  }
                }
              });
            } else if (listaPesos.length > 0) {
              hasInitializedSaudeRef.current = true;
            }
            listaPesos.forEach((p) => {
              if (p.id) knownPesoIdsRef.current.add(p.id);
            });
            setDadosSaude(cloudSaude);
          }
        });

        // Sincroniza em tempo real agenda (dados_agenda)
        const unsubAgenda = subscribeToAgendaData(user.uid, (cloudAgenda) => {
          if (cloudAgenda && ((cloudAgenda.itens?.length || 0) > 0 || (cloudAgenda.notas?.length || 0) > 0)) {
            setDadosAgenda(cloudAgenda);
          }
        });

        // Sincroniza em tempo real transmissões globais para todos os usuários logados com e-mail
        const unsubGlobalBroadcasts = subscribeToGlobalBroadcasts((globalList) => {
          if (Array.isArray(globalList) && globalList.length > 0) {
            reconcileCloudData(user.uid, undefined, undefined, Date.now(), true, true, globalList, undefined);
          }
        });

        return () => {
          unsubData();
          unsubLimpaNome();
          unsubProfile();
          unsubCaixinhas();
          unsubSaude();
          unsubAgenda();
          unsubGlobalBroadcasts();
        };
      } else {
        setIsCloudSynced(false);
      }
    });

    return () => unsubscribe();
  }, [reconcileCloudData]);

  // 1.05 Atualizar automaticamente ao focar/abrir o app no celular ou notebook (como rede social)
  useEffect(() => {
    const checkCloudOnFocus = () => {
      const uid = auth?.currentUser?.uid;
      if (!uid || (typeof navigator !== 'undefined' && !navigator.onLine)) return;

      fetchFinancialDataFromCloud(uid).then((res) => {
        if (res) {
          const lastLocalUpdate = Number(localStorage.getItem(LAST_LOCAL_UPDATE_KEY) || '0');
          const isNewerOnCloud = res.timestamp > lastLocalUpdate;
          reconcileCloudData(
            uid,
            res.contas,
            res.logs,
            res.timestamp,
            isNewerOnCloud,
            res.exists,
            res.transmissoes,
            res.acordos,
            res.dividas
          );
        }
      });

      fetchFullLimpaNomeDividasFromFirebase(uid).then((d) => {
        if (d && d.length > 0) {
          setDividas(d);
        }
      }).catch(() => {});

      reloadCaixinhasHistoryFromFirebase(uid).then((c) => {
        if (c && c.length > 0) {
          setCaixinhas(c);
        }
      }).catch(() => {});

      reloadSaudeHistoryFromFirebase(uid).then((s) => {
        if (
          s &&
          ((s.historicoPesoAltura?.length || 0) > 0 ||
            (s.medicamentos?.length || 0) > 0 ||
            (s.consultas?.length || 0) > 0 ||
            (s.metricas?.length || 0) > 0)
        ) {
          setDadosSaude(s);
        }
      }).catch(() => {});

      reloadAgendaHistoryFromFirebase(uid).then((a) => {
        if (a && ((a.itens?.length || 0) > 0 || (a.notas?.length || 0) > 0)) {
          setDadosAgenda(a);
        }
      }).catch(() => {});
    };

    window.addEventListener('focus', checkCloudOnFocus);
    document.addEventListener('visibilitychange', checkCloudOnFocus);
    const interval = setInterval(checkCloudOnFocus, 18000); // Polling leve a cada 18s (inclusive na tela de bloqueio / segundo plano)
    return () => {
      window.removeEventListener('focus', checkCloudOnFocus);
      document.removeEventListener('visibilitychange', checkCloudOnFocus);
      clearInterval(interval);
    };
  }, [reconcileCloudData]);

  // 1.1 Monitorar conexão de rede e enviar todas as mudanças feitas offline assim que a internet voltar
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      const uid = auth?.currentUser?.uid || localStorage.getItem('sutello_last_uid') || '';
      if (uid) {
        syncPendingDataIfOnline(uid, undefined, undefined, () => {
          setIsCloudSynced(true);
          setSyncToastMessage('Conexão restabelecida! Alterações offline sincronizadas com a nuvem.');
          setTimeout(() => setSyncToastMessage(null), 4000);
        });
      } else {
        setSyncToastMessage('Conexão com a internet restabelecida.');
        setTimeout(() => setSyncToastMessage(null), 3000);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsCloudSynced(false);
      setSyncToastMessage('Você está sem internet. O aplicativo continua funcionando normalmente e salvará tudo na nuvem assim que reconectar.');
      setTimeout(() => setSyncToastMessage(null), 5000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Se estiver online no carregamento inicial e houver pendências do último acesso offline, envia
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      const uid = auth?.currentUser?.uid || localStorage.getItem('sutello_last_uid') || '';
      if (uid && localStorage.getItem(PENDING_SYNC_KEY) === 'true') {
        syncPendingDataIfOnline(uid, undefined, undefined, () => {
          setIsCloudSynced(true);
        });
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 1.2 Monitorar contas vencidas e que vencem hoje e disparar alertas no celular de forma agrupada e inteligente
  useEffect(() => {
    if (!contas || contas.length === 0) return;
    const hojeStr = new Date().toISOString().split('T')[0];
    const hojeDate = new Date(hojeStr + 'T00:00:00');

    const contasHoje: Conta[] = [];
    const contasAtrasadas: { conta: Conta; diasAtraso: number }[] = [];

    contas.forEach((conta) => {
      if (conta.oculta || conta.paga || !conta.vencimento) return;
      const vencDate = new Date(conta.vencimento + 'T00:00:00');
      const diffMs = vencDate.getTime() - hojeDate.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        contasAtrasadas.push({ conta, diasAtraso: Math.abs(diffDays) });
      } else if (diffDays === 0) {
        contasHoje.push(conta);
      }
    });

    // Se houver contas que vencem hoje, dispara agrupado ou individual
    if (contasHoje.length > 0) {
      notifyContasVenceHojeAgrupadas(contasHoje);
    }

    // Se houver contas atrasadas, dispara agrupado ou individual
    if (contasAtrasadas.length > 0) {
      notifyContasVencidasAgrupadas(contasAtrasadas);
    }
  }, [contas]);

  // Monitoramento automático de atualizações OTA do aplicativo (sem precisar apagar nem baixar APK)
  const handleManualCheckAppUpdate = useCallback(async (): Promise<boolean> => {
    try {
      const res = await checkAppUpdateNow();
      setRemoteAppVersion(res.remoteInfo);
      if (res.hasUpdate) {
        setHasAppUpdate(true);
        notifyAppUpdateAvailable(
          res.remoteInfo.version,
          res.remoteInfo.buildId,
          res.remoteInfo.title,
          res.remoteInfo.notes
        );
        return true;
      }
    } catch {}
    return false;
  }, []);

  useEffect(() => {
    syncCurrentVersionToCloudIfNeeded().catch(() => {});
    handleManualCheckAppUpdate();

    const unsubUpdates = subscribeToAppUpdates((remoteInfo) => {
      setRemoteAppVersion(remoteInfo);
      setHasAppUpdate(true);
      notifyAppUpdateAvailable(
        remoteInfo.version,
        remoteInfo.buildId,
        remoteInfo.title,
        remoteInfo.notes
      );
    });

    const interval = setInterval(() => {
      handleManualCheckAppUpdate();
    }, 60000);

    return () => {
      unsubUpdates();
      clearInterval(interval);
    };
  }, [handleManualCheckAppUpdate]);

  // Função para abrir diretamente uma aba/modal específico ao clicar numa notificação (mesmo vindo da tela de bloqueio ou barra do Android)
  const handleOpenTargetModal = useCallback(
    (
      targetModal: 'saude' | 'caixinhas' | 'agenda' | 'acordos' | 'notificacoes' | 'settings',
      targetSaudeTab?: 'pesoxaltura' | 'remedios' | 'consultas' | 'metricas' | 'cartao'
    ) => {
      setIsUnlocked(true);
      setIsNotificationsOpen(false);
      setIsSettingsOpen(false);
      if (targetModal === 'saude') {
        setSaudeInitialTab(targetSaudeTab || 'pesoxaltura');
        setIsSaudeOpen(true);
      } else if (targetModal === 'caixinhas') {
        setIsCaixinhasOpen(true);
      } else if (targetModal === 'agenda') {
        setIsAgendaOpen(true);
      } else if (targetModal === 'acordos') {
        setIsAcordosOpen(true);
      } else if (targetModal === 'settings') {
        setIsSettingsOpen(true);
      } else {
        setIsNotificationsOpen(true);
      }
    },
    []
  );

  // Escuta eventos de navegação vindos do Service Worker (notificationclick) ou da Ponte Nativa Android (PendingIntent ao tocar na notificação)
  useEffect(() => {
    const checkUrlParamsAndPendingTarget = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const openModal = params.get('openModal') as any;
        const saudeTab = params.get('saudeTab') as any;
        if (openModal && ['saude', 'caixinhas', 'agenda', 'acordos', 'notificacoes', 'settings'].includes(openModal)) {
          handleOpenTargetModal(openModal, saudeTab || undefined);
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch {}

      try {
        if (typeof (window as any).SutelloNativeAndroid?.consumePendingNotificationTarget === 'function') {
          const rawTarget = (window as any).SutelloNativeAndroid.consumePendingNotificationTarget();
          if (rawTarget && typeof rawTarget === 'string' && rawTarget.trim().length > 0) {
            const [modal, tab] = rawTarget.split(':');
            if (modal && ['saude', 'caixinhas', 'agenda', 'acordos', 'notificacoes', 'settings'].includes(modal)) {
              handleOpenTargetModal(modal as any, (tab as any) || undefined);
            }
          }
        }
      } catch {}
    };

    checkUrlParamsAndPendingTarget();
    window.addEventListener('focus', checkUrlParamsAndPendingTarget);
    document.addEventListener('visibilitychange', checkUrlParamsAndPendingTarget);

    const handleSwMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'NOTIFICATION_CLICK_TARGET') {
        const { targetModal, targetSaudeTab, contaId } = event.data;
        if (targetModal) {
          handleOpenTargetModal(targetModal, targetSaudeTab);
        } else if (contaId) {
          setIsUnlocked(true);
          setTimeout(() => {
            const c = contasRef.current.find((item) => String(item.id) === String(contaId));
            if (c) {
              setContaToPay(c);
              setIsPaymentOpen(true);
            }
          }, 200);
        }
      }
    };

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }

    return () => {
      window.removeEventListener('focus', checkUrlParamsAndPendingTarget);
      document.removeEventListener('visibilitychange', checkUrlParamsAndPendingTarget);
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
    };
  }, [handleOpenTargetModal]);

  // 1.3 Monitorar compromissos e lembretes da Agenda: disparar notificação 1 dia antes e no próprio dia de manhã cedo
  useEffect(() => {
    if (!dadosAgenda?.itens || dadosAgenda.itens.length === 0) return;
    notifyAgendaCompromissos(dadosAgenda.itens);
    const interval = setInterval(() => {
      if (dadosAgenda?.itens && dadosAgenda.itens.length > 0) {
        notifyAgendaCompromissos(dadosAgenda.itens);
      }
    }, 45000);
    return () => clearInterval(interval);
  }, [dadosAgenda?.itens]);

  // 1.35 Monitorar Saúde: Lembrete mensal de pesagem (30 dias) e Horário dos Remédios cadastrados
  useEffect(() => {
    if (!dadosSaude) return;
    checkAndNotifySaudePesagemMensal(dadosSaude);
    checkAndNotifyRemediosHorario(dadosSaude.medicamentos);

    const interval = setInterval(() => {
      checkAndNotifySaudePesagemMensal(dadosSaude);
      checkAndNotifyRemediosHorario(dadosSaude.medicamentos);
    }, 30000); // Verifica a cada 30 segundos para disparar exatamente no minuto do remédio
    return () => clearInterval(interval);
  }, [dadosSaude]);

  // 1.4 Sincronizar Contas, Agenda, Saúde, Caixinhas e Transmissões com o Service Worker e Capacitor APK para notificações em 2º plano
  useEffect(() => {
    syncBackgroundAlertsWithSW(
      contas || [],
      dadosAgenda?.itens || [],
      transmissoes || [],
      firebaseUser?.uid,
      dadosSaude,
      caixinhas
    );
  }, [contas, dadosAgenda?.itens, transmissoes, firebaseUser?.uid, dadosSaude, caixinhas]);

  // 1.5 No APK Android nativo ou PWA: solicita permissão de notificações nativas ao iniciar/desbloquear e escuta toques nas notificações
  useEffect(() => {
    if (isNativeApkPlatform() || isUnlocked) {
      requestDeviceNotificationPermission().catch(() => {});
    }

    if (!isNativeApkPlatform()) return;

    let listenerHandle: any = null;
    LocalNotifications.addListener('localNotificationActionPerformed', (notificationAction) => {
      const extra = notificationAction?.notification?.extra;
      if (extra?.targetModal) {
        handleOpenTargetModal(extra.targetModal, extra.targetSaudeTab);
      } else if (extra?.agendaId) {
        handleOpenTargetModal('agenda');
      } else if (extra?.medId) {
        handleOpenTargetModal('saude', 'remedios');
      } else if (extra?.pesoId) {
        handleOpenTargetModal('saude', 'pesoxaltura');
      } else if (extra?.caixinhaId) {
        handleOpenTargetModal('caixinhas');
      } else {
        setIsNotificationsOpen(true);
      }
    })
      .then((h) => {
        listenerHandle = h;
      })
      .catch(() => {});

    return () => {
      if (listenerHandle && typeof listenerHandle.remove === 'function') {
        listenerHandle.remove();
      }
    };
  }, [isUnlocked, handleOpenTargetModal]);

  // Cálculo inteligente de notificações (contas, saúde, caixinhas, agenda e transmissões)
  const rawNotifications = useMemo<NotificacaoAlerta[]>(() => {
    const alerts: NotificacaoAlerta[] = [];
    const hojeStr = new Date().toISOString().split('T')[0];
    const hojeDate = new Date(hojeStr + 'T00:00:00');

    contas.forEach((conta) => {
      if (conta.oculta) return;

      // 1. Contas NÃO pagas: Atrasadas, Vencendo Hoje, Vencendo em breve
      if (!conta.paga && conta.vencimento) {
        const vencDate = new Date(conta.vencimento + 'T00:00:00');
        const diffMs = vencDate.getTime() - hojeDate.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
          const diasAtraso = Math.abs(diffDays);
          alerts.push({
            id: `atrasada_${conta.id}_${conta.vencimento}`,
            tipo: 'atrasada',
            titulo: 'Conta Atrasada',
            mensagem: `${conta.nome} venceu ${
              diasAtraso === 1 ? 'ontem' : `há ${diasAtraso} dias`
            } (${isoParaBR(conta.vencimento)}) no valor de R$ ${formatCurrency(conta.valor)} (${conta.pagador || 'Leonardo'}).`,
            contaId: conta.id,
            valor: conta.valor,
            vencimento: conta.vencimento,
            urgencia: 'alta',
            diasAtraso,
          });
        } else if (diffDays === 0) {
          alerts.push({
            id: `hoje_${conta.id}_${conta.vencimento}`,
            tipo: 'hoje',
            titulo: 'Vence Hoje!',
            mensagem: `${conta.nome} vence hoje (${isoParaBR(conta.vencimento)}) no valor de R$ ${formatCurrency(conta.valor)} (${conta.pagador || 'Leonardo'}).`,
            contaId: conta.id,
            valor: conta.valor,
            vencimento: conta.vencimento,
            urgencia: 'alta',
          });
        } else if (diffDays <= 2) {
          alerts.push({
            id: `breve_${conta.id}_${conta.vencimento}`,
            tipo: 'breve',
            titulo: 'Vencimento Próximo',
            mensagem: `${conta.nome} vence ${
              diffDays === 1 ? 'amanhã' : 'em 2 dias'
            } (${isoParaBR(conta.vencimento)}) - R$ ${formatCurrency(conta.valor)}.`,
            contaId: conta.id,
            valor: conta.valor,
            vencimento: conta.vencimento,
            urgencia: 'media',
          });
        }
      }

      // 2. Parcelas acabando (última ou penúltima)
      if (
        conta.totalParcelas &&
        conta.totalParcelas > 1 &&
        conta.parcelaAtual
      ) {
        if (conta.parcelaAtual === conta.totalParcelas) {
          alerts.push({
            id: `parcela_fim_${conta.id}_${conta.parcelaAtual}_${conta.totalParcelas}`,
            tipo: 'parcela_fim',
            titulo: 'Última Parcela!',
            mensagem: `${conta.nome}: Esta é a última parcela (${conta.parcelaAtual}/${conta.totalParcelas}) de R$ ${formatCurrency(conta.valor)}. Você quitará esta compra!`,
            contaId: conta.id,
            valor: conta.valor,
            vencimento: conta.vencimento,
            urgencia: 'media',
            parcelaAtual: conta.parcelaAtual,
            totalParcelas: conta.totalParcelas,
          });
        } else if (
          conta.parcelaAtual === conta.totalParcelas - 1 &&
          conta.totalParcelas > 2
        ) {
          alerts.push({
            id: `parcela_penultima_${conta.id}_${conta.parcelaAtual}_${conta.totalParcelas}`,
            tipo: 'parcela_penultima',
            titulo: 'Reta Final do Parcelamento',
            mensagem: `${conta.nome}: Parcela ${conta.parcelaAtual}/${conta.totalParcelas}. Resta apenas mais 1 parcela para quitar completamente.`,
            contaId: conta.id,
            valor: conta.valor,
            vencimento: conta.vencimento,
            urgencia: 'baixa',
            parcelaAtual: conta.parcelaAtual,
            totalParcelas: conta.totalParcelas,
          });
        }
      }

      // 3. Parcelas 100% quitadas
      if (
        conta.paga &&
        conta.totalParcelas &&
        conta.totalParcelas > 1 &&
        (conta.parcelaAtual || 1) >= conta.totalParcelas
      ) {
        alerts.push({
          id: `parcela_quitada_${conta.id}_${conta.totalParcelas}`,
          tipo: 'parcela_quitada',
          titulo: 'Parcelamento Concluído!',
          mensagem: `${conta.nome}: Parabéns! Todas as ${conta.totalParcelas} parcelas foram quitadas com sucesso.`,
          contaId: conta.id,
          valor: conta.valor,
          vencimento: conta.vencimento,
          urgencia: 'baixa',
          parcelaAtual: conta.parcelaAtual,
          totalParcelas: conta.totalParcelas,
        });
      }

      // 4. Contas marcadas como pagas hoje (inclusive pelo outro celular)
      if (conta.paga && conta.dataPagamento) {
        const hojeIso = new Date().toISOString().split('T')[0];
        if (conta.dataPagamento.startsWith(hojeIso)) {
          alerts.push({
            id: `paga_${conta.id}_${conta.dataPagamento}`,
            tipo: 'conta_paga',
            titulo: 'Conta Paga Hoje',
            mensagem: `${conta.nome} • R$ ${formatCurrency(conta.valor)} (Marcada como paga${conta.pagador ? ` por ${conta.pagador}` : ''})`,
            contaId: conta.id,
            valor: conta.valor,
            vencimento: conta.vencimento,
            urgencia: 'baixa',
          });
        }
      }
    });

    // 5. Mensagens de Transmissão ADM para todos os aparelhos (com suporte a link, botão, imagem e aba destino)
    transmissoes.forEach((t) => {
      const isRecent = Date.now() - t.timestamp < 1000 * 60 * 60 * 72; // 3 dias
      if (isRecent) {
        alerts.push({
          id: `transmissao_${t.id}`,
          tipo: 'transmissao_adm',
          titulo: t.titulo,
          mensagem: t.mensagem,
          urgencia: t.urgencia,
          linkUrl: t.linkUrl,
          botaoTexto: t.botaoTexto,
          imagemUrl: t.imagemUrl,
          targetModal: t.targetModal,
          targetSaudeTab: t.targetSaudeTab,
        });
      }
    });

    // 6. Compromissos e Lembretes da Agenda (1 dia antes e no próprio dia)
    (dadosAgenda?.itens || []).forEach((item) => {
      if (item.concluido || !item.data) return;
      let dataStr = String(item.data).trim();
      if (dataStr.includes('/')) {
        const p = dataStr.split('/');
        if (p.length === 3) dataStr = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
      } else if (dataStr.includes('T')) {
        dataStr = dataStr.split('T')[0];
      }
      const compDate = new Date(dataStr + 'T00:00:00');
      if (isNaN(compDate.getTime())) return;

      const diffMs = compDate.getTime() - hojeDate.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      const nomePessoa = item.pessoa || 'Leonardo';
      const horaInfo = item.hora ? ` às ${item.hora}` : '';

      if (diffDays === 0) {
        alerts.push({
          id: `agenda_hoje_${item.id}_${hojeStr}`,
          tipo: 'agenda',
          titulo: `🌅 Compromisso Hoje (${nomePessoa})`,
          mensagem: `${item.titulo} — Hoje (${isoParaBR(dataStr)})${horaInfo} • Responsável: ${nomePessoa}`,
          vencimento: dataStr,
          urgencia: 'alta',
          targetModal: 'agenda',
        });
      } else if (diffDays === 1) {
        alerts.push({
          id: `agenda_amanha_${item.id}_${hojeStr}`,
          tipo: 'agenda',
          titulo: `🔔 Lembrete Amanhã (${nomePessoa})`,
          mensagem: `${item.titulo} — Amanhã (${isoParaBR(dataStr)})${horaInfo} • Responsável: ${nomePessoa}`,
          vencimento: dataStr,
          urgencia: 'media',
          targetModal: 'agenda',
        });
      }
    });

    // 7. Saúde: Lembrete mensal de pesagem (30 dias) e Meta de Peso atingida
    if (dadosSaude?.historicoPesoAltura && dadosSaude.historicoPesoAltura.length > 0) {
      const pessoas: ('Vitórya' | 'Leonardo')[] = ['Vitórya', 'Leonardo'];
      pessoas.forEach((pessoa) => {
        const normTarget = pessoa === 'Vitórya' ? 'vit' : 'leo';
        const regs = (dadosSaude.historicoPesoAltura || [])
          .filter((r) => (r.pessoa || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(normTarget))
          .sort((a, b) => (b.data + (b.hora || '')).localeCompare(a.data + (a.hora || '')));

        if (regs.length > 0) {
          const ult = regs[0];
          const dtUlt = new Date((ult.data || hojeStr) + 'T00:00:00');
          if (!isNaN(dtUlt.getTime())) {
            const diasSemPesar = Math.floor((hojeDate.getTime() - dtUlt.getTime()) / (1000 * 60 * 60 * 24));
            if (diasSemPesar >= 30) {
              alerts.push({
                id: `saude_pesagem_mensal_${pessoa}_${ult.id}`,
                tipo: 'saude_peso',
                titulo: `⚖️ ${pessoa}, sua última pesagem faz 1 mês!`,
                mensagem: `Última pesagem em ${isoParaBR(ult.data)} (${ult.peso.toFixed(1)} kg — há ${diasSemPesar} dias). Toque para atualizar seu peso na aba Saúde!`,
                urgencia: 'media',
                targetModal: 'saude',
                targetSaudeTab: 'pesoxaltura',
              });
            }
          }

          // Verifica meta de peso atingida (100% isolada por usuário)
          const metas = {
            ...(dadosSaude.perfilSaude?.metasPorPessoa || {}),
            ...(dadosSaude.metasPorPessoa || {}),
          };
          const metaVal = Number(metas[pessoa] || ult.metaPeso || 0);
          if (metaVal > 0) {
            const primeiroPeso = regs[regs.length - 1].peso;
            const atingiu =
              (primeiroPeso >= metaVal && ult.peso <= metaVal) ||
              (primeiroPeso < metaVal && ult.peso >= metaVal) ||
              Math.abs(ult.peso - metaVal) <= 0.1;
            if (atingiu) {
              alerts.push({
                id: `saude_meta_atingida_${pessoa}_${metaVal}`,
                tipo: 'saude_meta',
                titulo: `🎉 Parabéns ${pessoa}! Meta de Peso Atingida!`,
                mensagem: `${pessoa} chegou a ${ult.peso.toFixed(1)} kg e alcançou a meta individual de ${metaVal.toFixed(1)} kg!`,
                urgencia: 'baixa',
                targetModal: 'saude',
                targetSaudeTab: 'pesoxaltura',
              });
            }
          }
        }
      });
    }

    // 8. Saúde: Lembretes de Remédios ativos nos horários programados (respeitando se é fixo ou por alguns dias)
    (dadosSaude?.medicamentos || []).forEach((med) => {
      if (!med || med.lembreteAtivo === false || !Array.isArray(med.horarios)) return;
      if (med.tipoTratamento === 'dias' && med.dataFim && hojeStr > med.dataFim) return;
      med.horarios.forEach((h) => {
        alerts.push({
          id: `saude_remedio_${med.id}_${hojeStr}_${h}`,
          tipo: 'saude_remedio',
          titulo: `💊 Lembrete de Remédio: ${med.nome}`,
          mensagem: `Horário: ${h} • ${med.dosagem || '1 dose'}${med.instrucoes ? ` (${med.instrucoes})` : ''}.`,
          urgencia: 'alta',
          targetModal: 'saude',
          targetSaudeTab: 'remedios',
        });
      });
    });

    // 9. Caixinhas: Meta de valor completada
    (caixinhas || []).forEach((cx) => {
      if (cx.meta && cx.meta > 0 && (cx.saldo || 0) >= cx.meta) {
        alerts.push({
          id: `caixinha_meta_concluida_${cx.id}_${cx.meta}`,
          tipo: 'caixinha_meta',
          titulo: `🎉 Meta da Caixinha "${cx.nome}" Concluída!`,
          mensagem: `Parabéns! Você atingiu R$ ${formatCurrency(cx.saldo)} de R$ ${formatCurrency(cx.meta)} (100% da meta)!`,
          valor: cx.saldo,
          urgencia: 'baixa',
          targetModal: 'caixinhas',
        });
      }
    });

    // 10. Atualização do Aplicativo disponível (OTA sem precisar baixar APK)
    if (hasAppUpdate && remoteAppVersion) {
      alerts.unshift({
        id: `app_update_${remoteAppVersion.version}_${remoteAppVersion.buildId}`,
        tipo: 'app_update',
        titulo: `🚀 Atualização v${remoteAppVersion.version} Disponível!`,
        mensagem:
          remoteAppVersion.notes ||
          'Toque aqui para abrir as Configurações e atualizar o aplicativo em 1 segundo sem precisar baixar APK.',
        urgencia: 'alta',
        targetModal: 'settings',
      });
    }

    return alerts;
  }, [contas, transmissoes, dadosAgenda?.itens, dadosSaude, caixinhas, hasAppUpdate, remoteAppVersion]);

  // Filtra as notificações ativas que ainda NÃO foram marcadas como vistas pelo usuário
  const unreadNotifications = useMemo(() => {
    return rawNotifications.filter((n) => !viewedNotificationIds.includes(n.id));
  }, [rawNotifications, viewedNotificationIds]);

  // Ao ver / dispensar a notificação: ela sai imediatamente e, se for transmissão, marca como visualizada no banco para auto-limpeza quando todos virem
  const handleDismissNotification = useCallback((id: string) => {
    setViewedNotificationIds((prev) => {
      if (prev.includes(id)) return prev;
      // Mantém apenas os 150 IDs mais recentes no localStorage para nunca ocupar espaço desnecessário
      const updated = [...prev, id].slice(-150);
      localStorage.setItem('sutello_notificacoes_vistas', JSON.stringify(updated));
      return updated;
    });

    if (id.startsWith('transmissao_')) {
      const broadcastId = id.replace('transmissao_', '');
      const uid = auth?.currentUser?.uid || localStorage.getItem('sutello_last_uid') || '';
      if (uid && broadcastId) {
        markBroadcastViewedAndCleanupInCloud(uid, broadcastId).then(() => {
          setTransmissoes((prev) => prev.filter((t) => t.id !== broadcastId));
        });
      }
    }
  }, []);

  // Marcar todas como vistas (e limpa do banco de dados as transmissões visualizadas por todos)
  const handleDismissAllNotifications = useCallback(() => {
    const allCurrentIds = rawNotifications.map((n) => n.id);
    setViewedNotificationIds((prev) => {
      const merged = Array.from(new Set([...prev, ...allCurrentIds])).slice(-150);
      localStorage.setItem('sutello_notificacoes_vistas', JSON.stringify(merged));
      return merged;
    });

    const uid = auth?.currentUser?.uid || localStorage.getItem('sutello_last_uid') || '';
    if (uid) {
      allCurrentIds.forEach((id) => {
        if (id.startsWith('transmissao_')) {
          const broadcastId = id.replace('transmissao_', '');
          markBroadcastViewedAndCleanupInCloud(uid, broadcastId).catch(() => {});
        }
      });
      setTransmissoes([]);
    }
  }, [rawNotifications]);


  // 2. Persistir localmente e na nuvem de forma atômica (sem risco de sobrescrita ou valores undefined)
  const addLog = useCallback(
    (acao: LogAtividade['acao'], detalhe: string, backup?: Conta | null, relatedId?: string | number | null) => {
      const newLog: LogAtividade = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        data: new Date().toISOString(),
        acao,
        detalhe,
        backup: backup ? JSON.parse(JSON.stringify(backup)) : null,
        relatedId: relatedId ?? null,
      };
      const updated = [newLog, ...logsRef.current.slice(0, 50)];
      logsRef.current = updated;
      setLogs(updated);
      return updated;
    },
    []
  );

  const saveData = useCallback(
    (newContas: Conta[], explicitLogs?: LogAtividade[]) => {
      const finalLogs = explicitLogs !== undefined ? explicitLogs : logsRef.current;
      contasRef.current = newContas;
      logsRef.current = finalLogs;
      setContas(newContas);
      setLogs(finalLogs);
      const uid = auth?.currentUser?.uid || localStorage.getItem('sutello_last_uid') || '';
      saveFinancialDataToCloud(uid, newContas, finalLogs).then((ok) => {
        if (ok) setIsCloudSynced(true);
      });
    },
    []
  );

  // Operações do Módulo de Acordos & Dívidas (dados_limpanome)
  const handleSaveDivida = (d: DividaLimpaNome) => {
    setDividas((prev) => {
      const idx = prev.findIndex((x) => x.id === d.id);
      let updated: DividaLimpaNome[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = d;
      } else {
        updated = [d, ...prev];
      }
      try {
        localStorage.setItem('sutello_dividas', JSON.stringify(updated));
      } catch {}
      const uid = auth?.currentUser?.uid || localStorage.getItem('sutello_last_uid') || '';
      if (uid) saveLimpaNomeDividas(uid, updated);
      return updated;
    });
  };

  const handleDeleteDivida = (id: string) => {
    setDividas((prev) => {
      const updated = prev.filter((x) => x.id !== id);
      try {
        localStorage.setItem('sutello_dividas', JSON.stringify(updated));
      } catch {}
      const uid = auth?.currentUser?.uid || localStorage.getItem('sutello_last_uid') || '';
      if (uid) saveLimpaNomeDividas(uid, updated);
      return updated;
    });
  };

  const handlePayDivida = (id: string) => {
    setDividas((prev) => {
      const d = prev.find((x) => x.id === id);
      if (!d) return prev;

      // 1. Marca a atual como paga
      const updated = prev.map((x) => (x.id === id ? { ...x, paga: true } : x));

      // 2. Se for parcelado e houver próximas parcelas, gera a próxima parcela no mês seguinte (exatamente como app.js)
      if (d.totalParcelas > 0 && d.parcelaAtual < d.totalParcelas) {
        let venc = String(d.vencimento || '').trim();
        if (!venc) venc = new Date().toISOString().split('T')[0];
        if (venc.includes('/')) {
          const p = venc.split('/');
          if (p.length === 3) venc = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
        }
        const [ano, mes, dia] = venc.split('-').map(Number);
        const dt = new Date(ano, (mes - 1) + 1, dia || 1);
        const yyyy = dt.getFullYear();
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const dd = String(dt.getDate()).padStart(2, '0');
        const novoVenc = `${yyyy}-${mm}-${dd}`;

        const proxima: DividaLimpaNome = {
          ...d,
          id: Date.now().toString(),
          paga: false,
          parcelaAtual: (d.parcelaAtual || 1) + 1,
          vencimento: novoVenc,
        };
        updated.push(proxima);
      }

      try {
        localStorage.setItem('sutello_dividas', JSON.stringify(updated));
      } catch {}
      const uid = auth?.currentUser?.uid || localStorage.getItem('sutello_last_uid') || '';
      if (uid) saveLimpaNomeDividas(uid, updated);
      return updated;
    });
  };

  const handleUndoDivida = (id: string) => {
    setDividas((prev) => {
      const d = prev.find((x) => x.id === id);
      if (!d) return prev;

      // Remove a próxima parcela se foi gerada automaticamente e ainda não foi paga
      const proximaNum = (d.parcelaAtual || 1) + 1;
      const updated = prev
        .filter((x) => !(x.nome === d.nome && x.parcelaAtual === proximaNum && !x.paga))
        .map((x) => (x.id === id ? { ...x, paga: false } : x));

      try {
        localStorage.setItem('sutello_dividas', JSON.stringify(updated));
      } catch {}
      const uid = auth?.currentUser?.uid || localStorage.getItem('sutello_last_uid') || '';
      if (uid) saveLimpaNomeDividas(uid, updated);
      return updated;
    });
  };

  // ==========================================
  // OPERAÇÕES DO MÓDULO CAIXINHAS & METAS
  // ==========================================
  const handleSaveCaixinha = (caixinha: Caixinha) => {
    if (caixinha.meta && caixinha.meta > 0 && (caixinha.saldo || 0) >= caixinha.meta) {
      knownCaixinhaCompletedRef.current.add(`${caixinha.id}_${caixinha.meta}`);
      notifyCaixinhaMetaAtingida(caixinha);
    }
    setCaixinhas((prev) => {
      const exists = prev.some((c) => c.id === caixinha.id);
      const updated = exists ? prev.map((c) => (c.id === caixinha.id ? caixinha : c)) : [caixinha, ...prev];
      try {
        localStorage.setItem('sutello_caixinhas', JSON.stringify(updated));
      } catch {}
      const uid = auth?.currentUser?.uid || localStorage.getItem('sutello_last_uid') || '';
      if (uid) saveCaixinhasToCloud(uid, updated);
      return updated;
    });
  };

  const handleDeleteCaixinha = (id: string) => {
    setCaixinhas((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      try {
        localStorage.setItem('sutello_caixinhas', JSON.stringify(updated));
      } catch {}
      const uid = auth?.currentUser?.uid || localStorage.getItem('sutello_last_uid') || '';
      if (uid) saveCaixinhasToCloud(uid, updated);
      return updated;
    });
  };

  const handleDepositCaixinha = (id: string, valor: number, descricao?: string) => {
    setCaixinhas((prev) => {
      const updated = prev.map((c) => {
        if (c.id !== id) return c;
        const saldoAnterior = c.saldo || 0;
        const novoSaldo = saldoAnterior + valor;
        const novaTx: TransacaoCaixinha = {
          id: 'tx_' + Date.now(),
          tipo: 'deposito',
          valor,
          data: new Date().toISOString(),
          descricao: descricao || 'Depósito na caixinha',
        };
        const atualizada: Caixinha = {
          ...c,
          saldo: novoSaldo,
          historico: [novaTx, ...(c.historico || [])],
        };
        // Se completou o valor da caixinha de meta agora, dispara notificação de parabéns!
        if (atualizada.meta && atualizada.meta > 0 && novoSaldo >= atualizada.meta && saldoAnterior < atualizada.meta) {
          knownCaixinhaCompletedRef.current.add(`${atualizada.id}_${atualizada.meta}`);
          notifyCaixinhaMetaAtingida(atualizada);
        }
        return atualizada;
      });
      try {
        localStorage.setItem('sutello_caixinhas', JSON.stringify(updated));
      } catch {}
      const uid = auth?.currentUser?.uid || localStorage.getItem('sutello_last_uid') || '';
      if (uid) saveCaixinhasToCloud(uid, updated);
      return updated;
    });
  };

  const handleWithdrawCaixinha = (id: string, valor: number, descricao?: string) => {
    setCaixinhas((prev) => {
      const updated = prev.map((c) => {
        if (c.id !== id) return c;
        const novoSaldo = Math.max(0, (c.saldo || 0) - valor);
        const novaTx: TransacaoCaixinha = {
          id: 'tx_' + Date.now(),
          tipo: 'resgate',
          valor,
          data: new Date().toISOString(),
          descricao: descricao || 'Resgate da caixinha',
        };
        return {
          ...c,
          saldo: novoSaldo,
          historico: [novaTx, ...(c.historico || [])],
        };
      });
      try {
        localStorage.setItem('sutello_caixinhas', JSON.stringify(updated));
      } catch {}
      const uid = auth?.currentUser?.uid || localStorage.getItem('sutello_last_uid') || '';
      if (uid) saveCaixinhasToCloud(uid, updated);
      return updated;
    });
  };

  const handleReloadCaixinhasHistory = async (): Promise<Caixinha[] | undefined> => {
    const uid = auth?.currentUser?.uid || localStorage.getItem('sutello_last_uid') || '';
    if (!uid) return undefined;
    const reloaded = await reloadCaixinhasHistoryFromFirebase(uid);
    setCaixinhas(reloaded);
    return reloaded;
  };

  // ==========================================
  // OPERAÇÕES DO MÓDULO SAÚDE & BEM-ESTAR
  // ==========================================
  const handleSaveSaude = (novosDados: DadosSaude) => {
    // Verifica se um novo peso foi adicionado agora
    const listaAntigaIds = new Set((dadosSaude?.historicoPesoAltura || []).map((p) => p.id));
    const listaNova = novosDados.historicoPesoAltura || [];
    const recemAdicionados = listaNova.filter((p) => p.id && !listaAntigaIds.has(p.id));

    recemAdicionados.forEach((novo) => {
      knownPesoIdsRef.current.add(novo.id);
      notifyNovoPesoAdicionado(novo);

      // Verifica se atingiu a meta de peso da pessoa!
      const nomePessoa = (novo.pessoa || '').toLowerCase().includes('leo') ? 'Leonardo' : 'Vitórya';
      const metas = novosDados.metasPorPessoa || novosDados.perfilSaude?.metasPorPessoa || {};
      const metaDaPessoa = Number(metas[nomePessoa] || novo.metaPeso || 0);
      if (metaDaPessoa > 0) {
        const pesosDaPessoa = listaNova
          .filter((r) => {
            const rn = (r.pessoa || '').toLowerCase();
            return nomePessoa === 'Leonardo' ? rn.includes('leo') : rn.includes('vit') || !r.pessoa;
          })
          .sort((a, b) => (a.data + (a.hora || '')).localeCompare(b.data + (b.hora || '')));

        const pesoInicial = pesosDaPessoa.length > 0 ? pesosDaPessoa[0].peso : novo.peso;
        const atingiuPerda = pesoInicial >= metaDaPessoa && novo.peso <= metaDaPessoa;
        const atingiuGanho = pesoInicial < metaDaPessoa && novo.peso >= metaDaPessoa;
        const exato = Math.abs(novo.peso - metaDaPessoa) <= 0.1;

        if (atingiuPerda || atingiuGanho || exato) {
          notifyMetaPesoAtingida(nomePessoa, novo.peso, metaDaPessoa, novo.id);
        }
      }
    });

    setDadosSaude(novosDados);
    try {
      localStorage.setItem('sutello_saude', JSON.stringify(novosDados));
    } catch {}
    const uid = auth?.currentUser?.uid || localStorage.getItem('sutello_last_uid') || '';
    if (uid) saveSaudeToCloud(uid, novosDados);
  };

  const handleReloadSaudeHistory = async (): Promise<DadosSaude | undefined> => {
    const uid = auth?.currentUser?.uid || localStorage.getItem('sutello_last_uid') || '';
    if (!uid) return undefined;
    const reloaded = await reloadSaudeHistoryFromFirebase(uid);
    setDadosSaude(reloaded);
    return reloaded;
  };

  // ==========================================
  // OPERAÇÕES DO MÓDULO NOTAS & LEMBRETES (AGENDA)
  // ==========================================
  const handleSaveAgenda = (novosDados: DadosAgenda) => {
    setDadosAgenda(novosDados);
    try {
      localStorage.setItem('sutello_agenda', JSON.stringify(novosDados));
    } catch {}
    const uid = auth?.currentUser?.uid || localStorage.getItem('sutello_last_uid') || '';
    if (uid) saveAgendaToCloud(uid, novosDados);
  };

  const handleReloadAgendaHistory = async (): Promise<DadosAgenda | undefined> => {
    const uid = auth?.currentUser?.uid || localStorage.getItem('sutello_last_uid') || '';
    if (!uid) return undefined;
    const reloaded = await reloadAgendaHistoryFromFirebase(uid);
    setDadosAgenda(reloaded);
    return reloaded;
  };

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
      const updatedLogs = addLog('EDITADO', `Editou conta: ${contaData.nome}`);
      saveData(updated, updatedLogs);
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
      knownContaIdsRef.current.add(nova.id);
      // Dispara notificação no celular de nova conta adicionada
      notifyNovaConta(nova, nova.pagador);
      const detalhe = nova.totalParcelas
        ? `${nova.totalParcelas}x de R$ ${nova.valor.toFixed(2)}`
        : `R$ ${nova.valor.toFixed(2)}`;
      const updatedLogs = addLog('CRIADO', `Conta: ${nova.nome} (${nova.pagador}) - ${detalhe}`);
      saveData(updated, updatedLogs);
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
          // Dispara notificação no celular quando a conta acabou todas as parcelas (quitação)
          notifyParcelasConcluidas(conta);
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

    const updatedLogs = addLog('PAGO', `Pagou ${conta.nome} - R$ ${conta.valor.toFixed(2)}`, backup, idNova);
    saveData(contasAtualizadas, updatedLogs);
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
    const updatedLogs = addLog(
      'PARCIAL',
      `Pagou R$ ${valorPago.toFixed(2)} de ${conta.nome}, restou R$ ${restante.toFixed(2)}`,
      backup,
      novaParcialPaga.id
    );
    saveData(finalLista, updatedLogs);
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
      const updatedLogs = addLog('ESTORNO', `Reverteu pagamento de ${conta.nome}`, backup);
      saveData(updated, updatedLogs);
    });
  };

  // Excluir conta
  const handleDeleteConta = (conta: Conta) => {
    requireSecurity('EXCLUIR CONTA', () => {
      const backup = JSON.parse(JSON.stringify(conta));
      const updated = contas.filter((c) => c.id !== conta.id);
      const updatedLogs = addLog('EXCLUÍDO', `Apagou a conta ${conta.nome}`, backup);
      saveData(updated, updatedLogs);
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
      const updatedLogs = addLog('ADIADO', `Adiou ${conta.nome} para ${isoParaBR(novaData)}`, backup);
      saveData(updated, updatedLogs);
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
    const updatedLogs = addLog('CRIADO', `Clonou a conta ${conta.nome}`);
    saveData(updated, updatedLogs);
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

  // Backup JSON Completo (Contas, Acordos, Caixinhas, Saúde, Agenda e Perfil)
  const handleExportBackup = () => {
    const backupPayload = {
      contas,
      logs,
      profile,
      dividas,
      acordos,
      caixinhas,
      dadosSaude,
      dadosAgenda,
      exportadoEm: new Date().toISOString(),
    };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupPayload, null, 2));
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
        const rawText = String(e.target?.result || '').trim();
        const parsed = JSON.parse(rawText);
        const uid = auth?.currentUser?.uid || localStorage.getItem('sutello_last_uid') || '';

        // Aceita tanto formato { contas: [...] } quanto um array direto de contas [...]
        const importedContas = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.contas)
          ? parsed.contas
          : null;

        if (importedContas) {
          saveData(importedContas, Array.isArray(parsed?.logs) ? parsed.logs : logs);
        }

        if (parsed?.profile && typeof parsed.profile === 'object') {
          setProfile((prev) => {
            const nextProfile = { ...prev, ...parsed.profile };
            localStorage.setItem('nomePerfil', nextProfile.nome || '');
            localStorage.setItem('fotoPerfil', nextProfile.fotoPerfil || '');
            localStorage.setItem('biometriaAtivada', String(!!nextProfile.biometriaAtivada));
            localStorage.setItem('pinAcesso', nextProfile.pinAcesso || '2007');
            if (nextProfile.bio !== undefined) {
              localStorage.setItem('bioPerfil', nextProfile.bio);
            }
            if (auth.currentUser) {
              saveUserProfileToCloud(auth.currentUser.uid, nextProfile);
            }
            return nextProfile;
          });
        }

        if (Array.isArray(parsed?.dividas)) {
          setDividas(parsed.dividas);
          try {
            localStorage.setItem('sutello_dividas', JSON.stringify(parsed.dividas));
          } catch {}
          if (uid) saveLimpaNomeDividas(uid, parsed.dividas);
        }

        if (Array.isArray(parsed?.acordos)) {
          setAcordos(parsed.acordos);
          try {
            localStorage.setItem('sutello_acordos', JSON.stringify(parsed.acordos));
          } catch {}
        }

        const importedCaixinhas = Array.isArray(parsed?.caixinhas)
          ? parsed.caixinhas
          : Array.isArray(parsed?.dadosCaixinhas?.caixinhas)
          ? parsed.dadosCaixinhas.caixinhas
          : null;

        if (importedCaixinhas) {
          setCaixinhas(importedCaixinhas);
          try {
            localStorage.setItem('sutello_caixinhas', JSON.stringify(importedCaixinhas));
          } catch {}
          if (uid) saveCaixinhasToCloud(uid, importedCaixinhas);
        }

        if (parsed?.dadosSaude && typeof parsed.dadosSaude === 'object') {
          handleSaveSaude(parsed.dadosSaude);
        }
        if (parsed?.dadosAgenda && typeof parsed.dadosAgenda === 'object') {
          handleSaveAgenda(parsed.dadosAgenda);
        }
      } catch (err) {
        console.error('Erro ao ler o arquivo de backup:', err);
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
      if (updated.bio !== undefined) {
        localStorage.setItem('bioPerfil', updated.bio);
      }

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

  // Todas as contas de cada mês (do dia 1 até o último dia do mês, pagas + pendentes) para calcular Total do Mês, Já Pago e Falta Pagar corretamente
  const todasContasPorMes = useMemo(() => {
    const termo = searchTerm.trim().toLowerCase();
    const mapTotalMeses: { [mes: string]: Conta[] } = {};

    const ordenadas = [...contas].sort(
      (a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime()
    );

    ordenadas.forEach((c) => {
      if (c.oculta && !c.paga) return;
      if (termo && !c.nome.toLowerCase().includes(termo) && !c.pagador?.toLowerCase().includes(termo)) {
        return;
      }
      const mesKey = getMesAno(c.vencimento);
      if (!mapTotalMeses[mesKey]) mapTotalMeses[mesKey] = [];
      mapTotalMeses[mesKey].push(c);
    });

    return mapTotalMeses;
  }, [contas, searchTerm]);

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

  // Função centralizada para selecionar e focar uma conta a partir de uma notificação
  const handleSelectConta = (contaId: string | number) => {
    const c = contasRef.current.find((item) => String(item.id) === String(contaId));
    if (c) {
      setContaToPay(c);
      setIsPaymentOpen(true);
    }
  };

  // Se o app estiver bloqueado, exibe tela de segurança (LockScreen)
  if (!isUnlocked) {
    return (
      <LockScreen
        onUnlock={(targetContaId, targetModal, targetSaudeTab) => {
          setIsUnlocked(true);
          if (targetModal) {
            setTimeout(() => handleOpenTargetModal(targetModal, targetSaudeTab), 180);
          } else if (targetContaId) {
            setTimeout(() => handleSelectConta(targetContaId), 200);
          }
        }}
        configuredPin={profile.pinAcesso || '2007'}
        isFirebaseAuthenticated={!!firebaseUser}
        userEmail={firebaseUser?.email}
        notificacoes={unreadNotifications}
        onSelectConta={handleSelectConta}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#08080f] text-neutral-100 flex flex-col font-sans pb-16 select-none">
      {/* Alerta de Segurança Anti-Print e Anti-Gravação (Estilo Banco) */}
      {screenshotBlockedAlert && (
        <div className="anti-print-toast fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-6 animate-in fade-in duration-100">
          <div className="w-full max-w-sm bg-[#141422] border border-red-500/40 rounded-2xl p-5 text-center shadow-2xl space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white font-display">
              Captura e Gravação de Tela Bloqueadas
            </h3>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Não é possível tirar print ou gravar a tela deste aplicativo devido à política de segurança financeira.
            </p>
            <button
              type="button"
              onClick={() => {
                document.body.classList.remove('screenshot-shield-active');
                setScreenshotBlockedAlert(false);
              }}
              className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-all"
            >
              Entendi
            </button>
          </div>
        </div>
      )}

      {/* Header Superior */}
      <Header
        profile={profile}
        isPrivate={isPrivate}
        isCloudSynced={isCloudSynced}
        isOnline={isOnline}
        userEmail={firebaseUser?.email}
        unreadNotificationsCount={unreadNotifications.length}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onTogglePrivacy={togglePrivacy}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLockApp={() => setIsUnlocked(false)}
      />

      {/* Alerta de Modo Offline / Reconexão da Nuvem */}
      {!isOnline && (
        <div className="w-full max-w-lg mx-auto px-4 pt-2.5">
          <div className="p-2.5 bg-amber-500/15 border border-amber-500/30 rounded-xl text-xs text-amber-200 flex items-center justify-between gap-2 shadow-sm animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>Modo Offline ativo • Suas alterações serão enviadas à nuvem assim que reconectar.</span>
            </div>
          </div>
        </div>
      )}

      {syncToastMessage && (
        <div className="w-full max-w-lg mx-auto px-4 pt-2.5">
          <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-xs text-emerald-200 flex items-center justify-between gap-2 shadow-sm animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{syncToastMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setSyncToastMessage(null)}
              className="text-emerald-400 hover:text-emerald-200 text-xs px-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Banner de Instalação PWA (Exibido somente na versão Web) */}
      {!isNativeApkPlatform() && (
        <div className="w-full max-w-lg mx-auto">
          <InstallAppBanner />
        </div>
      )}

      {/* Conteúdo Principal */}
      <main className="flex-1 w-full max-w-lg mx-auto px-4 pt-4 space-y-4">
        {/* Barra de Busca, Botão Olho (Privacidade) e Botão Modo Escuro/Claro (Individual por Aparelho) */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
            onClick={togglePrivacy}
            title={isPrivate ? 'Mostrar valores' : 'Ocultar valores (Modo Privacidade)'}
            className={`w-10 h-10 rounded-2xl border flex items-center justify-center active:scale-95 transition-all duration-75 shrink-0 touch-manipulation ${
              isPrivate
                ? 'bg-purple-600/20 text-purple-300 border-purple-500/40 shadow-sm'
                : 'bg-[#121222] hover:bg-white/10 text-neutral-400 hover:text-white border-white/10'
            }`}
          >
            {isPrivate ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={toggleThemeMode}
            title={themeMode === 'dark' ? 'Mudar para Modo Claro (apenas neste aparelho)' : 'Voltar para Modo Escuro (padrão)'}
            className={`w-10 h-10 rounded-2xl border flex items-center justify-center active:scale-95 transition-all duration-75 shrink-0 touch-manipulation ${
              themeMode === 'light'
                ? 'bg-amber-500/20 text-amber-500 border-amber-500/40 shadow-sm'
                : 'bg-[#121222] hover:bg-white/10 text-neutral-400 hover:text-white border-white/10'
            }`}
          >
            {themeMode === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        {/* Card de Atrasadas (Clicável para filtrar) */}
        <div className="touch-manipulation">
          <button
            type="button"
            onClick={() => setFiltro('atrasadas')}
            className={`w-full rounded-2xl p-3.5 transition-transform duration-75 active:scale-[0.98] border flex items-center justify-between text-left touch-manipulation select-none ${
              filtro === 'atrasadas'
                ? 'bg-[#221c10] border-amber-500/50 shadow-md shadow-amber-500/10 ring-1 ring-amber-500/30'
                : 'bg-[#121222] border-white/5 hover:border-white/15'
            }`}
          >
            <span className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider block">
              Atrasadas {filtro === 'atrasadas' && '• Ativo'}
            </span>
            <span
              className={`text-base sm:text-lg font-bold font-display ${
                statsGerais.qtdAtrasadas > 0 ? 'text-amber-400' : 'text-neutral-400'
              }`}
            >
              {statsGerais.qtdAtrasadas} {statsGerais.qtdAtrasadas === 1 ? 'conta' : 'contas'}
            </span>
          </button>
        </div>

        {/* Filtros em Pílulas */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none touch-manipulation">
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
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-transform duration-75 active:scale-95 border touch-manipulation select-none ${
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
                todasContasMes={todasContasPorMes[mes]}
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
        hasAppUpdate={hasAppUpdate}
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
        onOpenAdmin={() => {
          setIsSettingsOpen(false);
          setIsAdminOpen(true);
        }}
        onOpenAcordos={() => {
          setIsSettingsOpen(false);
          setIsAcordosOpen(true);
        }}
        qtdAcordosPendentes={dividas.filter((d) => !d.paga).length}
        onOpenCaixinhas={() => {
          setIsSettingsOpen(false);
          setIsCaixinhasOpen(true);
        }}
        qtdCaixinhas={caixinhas.length}
        onOpenSaude={() => {
          setIsSettingsOpen(false);
          setIsSaudeOpen(true);
        }}
        onOpenAgenda={() => {
          setIsSettingsOpen(false);
          setIsAgendaOpen(true);
        }}
        qtdAgendaPendentes={dadosAgenda.itens.filter((i) => !i.concluido).length}
        hasAppUpdate={hasAppUpdate}
        remoteAppVersion={remoteAppVersion}
        onCheckAppUpdate={handleManualCheckAppUpdate}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Modal de Acordos e Dívidas (Limpa Nome - dados_limpanome) */}
      <AcordosModal
        isOpen={isAcordosOpen}
        onClose={() => setIsAcordosOpen(false)}
        dividas={dividas}
        onSaveDivida={handleSaveDivida}
        onDeleteDivida={handleDeleteDivida}
        onPayDivida={handlePayDivida}
        onUndoDivida={handleUndoDivida}
      />

      {/* Modal de Caixinhas & Metas (dados_caixinhas_agenda) */}
      <CaixinhasModal
        isOpen={isCaixinhasOpen}
        onClose={() => setIsCaixinhasOpen(false)}
        caixinhas={caixinhas}
        onSaveCaixinha={handleSaveCaixinha}
        onDeleteCaixinha={handleDeleteCaixinha}
        onDeposit={handleDepositCaixinha}
        onWithdraw={handleWithdrawCaixinha}
        onReloadHistory={handleReloadCaixinhasHistory}
      />

      {/* Modal de Saúde & Bem-Estar (dados_saude) */}
      <SaudeModal
        isOpen={isSaudeOpen}
        onClose={() => setIsSaudeOpen(false)}
        dadosSaude={dadosSaude}
        onSaveSaude={handleSaveSaude}
        onReloadHistory={handleReloadSaudeHistory}
        initialTab={saudeInitialTab}
      />

      {/* Modal de Notas & Lembretes / Agenda (dados_agenda) */}
      <NotasLembretesModal
        isOpen={isAgendaOpen}
        onClose={() => setIsAgendaOpen(false)}
        dadosAgenda={dadosAgenda}
        onSaveAgenda={handleSaveAgenda}
        onReloadHistory={handleReloadAgendaHistory}
      />

      {/* Painel Administrativo Secreto (Disparo + Backup + ZIPs + Restauração + Atualizar App) */}
      <AdminBroadcastModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        uid={firebaseUser?.uid || localStorage.getItem('sutello_last_uid') || ''}
        transmissoes={transmissoes}
        userEmail={firebaseUser?.email}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
        hasAppUpdate={hasAppUpdate}
        remoteAppVersion={remoteAppVersion}
        onCheckAppUpdate={handleManualCheckAppUpdate}
      />

      {/* Modal de Notificações Inteligentes */}
      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notificacoes={unreadNotifications}
        onDismiss={handleDismissNotification}
        onDismissAll={handleDismissAllNotifications}
        onSelectConta={handleSelectConta}
        onOpenTargetModal={handleOpenTargetModal}
      />
    </div>
  );
}
