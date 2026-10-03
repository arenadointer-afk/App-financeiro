import { Conta, ItemAgenda } from '../types';
import { formatCurrency, isoParaBR } from './utils';

export interface NotificationPreferences {
  enabled: boolean;
  contasVencidas: boolean;
  contasVenceHoje: boolean;
  contasPagas: boolean;
  parcelasQuitadas: boolean;
  novasContas: boolean;
  somVibracao: boolean;
}

const PREFS_KEY = 'sutello_notification_settings';
const NOTIFIED_KEYS_STORAGE = 'sutello_device_notified_keys';

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: false,
  contasVencidas: true,
  contasVenceHoje: true,
  contasPagas: true,
  parcelasQuitadas: true,
  novasContas: true,
  somVibracao: true,
};

/**
 * Retorna as preferências salvas do usuário para notificações no celular
 */
export function getNotificationPreferences(): NotificationPreferences {
  if (typeof window === 'undefined') return DEFAULT_NOTIFICATION_PREFERENCES;
  try {
    const saved = localStorage.getItem(PREFS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Se a permissão já foi concedida no navegador, assume enabled como true se não estiver explicitamente falso
      const isGranted = typeof Notification !== 'undefined' && Notification.permission === 'granted';
      return {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        ...parsed,
        enabled: parsed.enabled !== undefined ? parsed.enabled : isGranted,
      };
    }
  } catch {
    // Ignora erro
  }
  const isGranted = typeof Notification !== 'undefined' && Notification.permission === 'granted';
  return { ...DEFAULT_NOTIFICATION_PREFERENCES, enabled: isGranted };
}

/**
 * Salva as preferências de notificação do usuário
 */
export function saveNotificationPreferences(prefs: Partial<NotificationPreferences>): NotificationPreferences {
  const current = getNotificationPreferences();
  const updated = { ...current, ...prefs };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(updated));
  } catch {
    // Ignora erro
  }
  return updated;
}

/**
 * Verifica se o dispositivo / navegador suporta notificações
 */
export function isNotificationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'Notification' in window && ('serviceWorker' in navigator || 'showNotification' in ServiceWorkerRegistration.prototype);
}

/**
 * Retorna o status de permissão atual: 'granted' | 'denied' | 'default' | 'unsupported'
 */
export function getDeviceNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Solicita ao usuário a permissão para exibir notificações nativas no celular
 */
export async function requestDeviceNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) return 'unsupported';

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      saveNotificationPreferences({ enabled: true });
    } else if (permission === 'denied') {
      saveNotificationPreferences({ enabled: false });
    }
    return permission;
  } catch (error) {
    console.warn('Erro ao solicitar permissão de notificações:', error);
    return Notification.permission;
  }
}

/**
 * Toca um sinal sonoro agradável e suave usando Web Audio API
 */
export function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Arpejo duplo suave (F5 -> A5)
    osc.frequency.setValueAtTime(698.46, ctx.currentTime);
    osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
  } catch {
    // Ignora se o contexto de áudio estiver suspenso
  }
}

/**
 * Vibra o dispositivo celular se suportado
 */
export function triggerVibration(pattern: number[] = [150, 60, 150]) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Ignora erro
  }
}

/**
 * Verifica se uma notificação com a chave especificada já foi disparada
 */
function hasBeenNotified(key: string): boolean {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEYS_STORAGE);
    if (!raw) return false;
    const list: string[] = JSON.parse(raw);
    return list.includes(key);
  } catch {
    return false;
  }
}

/**
 * Registra que a notificação foi enviada para não repetir desnecessariamente
 */
function markAsNotified(key: string) {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEYS_STORAGE);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(key)) {
      list.push(key);
      // Mantém no máximo os 200 registros mais recentes
      const trimmed = list.slice(-200);
      localStorage.setItem(NOTIFIED_KEYS_STORAGE, JSON.stringify(trimmed));
    }
  } catch {
    // Ignora erro
  }
}

/**
 * Envia uma notificação nativa para o celular / navegador via Service Worker
 * e também projeta na tela (Heads-up banner) para máxima visibilidade
 */
