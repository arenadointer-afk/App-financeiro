import { Conta } from '../types';
import { formatCurrency, isoParaBR } from './utils';

export interface NotificationPreferences {
  enabled: boolean;
  contasVencidas: boolean;
  parcelasQuitadas: boolean;
  novasContas: boolean;
  somVibracao: boolean;
}

const PREFS_KEY = 'sutello_notification_settings';
const NOTIFIED_KEYS_STORAGE = 'sutello_device_notified_keys';

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: false,
  contasVencidas: true,
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
  if (!isNotificationSupported()) return false;
  if (Notification.permission !== 'granted') return false;

  // Vibração e som suave se habilitados nas preferências
  if (prefs.somVibracao) {
    triggerVibration([200, 100, 200]);
    playNotificationChime();
  }

  const notificationOptions = {
    body: options.body,
    icon: options.icon || './icon-192.png',
    badge: './icon-192.png',
    tag: options.tag || `sutello_${Date.now()}`,
    vibrate: [200, 100, 200],
    requireInteraction: options.requireInteraction || false,
    data: {
      url: './',
      timestamp: Date.now(),
      ...(options.data || {}),
    },
  };

  try {
    // 1. Tenta disparar através do Service Worker ativo (melhor suporte no Android e iOS PWA)
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, notificationOptions as any);
        return true;
      }
    }

    // 2. Fallback para Notification API padrão do navegador
    new Notification(title, notificationOptions as any);
    return true;
  } catch (error) {
    console.warn('Erro ao disparar notificação nativa:', error);
    try {
      new Notification(title, notificationOptions as any);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Dispara notificação no celular quando uma CONTA VENCEU (Atrasada)
 */
export async function notifyContaVencida(conta: Conta, diasAtraso: number): Promise<boolean> {
  const prefs = getNotificationPreferences();
  if (!prefs.contasVencidas || !prefs.enabled) return false;

  const key = `notif_vencida_${conta.id}_${conta.vencimento}`;
  if (hasBeenNotified(key)) return false;

  const textoAtraso = diasAtraso === 1 ? 'venceu ontem' : `está vencida há ${diasAtraso} dias`;
  const sucesso = await sendDeviceNotification('⚠️ Conta Vencida!', {
    body: `A conta "${conta.nome}" ${textoAtraso} (${isoParaBR(conta.vencimento)}) no valor de R$ ${formatCurrency(conta.valor)}. Toque para conferir!`,
    tag: `vencida_${conta.id}`,
    data: { contaId: conta.id, tipo: 'atrasada' },
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

  const sucesso = await sendDeviceNotification('🎉 Todas as parcelas quitadas!', {
    body: `Parabéns! A conta "${conta.nome}" teve todas as ${total} parcelas pagas com sucesso! Mais uma dívida zerada.`,
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

  const autorInfo = autor && autor.trim() ? ` por ${autor}` : '';
  const parcelasInfo = conta.totalParcelas && conta.totalParcelas > 1 ? ` em ${conta.totalParcelas}x` : '';
  const sucesso = await sendDeviceNotification('🔔 Nova conta adicionada!', {
    body: `"${conta.nome}" de R$ ${formatCurrency(conta.valor)}${parcelasInfo} foi cadastrada${autorInfo}. Vencimento: ${isoParaBR(conta.vencimento)}.`,
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
  if (!prefs.enabled) return false;

  const key = `notif_paga_${conta.id}_${conta.parcelaAtual || 1}`;
  if (hasBeenNotified(key)) return false;

  const pagadorInfo = pagador && pagador.trim() ? ` por ${pagador}` : '';
  const sucesso = await sendDeviceNotification('✅ Conta Paga!', {
    body: `"${conta.nome}" de R$ ${formatCurrency(conta.valor)} foi marcada como paga${pagadorInfo}.`,
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
  return sendDeviceNotification('🔔 Sutello Financeiro', {
    body: 'Notificações no celular ativadas com sucesso! Você receberá avisos de contas vencidas, parcelas concluídas e novas contas.',
    tag: `teste_${Date.now()}`,
    data: { tipo: 'teste' },
  });
}