export async function sendDeviceNotification(
  title: string,
  options: {
    body: string;
    tag?: string;
    icon?: string;
    data?: any;
    requireInteraction?: boolean;
  }
): Promise<boolean> {
  const prefs = getNotificationPreferences();
  if (!prefs.enabled) return false;

  // Vibração e som suave se habilitados nas preferências
  if (prefs.somVibracao) {
    triggerVibration([250, 100, 250, 100, 250]);
    playNotificationChime();
  }

  // 1. Dispara o banner visual flutuante NA TELA (Heads-Up Banner)
  // Isso garante que mesmo com o app aberto ou na tela de bloqueio, o usuário enxergue na hora!
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent('sutello_heads_up_notification', {
          detail: {
            id: `banner_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            title,
            body: options.body,
            tag: options.tag,
            tipo: options.data?.tipo || 'info',
            contaId: options.data?.contaId,
            timestamp: Date.now(),
          },
        })
      );
    } catch {
      // Ignora erro se evento falhar
    }
  }

  if (!isNotificationSupported()) return true; // Já exibiu na tela
  if (Notification.permission !== 'granted') return true;

  const notificationOptions = {
    body: options.body,
    icon: options.icon || './icon-192.png',
    badge: './icon-192.png',
    tag: options.tag || `sutello_${Date.now()}`,
    vibrate: [250, 100, 250, 100, 250],
    renotify: true,
    requireInteraction: options.requireInteraction || false,
    silent: false,
    data: {
      url: './',
      timestamp: Date.now(),
      ...(options.data || {}),
    },
    actions: [
      { action: 'open', title: 'Abrir' }
    ]
  };

  try {
    // 2. Dispara através do Service Worker ativo (aparece na barra e na tela de bloqueio do celular)
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, notificationOptions as any);
        return true;
      }
    }

    // Fallback para Notification API padrão do navegador
    new Notification(title, notificationOptions as any);
    return true;
  } catch (error) {
    console.warn('Erro ao disparar notificação nativa:', error);
    try {
      new Notification(title, notificationOptions as any);
      return true;
    } catch {
      return true; // Banner na tela já funcionou
    }
  }
}

/**
 * Dispara notificação no celular quando uma CONTA VENCEU (Atrasada individual)
 * Formato super otimizado que exibe tudo no título sem precisar expandir
 */
export async function notifyContaVencida(conta: Conta, diasAtraso: number): Promise<boolean> {
  const prefs = getNotificationPreferences();
  if (!prefs.contasVencidas || !prefs.enabled) return false;

  const key = `notif_vencida_${conta.id}_${conta.vencimento}`;
  if (hasBeenNotified(key)) return false;

  const textoAtraso = diasAtraso === 1 ? 'venceu ontem' : `venceu há ${diasAtraso} dias`;
  const sucesso = await sendDeviceNotification(`⚠️ VENCEU: ${conta.nome} • R$ ${formatCurrency(conta.valor)}`, {
    body: `Vencimento: ${isoParaBR(conta.vencimento)} • ${textoAtraso}`,
    tag: `vencida_${conta.id}`,
    data: { contaId: conta.id, tipo: 'atrasada' },
  });

  if (sucesso) {
    markAsNotified(key);
  }
  return sucesso;
}

/**
 * Dispara notificação agrupada para contas vencidas (atrasadas):
 * Se houver apenas 1 conta: exibe o detalhe individual dela.
 * Se houver mais de 1 conta: agrupa com clareza ("Aluguel e mais 2 contas em atraso")
 * evitando encher o celular de notificações repetidas ao mesmo tempo.
 */
export async function notifyContasVencidasAgrupadas(
  contasComAtraso: { conta: Conta; diasAtraso: number }[]
): Promise<boolean> {
  if (!contasComAtraso || contasComAtraso.length === 0) return false;
  const prefs = getNotificationPreferences();
  if (!prefs.contasVencidas || !prefs.enabled) return false;

  if (contasComAtraso.length === 1) {
    return notifyContaVencida(contasComAtraso[0].conta, contasComAtraso[0].diasAtraso);
  }

  const hojeStr = new Date().toISOString().split('T')[0];
  const idsSorted = contasComAtraso.map((item) => item.conta.id).sort().join('_');
  const key = `notif_grupo_vencidas_${hojeStr}_qtd${contasComAtraso.length}_${idsSorted}`;
  if (hasBeenNotified(key)) return false;

  const primeira = contasComAtraso[0].conta;
  const outrasQtd = contasComAtraso.length - 1;
  const totalValor = contasComAtraso.reduce((sum, item) => sum + (Number(item.conta.valor) || 0), 0);

  const titulo = `⚠️ ${contasComAtraso.length} CONTAS ATRASADAS • R$ ${formatCurrency(totalValor)}`;
  const corpo = `${primeira.nome} e mais ${outrasQtd} ${outrasQtd === 1 ? 'conta estão vencidas' : 'contas estão vencidas'}. Toque para ver e quitar!`;

  const sucesso = await sendDeviceNotification(titulo, {
    body: corpo,
    tag: `vencidas_agrupadas_${hojeStr}`,
    data: { tipo: 'atrasada', qtd: contasComAtraso.length },
  });

  if (sucesso) {
    markAsNotified(key);
  }
  return sucesso;
}

/**
 * Dispara notificação no celular quando uma CONTA VENCE HOJE (individual)
 */
export async function notifyContaVenceHoje(conta: Conta): Promise<boolean> {
  const prefs = getNotificationPreferences();
  if (!prefs.contasVenceHoje || !prefs.enabled) return false;

  const key = `notif_hoje_${conta.id}_${conta.vencimento}`;
  if (hasBeenNotified(key)) return false;

  const sucesso = await sendDeviceNotification(`⏰ VENCE HOJE: ${conta.nome} • R$ ${formatCurrency(conta.valor)}`, {
    body: `Vencimento hoje (${isoParaBR(conta.vencimento)}) • Toque para ver ou marcar como paga`,
    tag: `hoje_${conta.id}`,
    data: { contaId: conta.id, tipo: 'hoje' },
  });

  if (sucesso) {
    markAsNotified(key);
  }
  return sucesso;
}

/**
 * Dispara notificação agrupada para contas que vencem hoje:
 * Se houver apenas 1 conta: exibe o detalhe dela.
 * Se houver mais de 1 conta: agrupa de forma inteligente (ex: "Luz e mais 2 contas vencem hoje")
 * para não sobrecarregar com várias notificações sonoras simultâneas.
 */
export async function notifyContasVenceHojeAgrupadas(contas: Conta[]): Promise<boolean> {
  if (!contas || contas.length === 0) return false;
  const prefs = getNotificationPreferences();
  if (!prefs.contasVenceHoje || !prefs.enabled) return false;

  if (contas.length === 1) {
    return notifyContaVenceHoje(contas[0]);
  }

  const hojeStr = new Date().toISOString().split('T')[0];
  const idsSorted = contas.map((c) => c.id).sort().join('_');
  const key = `notif_grupo_hoje_${hojeStr}_qtd${contas.length}_${idsSorted}`;
  if (hasBeenNotified(key)) return false;

  const primeira = contas[0];
  const outrasQtd = contas.length - 1;
  const totalValor = contas.reduce((sum, c) => sum + (Number(c.valor) || 0), 0);

  const titulo = `⏰ ${contas.length} CONTAS VENCEM HOJE • R$ ${formatCurrency(totalValor)}`;
  const corpo = `${primeira.nome} e mais ${outrasQtd} ${outrasQtd === 1 ? 'conta vencem' : 'contas vencem'} hoje. Toque para ver!`;

  const sucesso = await sendDeviceNotification(titulo, {
    body: corpo,
    tag: `hoje_agrupado_${hojeStr}`,
    data: { tipo: 'hoje', qtd: contas.length },
  });

  if (sucesso) {
    markAsNotified(key);
  }
  return sucesso;
}

/**
 * Dispara notificação no celular quando uma CONTA ACABOU TODAS AS PARCELAS (Quitada)
 */
export async function notifyParcelasConcluidas(conta: Conta): Promise<boolean> {
  const prefs = getNotificationPreferences();
  if (!prefs.parcelasQuitadas || !prefs.enabled) return false;

  const total = conta.totalParcelas || conta.parcelaAtual || 1;
  const key = `notif_quitada_${conta.id}_${total}`;
  if (hasBeenNotified(key)) return false;

  const sucesso = await sendDeviceNotification(`🎉 QUITADA: ${conta.nome} • 100% Paga!`, {
    body: `Todas as ${total} parcelas foram quitadas com sucesso!`,
    tag: `quitada_${conta.id}`,
    data: { contaId: conta.id, tipo: 'parcela_quitada' },
  });

  if (sucesso) {
    markAsNotified(key);
  }
  return sucesso;
}

/**
 * Dispara notificação no celular quando ALGUÉM ADICIONOU UMA NOVA CONTA
 */
export async function notifyNovaConta(conta: Conta, autor?: string): Promise<boolean> {
  const prefs = getNotificationPreferences();
  if (!prefs.novasContas || !prefs.enabled) return false;

  const key = `notif_nova_conta_${conta.id}`;
  if (hasBeenNotified(key)) return false;

  const autorInfo = autor && autor.trim() ? ` • Por ${autor}` : '';
  const parcelasInfo = conta.totalParcelas && conta.totalParcelas > 1 ? ` (${conta.totalParcelas}x)` : '';
  const sucesso = await sendDeviceNotification(`🔔 NOVA CONTA: ${conta.nome} • R$ ${formatCurrency(conta.valor)}`, {
    body: `Vencimento: ${isoParaBR(conta.vencimento)}${parcelasInfo}${autorInfo}`,
    tag: `nova_${conta.id}`,
    data: { contaId: conta.id, tipo: 'nova_conta' },
  });

  if (sucesso) {
    markAsNotified(key);
  }
  return sucesso;
}

/**
 * Dispara notificação no celular quando uma CONTA FOI PAGA (em outro aparelho ou no app)
 */
export async function notifyContaPaga(conta: Conta, pagador?: string): Promise<boolean> {
  const prefs = getNotificationPreferences();
  if (!prefs.contasPagas || !prefs.enabled) return false;

  const key = `notif_paga_${conta.id}_${conta.parcelaAtual || 1}`;
  if (hasBeenNotified(key)) return false;

  const pagadorInfo = pagador && pagador.trim() ? ` por ${pagador}` : '';
  const parcelasInfo = conta.totalParcelas && conta.totalParcelas > 1 ? ` • Parcela ${conta.parcelaAtual || 1}/${conta.totalParcelas}` : '';
  const sucesso = await sendDeviceNotification(`✅ PAGA: ${conta.nome} • R$ ${formatCurrency(conta.valor)}`, {
    body: `Marcada como paga${pagadorInfo}${parcelasInfo}`,
    tag: `paga_${conta.id}`,
    data: { contaId: conta.id, tipo: 'conta_paga' },
  });

  if (sucesso) {
    markAsNotified(key);
  }
  return sucesso;
}

/**
 * Dispara uma notificação de teste imediata para que o usuário sinta a vibração e veja no celular
 */
export async function triggerTestNotification(): Promise<boolean> {
  return sendDeviceNotification('🔔 Sutello Financeiro • Alertas Ativos!', {
    body: 'Notificações na tela, na barra e na tela de bloqueio ativadas com som e vibração.',
    tag: `teste_${Date.now()}`,
    data: { tipo: 'teste' },
  });
}

/**
 * Dispara notificação no celular enviada via Transmissão ADM para todos os aparelhos
 */
export async function notifyBroadcastAdmin(
  titulo: string,
  mensagem: string,
  urgencia: 'alta' | 'media' | 'baixa' = 'alta',
  broadcastId?: string
): Promise<boolean> {
  const key = `broadcast_${broadcastId || titulo}_${mensagem.substring(0, 10)}`;
  if (hasBeenNotified(key)) return false;

  const prefix = urgencia === 'alta' ? '🚨 ' : urgencia === 'media' ? '📢 ' : '💬 ';
  const sucesso = await sendDeviceNotification(`${prefix}${titulo}`, {
    body: mensagem,
    tag: `adm_broadcast_${broadcastId || Date.now()}`,
    requireInteraction: urgencia === 'alta',
    data: { tipo: 'transmissao_adm', broadcastId },
  });

  if (sucesso) {
    markAsNotified(key);
  }
  return sucesso;
}

/**
 * Dispara notificação no celular para compromissos e lembretes da Agenda:
 * - 1 dia antes do compromisso (amanhã)
 * - No próprio dia do compromisso (hoje)
 * Sempre exibe de quem é o compromisso (Vitórya ou Leonardo), título, data e horário.
 */
export async function notifyAgendaCompromissos(itens: ItemAgenda[]): Promise<void> {
  if (!itens || itens.length === 0) return;

  const hoje = new Date();
  const yyyy = hoje.getFullYear();
  const mm = String(hoje.getMonth() + 1).padStart(2, '0');
  const dd = String(hoje.getDate()).padStart(2, '0');
  const hojeStr = `${yyyy}-${mm}-${dd}`;
  const hojeDate = new Date(hojeStr + 'T00:00:00');

  for (const item of itens) {
    if (item.concluido || !item.data) continue;

    let dataStr = String(item.data).trim();
    if (dataStr.includes('/')) {
      const p = dataStr.split('/');
      if (p.length === 3) dataStr = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
    } else if (dataStr.includes('T')) {
      dataStr = dataStr.split('T')[0];
    }

    const compDate = new Date(dataStr + 'T00:00:00');
    if (isNaN(compDate.getTime())) continue;

    const diffMs = compDate.getTime() - hojeDate.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    const nomePessoa = item.pessoa || 'Leonardo';
    const horaInfo = item.hora ? ` às ${item.hora}` : '';
    const dataFormatada = isoParaBR(dataStr);

    // 1. No próprio dia do compromisso (diffDays === 0)
    if (diffDays === 0) {
      const keyHoje = `notif_agenda_hoje_${item.id}_${hojeStr}`;
      if (!hasBeenNotified(keyHoje)) {
        const prefs = getNotificationPreferences();
        if (!prefs.enabled && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          saveNotificationPreferences({ enabled: true });
        }

        const titulo = `📅 HOJE (${nomePessoa}): ${item.titulo}`;
        const corpo = `Compromisso de ${nomePessoa} hoje (${dataFormatada})${horaInfo}.${
          item.descricao ? ` Obs: ${item.descricao}` : ''
        }`;

        const ok = await sendDeviceNotification(titulo, {
          body: corpo,
          tag: `agenda_hoje_${item.id}`,
          requireInteraction: true,
          data: { tipo: 'hoje', agendaId: item.id, pessoa: nomePessoa },
        });
        if (ok) markAsNotified(keyHoje);
      }
    }

    // 2. Um dia antes do compromisso (diffDays === 1)
    if (diffDays === 1) {
      const keyVespera = `notif_agenda_vespera_${item.id}_${hojeStr}`;
      if (!hasBeenNotified(keyVespera)) {
        const prefs = getNotificationPreferences();
        if (!prefs.enabled && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          saveNotificationPreferences({ enabled: true });
        }

        const titulo = `🔔 AMANHÃ (${nomePessoa}): ${item.titulo}`;
        const corpo = `Lembrete de véspera: Compromisso de ${nomePessoa} amanhã (${dataFormatada})${horaInfo}.${
          item.descricao ? ` Obs: ${item.descricao}` : ''
        }`;

        const ok = await sendDeviceNotification(titulo, {
          body: corpo,
          tag: `agenda_vespera_${item.id}`,
          requireInteraction: false,
          data: { tipo: 'breve', agendaId: item.id, pessoa: nomePessoa },
        });
        if (ok) markAsNotified(keyVespera);
      }
    }
  }
}
