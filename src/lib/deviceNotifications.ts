import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import {
  Conta,
  ItemAgenda,
  MensagemTransmissao,
  Caixinha,
  DadosSaude,
  MedicamentoSaude,
  RegistroPesoAltura,
} from '../types';
import { formatCurrency, isoParaBR } from './utils';
import { auth } from './firebase';

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
  enabled: true,
  contasVencidas: true,
  contasVenceHoje: true,
  contasPagas: true,
  parcelasQuitadas: true,
  novasContas: true,
  somVibracao: true,
};

/**
 * Detecta se o aplicativo está rodando como APK nativo (Capacitor Android/iOS ou Ponte Nativa)
 */
export function isRunningInsideNativeAPK(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    if (Capacitor.isNativePlatform() || typeof (window as any).SutelloNativeAndroid !== 'undefined' || typeof (window as any).Capacitor !== 'undefined') {
      return true;
    }
    const ua = (window.navigator?.userAgent || '').toLowerCase();
    // Detecta Android WebView (; wv) usado pelo APK do Capacitor
    if (ua.includes('android') && (ua.includes('; wv)') || ua.includes('wv)'))) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export const isNativeApkPlatform = isRunningInsideNativeAPK;
export const NATIVE_CHANNEL_FINANCEIRO = 'sutello_alertas_max';
export const NATIVE_CHANNEL_AGENDA = 'sutello_alertas_max';

let nativeChannelCreated = false;

/**
 * Cria o canal de notificações de importância máxima no Android Nativo (APK)
 * para garantir som, vibração, banner flutuante (Heads-Up) e exibição na tela de bloqueio
 */
export async function ensureNativeNotificationChannel(): Promise<void> {
  if (!isRunningInsideNativeAPK() || nativeChannelCreated) return;
  try {
    await LocalNotifications.createChannel({
      id: 'sutello_alertas_max',
      name: 'Alertas Financeiros e Agenda',
      description: 'Notificações de vencimento de contas, acordos, saúde e compromissos da agenda',
      importance: 5, // IMPORTANCE_HIGH / MAX (toca som e mostra banner no topo da tela do Android)
      visibility: 1, // VISIBILITY_PUBLIC (aparece na tela de bloqueio)
      vibration: true,
      lights: true,
      lightColor: '#9333EA',
    });
    nativeChannelCreated = true;
  } catch (err) {
    console.warn('Aviso ao configurar canal nativo Android:', err);
  }
}

/**
 * Retorna as preferências salvas do usuário para notificações no celular
 */
export function getNotificationPreferences(): NotificationPreferences {
  if (typeof window === 'undefined') return DEFAULT_NOTIFICATION_PREFERENCES;
  try {
    const saved = localStorage.getItem(PREFS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        ...parsed,
        enabled: parsed.enabled !== false,
      };
    }
  } catch {
    // Ignora erro
  }
  return { ...DEFAULT_NOTIFICATION_PREFERENCES, enabled: true };
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
 * Verifica se o dispositivo / navegador / APK suporta notificações
 */
export function isNotificationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  if (isRunningInsideNativeAPK()) return true;
  return 'Notification' in window && ('serviceWorker' in navigator || 'showNotification' in ServiceWorkerRegistration.prototype);
}

/**
 * Retorna o status de permissão atual: 'granted' | 'denied' | 'default' | 'unsupported'
 */
export function getDeviceNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  if (isRunningInsideNativeAPK()) {
    const prefs = getNotificationPreferences();
    return prefs.enabled ? 'granted' : 'default';
  }
  return Notification.permission;
}

export const ensureNativeAndroidChannels = ensureNativeNotificationChannel;

/**
 * Verifica de forma assíncrona a permissão real no Android APK ou Navegador
 */
export async function checkDeviceNotificationPermissionAsync(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) return 'unsupported';
  if (isRunningInsideNativeAPK()) {
    try {
      const status = await LocalNotifications.checkPermissions();
      if (status.display === 'granted') return 'granted';
      if (status.display === 'denied') return 'denied';
      return 'default';
    } catch {
      return getDeviceNotificationPermission();
    }
  }
  return getDeviceNotificationPermission();
}

/**
 * Solicita ao usuário a permissão para exibir notificações nativas no celular (APK Android 13+ ou Navegador/PWA)
 */
export async function requestDeviceNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) return 'unsupported';

  // Se estiver rodando dentro do APK Android nativo (Capacitor)
  if (isRunningInsideNativeAPK()) {
    try {
      await ensureNativeNotificationChannel();
      const status = await LocalNotifications.requestPermissions();
      if (status.display === 'granted') {
        saveNotificationPreferences({ enabled: true });
        return 'granted';
      } else if (status.display === 'denied') {
        saveNotificationPreferences({ enabled: false });
        return 'denied';
      }
      return 'default';
    } catch (err) {
      console.warn('Erro ao solicitar permissão nativa no APK:', err);
      saveNotificationPreferences({ enabled: true });
      return 'granted';
    }
  }

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
 * Gera um ID numérico único de 31 bits para notificações nativas do Android
 */
function hashNotificationId(tag: string): number {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash << 5) - hash + tag.charCodeAt(i);
    hash |= 0;
  }
  const positive = Math.abs(hash);
  return positive === 0 ? Math.floor(Math.random() * 100000) + 1 : positive % 2147483000;
}

/**
 * Envia uma notificação nativa para o celular (APK Android via Capacitor LocalNotifications
 * ou Navegador/PWA via Service Worker) e também projeta na tela (Heads-up banner)
 */
export async function sendDeviceNotification(
  title: string,
  options: {
    body: string;
    tag?: string;
    icon?: string;
    image?: string;
    linkUrl?: string;
    botaoTexto?: string;
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

  const targetModal = options.data?.targetModal || '';
  const targetSaudeTab = options.data?.targetSaudeTab || '';
  const linkUrl = options.linkUrl || options.data?.linkUrl || '';
  const botaoTexto = options.botaoTexto || options.data?.botaoTexto || '';
  const imagemUrl = options.image || options.data?.imagemUrl || '';

  // 1. Dispara exclusivamente a Notificação Nativa do Celular (sem banner flutuante dentro do app)
  // Se estiver rodando dentro do APK Android Nativo, dispara pela Ponte Nativa Rica (suporta botões, links, imagens e abas nativas)!
  if (typeof window !== 'undefined' && (window as any).SutelloNativeAndroid) {
    try {
      const bridge = (window as any).SutelloNativeAndroid;
      if (typeof bridge.triggerRichNativeNotification === 'function') {
        bridge.triggerRichNativeNotification(
          title,
          options.body,
          targetModal,
          targetSaudeTab,
          linkUrl,
          botaoTexto,
          imagemUrl
        );
        return true;
      } else if (typeof bridge.triggerNativeNotificationWithTarget === 'function') {
        try {
          bridge.triggerNativeNotificationWithTarget(title, options.body, targetModal, targetSaudeTab);
        } catch {
          bridge.triggerNativeNotificationWithTarget(title, options.body, targetModal);
        }
        return true;
      } else if (typeof bridge.triggerNativeNotificationNow === 'function') {
        bridge.triggerNativeNotificationNow(title, options.body);
        return true;
      }
    } catch {}
  }

  if (isRunningInsideNativeAPK()) {
    try {
      await ensureNativeNotificationChannel();
      const notifId = hashNotificationId(options.tag || `sutello_${Date.now()}`);
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId,
            title,
            body: options.body,
            channelId: 'sutello_alertas_max',
            smallIcon: 'ic_stat_sutello',
            iconColor: '#9333EA',
            extra: {
              url: linkUrl || './',
              linkUrl,
              botaoTexto,
              imagemUrl,
              timestamp: Date.now(),
              ...(options.data || {}),
            },
            schedule: { at: new Date(Date.now() + 250), allowWhileIdle: true },
          },
        ],
      });
      return true;
    } catch (nativeErr) {
      console.warn('Erro ao disparar LocalNotification nativa no APK:', nativeErr);
    }
  }

  if (!isNotificationSupported()) return true; // Já exibiu na tela
  if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') return true;

  const actionsList: { action: string; title: string }[] = [];
  if (linkUrl) {
    actionsList.push({ action: 'open_link', title: botaoTexto || 'Acessar Link' });
  }
  actionsList.push({ action: 'open', title: botaoTexto && !linkUrl ? botaoTexto : 'Abrir no App' });

  const notificationOptions: any = {
    body: options.body,
    icon: options.icon || './icon-192.png',
    badge: './icon-192.png',
    ...(imagemUrl ? { image: imagemUrl } : {}),
    tag: options.tag || `sutello_${Date.now()}`,
    vibrate: [250, 100, 250, 100, 250],
    renotify: true,
    requireInteraction: options.requireInteraction || false,
    silent: false,
    data: {
      url: linkUrl || './',
      linkUrl,
      botaoTexto,
      imagemUrl,
      timestamp: Date.now(),
      ...(options.data || {}),
    },
    actions: actionsList,
  };

  try {
    // 3. Dispara através do Service Worker ativo (aparece na barra e na tela de bloqueio do celular)
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
 * Dispara notificação no celular enviada via Transmissão ADM para todos os aparelhos (com suporte a link, botão, imagem e aba destino)
 */
export async function notifyBroadcastAdmin(
  titulo: string,
  mensagem: string,
  urgencia: 'alta' | 'media' | 'baixa' = 'alta',
  broadcastId?: string,
  extraRich?: {
    linkUrl?: string;
    botaoTexto?: string;
    imagemUrl?: string;
    targetModal?: 'saude' | 'caixinhas' | 'agenda' | 'acordos' | 'notificacoes' | 'settings';
    targetSaudeTab?: 'pesoxaltura' | 'remedios' | 'consultas' | 'metricas' | 'cartao';
  }
): Promise<boolean> {
  const key = `broadcast_${broadcastId || titulo}_${mensagem.substring(0, 10)}`;
  if (hasBeenNotified(key)) return false;

  const prefix = urgencia === 'alta' ? '🚨 ' : urgencia === 'media' ? '📢 ' : '💬 ';
  const sucesso = await sendDeviceNotification(`${prefix}${titulo}`, {
    body: mensagem,
    tag: `adm_broadcast_${broadcastId || Date.now()}`,
    requireInteraction: urgencia === 'alta',
    image: extraRich?.imagemUrl,
    linkUrl: extraRich?.linkUrl,
    botaoTexto: extraRich?.botaoTexto,
    data: {
      tipo: 'transmissao_adm',
      broadcastId,
      linkUrl: extraRich?.linkUrl,
      botaoTexto: extraRich?.botaoTexto,
      imagemUrl: extraRich?.imagemUrl,
      targetModal: extraRich?.targetModal,
      targetSaudeTab: extraRich?.targetSaudeTab,
    },
  });

  if (sucesso) {
    markAsNotified(key);
  }
  return sucesso;
}

/**
 * 1) Saúde: Lembrete mensal de pesagem (quando a última pesagem de Vitórya ou Leonardo completou 30 dias / 1 mês)
 * Exemplo: "Vitórya, sua última pesagem faz um mês! Atualize seu peso."
 * Ao clicar na notificação, abre direto a aba Saúde (Peso x Altura).
 */
export async function checkAndNotifySaudePesagemMensal(dadosSaude?: DadosSaude): Promise<void> {
  if (!dadosSaude?.historicoPesoAltura || dadosSaude.historicoPesoAltura.length === 0) return;

  const hoje = new Date();
  const hojeStr = hoje.toISOString().split('T')[0];
  const hojeMs = new Date(hojeStr + 'T00:00:00').getTime();

  const pessoas: ('Vitórya' | 'Leonardo')[] = ['Vitórya', 'Leonardo'];

  for (const pessoa of pessoas) {
    const normTarget = pessoa === 'Vitórya' ? 'vit' : 'leo';
    const registrosPessoa = dadosSaude.historicoPesoAltura
      .filter((r) => {
        const pNorm = (r.pessoa || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return pNorm.includes(normTarget);
      })
      .sort((a, b) => (b.data + (b.hora || '')).localeCompare(a.data + (a.hora || '')));

    if (registrosPessoa.length === 0) continue;

    const ultimo = registrosPessoa[0];
    if (!ultimo.data) continue;

    let dataUltimaStr = String(ultimo.data).trim();
    if (dataUltimaStr.includes('/')) {
      const p = dataUltimaStr.split('/');
      if (p.length === 3) dataUltimaStr = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
    } else if (dataUltimaStr.includes('T')) {
      dataUltimaStr = dataUltimaStr.split('T')[0];
    }

    const dtUltima = new Date(dataUltimaStr + 'T00:00:00');
    if (isNaN(dtUltima.getTime())) continue;

    const diffDays = Math.floor((hojeMs - dtUltima.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 30) {
      // Notifica no máximo 1x por mês/semana para aquele último registro até que a pessoa atualize
      const mesAnoAtual = hojeStr.substring(0, 7);
      const key = `notif_pesagem_mensal_${pessoa}_${ultimo.id}_${mesAnoAtual}`;
      if (!hasBeenNotified(key)) {
        const ok = await sendDeviceNotification(`⚖️ ${pessoa}, sua última pesagem faz 1 mês!`, {
          body: `${pessoa}, sua última pesagem foi em ${isoParaBR(dataUltimaStr)} (${ultimo.peso.toFixed(1)} kg — há ${diffDays} dias). Toque para abrir a aba Saúde e atualizar!`,
          tag: `saude_pesagem_mensal_${pessoa}`,
          requireInteraction: true,
          data: {
            tipo: 'saude_peso',
            targetModal: 'saude',
            targetSaudeTab: 'pesoxaltura',
            pessoa,
          },
        });
        if (ok) markAsNotified(key);
      }
    }
  }
}

/**
 * 2) Saúde: Notificação quando alguém adiciona um novo peso
 */
export async function notifyNovoPesoAdicionado(registro: RegistroPesoAltura): Promise<boolean> {
  if (!registro || !registro.peso) return false;
  const key = `notif_novo_peso_${registro.id}`;
  if (hasBeenNotified(key)) return false;

  const nomePessoa = registro.pessoa || 'Vitórya';
  const imcInfo = registro.imc ? ` • IMC: ${registro.imc}` : '';
  const classInfo = registro.classificacao ? ` (${registro.classificacao})` : '';

  const ok = await sendDeviceNotification(`⚖️ Novo Peso Registrado: ${nomePessoa} (${registro.peso.toFixed(1)} kg)`, {
    body: `${nomePessoa} registrou um novo peso de ${registro.peso.toFixed(1)} kg${imcInfo}${classInfo}. Toque para abrir a aba Saúde!`,
    tag: `saude_novo_peso_${registro.id}`,
    data: {
      tipo: 'saude_peso',
      targetModal: 'saude',
      targetSaudeTab: 'pesoxaltura',
      pesoId: registro.id,
    },
  });

  if (ok) markAsNotified(key);
  return ok;
}

/**
 * 3) Saúde: Notificação de Parabéns quando chega na meta de peso!
 */
export async function notifyMetaPesoAtingida(
  pessoa: string,
  pesoAtual: number,
  metaPeso: number,
  registroId?: string
): Promise<boolean> {
  if (!metaPeso || metaPeso <= 0 || !pesoAtual || pesoAtual <= 0) return false;

  const key = `notif_meta_peso_atingida_${pessoa}_${metaPeso}_${registroId || pesoAtual}`;
  if (hasBeenNotified(key)) return false;

  const ok = await sendDeviceNotification(`🎉 PARABÉNS ${pessoa.toUpperCase()}! Meta de Peso Atingida!`, {
    body: `Incrível, ${pessoa}! Você chegou a ${pesoAtual.toFixed(1)} kg e alcançou sua meta de peso (${metaPeso.toFixed(1)} kg)! 🏆 Toque para comemorar na aba Saúde!`,
    tag: `saude_meta_peso_${pessoa}`,
    requireInteraction: true,
    data: {
      tipo: 'saude_meta',
      targetModal: 'saude',
      targetSaudeTab: 'pesoxaltura',
      pessoa,
    },
  });

  if (ok) markAsNotified(key);
  return ok;
}

/**
 * 4) Caixinha: Notificação de Parabéns quando completa o valor da meta da caixinha!
 */
export async function notifyCaixinhaMetaAtingida(caixinha: Caixinha): Promise<boolean> {
  if (!caixinha || !caixinha.meta || caixinha.meta <= 0) return false;
  if ((caixinha.saldo || 0) < caixinha.meta) return false;

  const key = `notif_caixinha_meta_${caixinha.id}_${caixinha.meta}`;
  if (hasBeenNotified(key)) return false;

  const ok = await sendDeviceNotification(`🎉 META CONCLUÍDA: Caixinha "${caixinha.nome}"!`, {
    body: `Parabéns! Você completou 100% da meta da caixinha "${caixinha.nome}" com R$ ${formatCurrency(caixinha.saldo)} (Meta: R$ ${formatCurrency(caixinha.meta)})! 🏆`,
    tag: `caixinha_meta_${caixinha.id}`,
    requireInteraction: true,
    data: {
      tipo: 'caixinha_meta',
      targetModal: 'caixinhas',
      caixinhaId: caixinha.id,
    },
  });

  if (ok) markAsNotified(key);
  return ok;
}

/**
 * 5) Saúde (Remédios): Notificação lembrando de tomar o remédio na hora cadastrada com o nome do remédio
 * Suporta remédio fixo (contínuo) ou temporário (apenas alguns dias até dataFim) — sem precisar confirmar "Tomar"
 */
export async function checkAndNotifyRemediosHorario(medicamentos?: MedicamentoSaude[]): Promise<void> {
  if (!medicamentos || medicamentos.length === 0) return;

  const agora = new Date();
  const yyyy = agora.getFullYear();
  const mm = String(agora.getMonth() + 1).padStart(2, '0');
  const dd = String(agora.getDate()).padStart(2, '0');
  const hojeStr = `${yyyy}-${mm}-${dd}`;
  const currentMinutes = agora.getHours() * 60 + agora.getMinutes();

  for (const med of medicamentos) {
    if (!med || med.lembreteAtivo === false || !Array.isArray(med.horarios)) continue;
    if (med.tipoTratamento === 'dias' && med.dataFim && String(med.dataFim) < hojeStr) continue;

    for (const hRaw of med.horarios) {
      const h = String(hRaw || '').trim();
      if (!/^\d{1,2}:\d{2}$/.test(h)) continue;

      const [hh, min] = h.split(':').map(Number);
      if (isNaN(hh) || isNaN(min)) continue;

      const medMinutes = hh * 60 + min;

      // Dispara quando chega o horário cadastrado (janela de até 20 minutos após o horário, 1x por dia naquele horário)
      if (currentMinutes >= medMinutes && currentMinutes <= medMinutes + 20) {
        const keyNotif = `notif_remedio_${med.id}_${hojeStr}_${h}`;
        if (!hasBeenNotified(keyNotif)) {
          const doseInfo = med.dosagem ? ` (${med.dosagem})` : '';
          const instrInfo = med.instrucoes ? ` • ${med.instrucoes}` : '';
          const ok = await sendDeviceNotification(`💊 Hora do Remédio: ${med.nome}`, {
            body: `Lembrete das ${h}: Tomar ${med.nome}${doseInfo}${instrInfo}.`,
            tag: `remedio_${med.id}_${h}`,
            requireInteraction: true,
            data: {
              tipo: 'saude_remedio',
              targetModal: 'saude',
              targetSaudeTab: 'remedios',
              medId: med.id,
            },
          });
          if (ok) markAsNotified(keyNotif);
        }
      }
    }
  }
}

/**
 * 6) Agenda (Lembretes e Notas): Dispara notificação no celular para compromissos:
 * - 1 dia antes do compromisso (amanhã)
 * - No próprio dia do compromisso de manhã cedo (a partir das 07:00) e também no horário do compromisso
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
  const horaAtual = hoje.getHours();

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

    // 1. No próprio dia do compromisso de manhã cedo (diffDays === 0, a partir das 06:00 da manhã)
    if (diffDays === 0 && horaAtual >= 6) {
      const keyHojeManha = `notif_agenda_hoje_manha_${item.id}_${hojeStr}`;
      if (!hasBeenNotified(keyHojeManha)) {
        const prefs = getNotificationPreferences();
        if (!prefs.enabled && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          saveNotificationPreferences({ enabled: true });
        }

        const titulo = `🌅 HOJE CEDO (${nomePessoa}): ${item.titulo}`;
        const corpo = `Bom dia! Lembrete de compromisso de ${nomePessoa} para hoje (${dataFormatada})${horaInfo}.${
          item.descricao ? ` Obs: ${item.descricao}` : ''
        }`;

        const ok = await sendDeviceNotification(titulo, {
          body: corpo,
          tag: `agenda_hoje_manha_${item.id}`,
          requireInteraction: true,
          data: {
            tipo: 'agenda',
            targetModal: 'agenda',
            agendaId: item.id,
            pessoa: nomePessoa,
          },
        });
        if (ok) markAsNotified(keyHojeManha);
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
        const corpo = `Lembrete de 1 dia antes: Compromisso de ${nomePessoa} amanhã (${dataFormatada})${horaInfo}.${
          item.descricao ? ` Obs: ${item.descricao}` : ''
        }`;

        const ok = await sendDeviceNotification(titulo, {
          body: corpo,
          tag: `agenda_vespera_${item.id}`,
          requireInteraction: false,
          data: {
            tipo: 'agenda',
            targetModal: 'agenda',
            agendaId: item.id,
            pessoa: nomePessoa,
          },
        });
        if (ok) markAsNotified(keyVespera);
      }
    }
  }
}

/**
 * Dispara uma notificação nativa/celular avisando que há uma atualização disponível no app
 * e que basta tocar para atualizar pelas Configurações sem precisar apagar nem baixar APK
 */
export async function notifyAppUpdateAvailable(
  version: string,
  buildId: string,
  title?: string,
  notes?: string
): Promise<boolean> {
  const key = `notif_ota_update_${version}_${buildId}`;
  if (hasBeenNotified(key)) return false;

  const titulo = title || `🚀 Atualização Disponível (v${version})!`;
  const corpo =
    notes ||
    `Uma nova atualização do Sutello Financeiro está pronta! Toque aqui ou abra as Configurações (⚙️) para atualizar em 1 segundo sem precisar baixar APK.`;

  const ok = await sendDeviceNotification(titulo, {
    body: corpo,
    tag: `app_update_${version}`,
    requireInteraction: true,
    data: {
      tipo: 'app_update',
      targetModal: 'settings',
      version,
      buildId,
    },
  });

  if (ok) {
    markAsNotified(key);
  }
  return ok;
}

/**
 * Agenda notificações nativas reais no Android (via AlarmManager do Capacitor)
 * para contas, compromissos da Agenda (1 dia antes e no dia de manhã cedo às 07:30),
 * remédios nos horários cadastrados e lembrete mensal de pesagem.
 */
export async function scheduleNativeApkAlerts(
  contas: Conta[],
  agendaItens: ItemAgenda[],
  transmissoes: MensagemTransmissao[] = [],
  dadosSaude?: DadosSaude
): Promise<boolean> {
  if (!isNativeApkPlatform()) return false;

  try {
    const prefs = getNotificationPreferences();
    if (!prefs.enabled) {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({ notifications: pending.notifications });
      }
      return true;
    }

    await ensureNativeAndroidChannels();

    // Limpa agendamentos futuros antigos antes de recriar a fila atualizada
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }

    const hoje = new Date();
    const yyyy = hoje.getFullYear();
    const mm = String(hoje.getMonth() + 1).padStart(2, '0');
    const dd = String(hoje.getDate()).padStart(2, '0');
    const hojeStr = `${yyyy}-${mm}-${dd}`;
    const hojeDate = new Date(hojeStr + 'T00:00:00');

    const notificationsToSchedule: any[] = [];

    // 1. Agendar alertas futuros para Contas pendentes (às 08:30 da manhã do dia de vencimento e 2 dias antes)
    for (const conta of (contas || [])) {
      if (conta.paga || conta.oculta || !conta.vencimento) continue;
      let vencStr = String(conta.vencimento).trim();
      if (vencStr.includes('/')) {
        const p = vencStr.split('/');
        if (p.length === 3) vencStr = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
      } else if (vencStr.includes('T')) {
        vencStr = vencStr.split('T')[0];
      }

      // Alerta no dia do vencimento às 08:30
      const dataNoDia = new Date(`${vencStr}T08:30:00`);
      if (!isNaN(dataNoDia.getTime()) && dataNoDia.getTime() > Date.now() && prefs.contasVenceHoje) {
        notificationsToSchedule.push({
          id: hashNotificationId(`apk_sched_hoje_${conta.id}_${vencStr}`),
          title: `📅 Vence Hoje: ${conta.nome}`,
          body: `Valor: R$ ${formatCurrency(conta.valor)} • Lembre-se de pagar hoje (${isoParaBR(vencStr)})!`,
          channelId: NATIVE_CHANNEL_FINANCEIRO,
          smallIcon: 'ic_stat_sutello',
          iconColor: '#9333EA',
          schedule: { at: dataNoDia, allowWhileIdle: true },
          extra: { tipo: 'hoje', contaId: conta.id },
        });
      }

      // Alerta 2 dias antes às 09:00
      const dataAntecipada = new Date(`${vencStr}T09:00:00`);
      dataAntecipada.setDate(dataAntecipada.getDate() - 2);
      if (!isNaN(dataAntecipada.getTime()) && dataAntecipada.getTime() > Date.now() && prefs.contasVenceHoje) {
        notificationsToSchedule.push({
          id: hashNotificationId(`apk_sched_breve_${conta.id}_${vencStr}`),
          title: `🔔 Vence em 2 dias: ${conta.nome}`,
          body: `Valor: R$ ${formatCurrency(conta.valor)} • Vencimento: ${isoParaBR(vencStr)}.`,
          channelId: NATIVE_CHANNEL_FINANCEIRO,
          smallIcon: 'ic_stat_sutello',
          iconColor: '#9333EA',
          schedule: { at: dataAntecipada, allowWhileIdle: true },
          extra: { tipo: 'breve', contaId: conta.id },
        });
      }
    }

    // 2. Agendar alertas futuros para Compromissos da Agenda (1 dia antes às 09:00, no dia de manhã cedo às 07:30 e no horário exato)
    for (const item of (agendaItens || [])) {
      if (item.concluido || !item.data) continue;
      let dataStr = String(item.data).trim();
      if (dataStr.includes('/')) {
        const p = dataStr.split('/');
        if (p.length === 3) dataStr = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
      } else if (dataStr.includes('T')) {
        dataStr = dataStr.split('T')[0];
      }

      const nomePessoa = item.pessoa || 'Leonardo';
      const horaInfo = item.hora ? ` às ${item.hora}` : '';

      // 2.1 No dia do compromisso DE MANHÃ CEDO (07:30)
      const dataManhaCedo = new Date(`${dataStr}T07:30:00`);
      if (!isNaN(dataManhaCedo.getTime()) && dataManhaCedo.getTime() > Date.now()) {
        notificationsToSchedule.push({
          id: hashNotificationId(`apk_agenda_manha_${item.id}_${dataStr}`),
          title: `🌅 HOJE CEDO (${nomePessoa}): ${item.titulo}`,
          body: `Bom dia! Lembrete de compromisso de ${nomePessoa} hoje (${isoParaBR(dataStr)})${horaInfo}.${item.descricao ? ` Obs: ${item.descricao}` : ''}`,
          channelId: NATIVE_CHANNEL_AGENDA,
          smallIcon: 'ic_stat_sutello',
          iconColor: '#9333EA',
          schedule: { at: dataManhaCedo, allowWhileIdle: true },
          extra: { tipo: 'agenda', targetModal: 'agenda', agendaId: item.id, pessoa: nomePessoa },
        });
      }

      // 2.2 Se tiver horário específico (diferente de 07:30), agenda também para o horário exato do compromisso
      if (item.hora && /^\d{2}:\d{2}$/.test(item.hora.trim()) && item.hora.trim() !== '07:30') {
        const dataHoraExata = new Date(`${dataStr}T${item.hora.trim()}:00`);
        if (!isNaN(dataHoraExata.getTime()) && dataHoraExata.getTime() > Date.now()) {
          notificationsToSchedule.push({
            id: hashNotificationId(`apk_agenda_hora_${item.id}_${dataStr}_${item.hora.trim()}`),
            title: `📅 AGORA (${nomePessoa}): ${item.titulo}`,
            body: `Compromisso de ${nomePessoa} agendado para as ${item.hora.trim()} (${isoParaBR(dataStr)}).`,
            channelId: NATIVE_CHANNEL_AGENDA,
            smallIcon: 'ic_stat_sutello',
            iconColor: '#9333EA',
            schedule: { at: dataHoraExata, allowWhileIdle: true },
            extra: { tipo: 'agenda', targetModal: 'agenda', agendaId: item.id, pessoa: nomePessoa },
          });
        }
      }

      // 2.3 Um dia antes (véspera) às 09:00 da manhã
      const dataVespera = new Date(`${dataStr}T09:00:00`);
      dataVespera.setDate(dataVespera.getDate() - 1);
      if (!isNaN(dataVespera.getTime()) && dataVespera.getTime() > Date.now() && dataVespera.getTime() >= hojeDate.getTime()) {
        notificationsToSchedule.push({
          id: hashNotificationId(`apk_agenda_vesp_${item.id}_${dataStr}`),
          title: `🔔 AMANHÃ (${nomePessoa}): ${item.titulo}`,
          body: `Lembrete de 1 dia antes: Compromisso de ${nomePessoa} amanhã (${isoParaBR(dataStr)})${horaInfo}.`,
          channelId: NATIVE_CHANNEL_AGENDA,
          smallIcon: 'ic_stat_sutello',
          iconColor: '#9333EA',
          schedule: { at: dataVespera, allowWhileIdle: true },
          extra: { tipo: 'agenda', targetModal: 'agenda', agendaId: item.id, pessoa: nomePessoa },
        });
      }
    }

    // 3. Agendar alertas de Remédios (Saúde) nos horários cadastrados para hoje e próximos 7 dias
    if (dadosSaude?.medicamentos && dadosSaude.medicamentos.length > 0) {
      for (const med of dadosSaude.medicamentos) {
        if (!med || med.lembreteAtivo === false || !Array.isArray(med.horarios)) continue;
        for (const hRaw of med.horarios) {
          const h = String(hRaw || '').trim();
          if (!/^\d{1,2}:\d{2}$/.test(h)) continue;
          const [hh, min] = h.split(':').map(Number);
          if (isNaN(hh) || isNaN(min)) continue;

          // Agenda para os próximos 7 dias naquele horário exato (respeitando se é só por alguns dias)
          for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
            const dtMed = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + dayOffset, hh, min, 0);
            if (dtMed.getTime() > Date.now() + 2000) {
              const dtIso = dtMed.toISOString().split('T')[0];
              if (med.tipoTratamento === 'dias' && med.dataFim && dtIso > med.dataFim) continue;

              const doseInfo = med.dosagem ? ` (${med.dosagem})` : '';
              notificationsToSchedule.push({
                id: hashNotificationId(`apk_med_${med.id}_${dtIso}_${h}`),
                title: `💊 Hora do Remédio: ${med.nome}`,
                body: `Lembrete das ${h}: Tomar ${med.nome}${doseInfo}.`,
                channelId: NATIVE_CHANNEL_AGENDA,
                smallIcon: 'ic_stat_sutello',
                iconColor: '#E11D48',
                schedule: { at: dtMed, allowWhileIdle: true },
                extra: { tipo: 'saude_remedio', targetModal: 'saude', targetSaudeTab: 'remedios', medId: med.id },
              });
            }
          }
        }
      }
    }

    // 4. Agendar lembrete de 1 mês (30 dias) após a última pesagem de Vitórya e Leonardo
    if (dadosSaude?.historicoPesoAltura && dadosSaude.historicoPesoAltura.length > 0) {
      for (const pessoa of ['Vitórya', 'Leonardo'] as const) {
        const normTarget = pessoa === 'Vitórya' ? 'vit' : 'leo';
        const listPessoa = dadosSaude.historicoPesoAltura
          .filter((r) => (r.pessoa || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(normTarget))
          .sort((a, b) => (b.data + (b.hora || '')).localeCompare(a.data + (a.hora || '')));

        if (listPessoa.length > 0 && listPessoa[0].data) {
          const dtUlt = new Date(listPessoa[0].data + 'T09:00:00');
          if (!isNaN(dtUlt.getTime())) {
            const dtUmMes = new Date(dtUlt.getTime() + 30 * 24 * 60 * 60 * 1000);
            if (dtUmMes.getTime() > Date.now()) {
              notificationsToSchedule.push({
                id: hashNotificationId(`apk_peso_mensal_${pessoa}_${listPessoa[0].id}`),
                title: `⚖️ ${pessoa}, sua última pesagem faz 1 mês!`,
                body: `${pessoa}, faz 1 mês desde sua última pesagem (${listPessoa[0].peso.toFixed(1)} kg). Atualize seu peso na aba Saúde!`,
                channelId: NATIVE_CHANNEL_AGENDA,
                smallIcon: 'ic_stat_sutello',
                iconColor: '#E11D48',
                schedule: { at: dtUmMes, allowWhileIdle: true },
                extra: { tipo: 'saude_peso', targetModal: 'saude', targetSaudeTab: 'pesoxaltura', pessoa },
              });
            }
          }
        }
      }
    }

    // 5. Agendar ou disparar transmissões ADM (incluindo agendadas para o futuro com o app fechado!)
    for (const msg of (transmissoes || []).slice(0, 15)) {
      if (!msg || !msg.id || !msg.titulo) continue;
      const targetTime = typeof msg.timestampAgendado === 'number' ? msg.timestampAgendado : msg.timestamp;
      if (targetTime > Date.now() + 2000) {
        const prefix = msg.urgencia === 'alta' ? '🚨 ' : msg.urgencia === 'media' ? '📢 ' : '💬 ';
        notificationsToSchedule.push({
          id: hashNotificationId(`apk_bcast_${msg.id}`),
          title: `${prefix}${msg.titulo}`,
          body: msg.mensagem,
          channelId: NATIVE_CHANNEL_FINANCEIRO,
          smallIcon: 'ic_stat_sutello',
          iconColor: '#9333EA',
          schedule: { at: new Date(targetTime), allowWhileIdle: true },
          extra: {
            tipo: 'transmissao_adm',
            broadcastId: msg.id,
            linkUrl: msg.linkUrl,
            botaoTexto: msg.botaoTexto,
            imagemUrl: msg.imagemUrl,
            targetModal: msg.targetModal,
            targetSaudeTab: msg.targetSaudeTab,
          },
        });
      } else if (Date.now() - targetTime < 1000 * 60 * 60 * 24) {
        await notifyBroadcastAdmin(msg.titulo, msg.mensagem, msg.urgencia, msg.id, {
          linkUrl: msg.linkUrl,
          botaoTexto: msg.botaoTexto,
          imagemUrl: msg.imagemUrl,
          targetModal: msg.targetModal,
          targetSaudeTab: msg.targetSaudeTab,
        });
      }
    }

    if (notificationsToSchedule.length > 0) {
      await LocalNotifications.schedule({
        notifications: notificationsToSchedule.slice(0, 60),
      });
    }

    return true;
  } catch (err) {
    console.warn('Erro ao agendar notificações nativas no APK:', err);
    return false;
  }
}

/**
 * Sincroniza Contas, Agenda, Saúde, Caixinhas e Transmissões com o Service Worker (IndexedDB em 2º plano)
 * e também agenda alarmes nativos reais no Android quando rodando como APK Capacitor.
 */
export async function syncBackgroundAlertsWithSW(
  contas: Conta[],
  agendaItens: ItemAgenda[],
  transmissoes: MensagemTransmissao[] = [],
  uid?: string | null,
  dadosSaude?: DadosSaude,
  caixinhas?: Caixinha[]
): Promise<boolean> {
  const currentUser = auth?.currentUser;
  const effectiveUid = uid || currentUser?.uid || (typeof localStorage !== 'undefined' ? localStorage.getItem('sutello_last_uid') : null);
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'sutello-financeiro';
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDDguzJOP5GKqlqf8GW-xdsTCxh1Ha7C7k';

  let idToken = '';
  let refreshToken = '';
  try {
    if (currentUser) {
      idToken = await currentUser.getIdToken();
      refreshToken = currentUser.refreshToken || (currentUser as any)?.stsTokenManager?.refreshToken || '';
    }
  } catch {}

  const allContaIds = (contas || []).filter((c) => c && c.id).map((c) => String(c.id));
  const paidContaIds = (contas || []).filter((c) => c && c.id && c.paga).map((c) => String(c.id));

  const deviceId = typeof localStorage !== 'undefined' ? (localStorage.getItem('sutello_device_id') || '') : '';

  // Prepara snapshots leves de Saúde, Caixinhas e Agenda para o serviço nativo Android (CloudSyncReceiver) disparar lembretes de remédios, pesagem, caixinhas e agenda mesmo com o app fechado ou offline!
  const saudeBgSnapshot = dadosSaude
    ? {
        registrosPesoAltura: (dadosSaude.historicoPesoAltura || []).map((r) => ({
          id: r.id,
          pessoa: r.pessoa || 'Vitórya',
          peso: Number(r.peso) || 0,
          altura: Number(r.altura) || 0,
          data: r.data || '',
        })),
        metasPeso: dadosSaude.metasPorPessoa || dadosSaude.perfilSaude?.metasPorPessoa || {},
        medicamentos: (dadosSaude.medicamentos || []).map((m) => ({
          id: m.id,
          nome: m.nome,
          dosagem: m.dosagem || '',
          instrucoes: m.instrucoes || '',
          pessoa: 'Saúde',
          horario: Array.isArray(m.horarios) ? m.horarios.join(', ') : '',
          horarios: Array.isArray(m.horarios) ? m.horarios : [],
          ativo: m.lembreteAtivo !== false,
          lembreteAtivo: m.lembreteAtivo !== false,
          tipoTratamento: m.tipoTratamento || 'fixo',
          diasDuracao: m.diasDuracao || undefined,
          dataInicio: m.dataInicio || undefined,
          dataFim: m.dataFim || undefined,
        })),
      }
    : null;

  const caixinhasBgSnapshot = (caixinhas || []).map((c) => ({
    id: c.id,
    nome: c.nome,
    meta: Number(c.meta) || 0,
    saldoAtual: Number(c.saldo) || 0,
  }));

  const agendaBgSnapshot = {
    itens: (agendaItens || []).filter((i) => !i.concluido),
  };

  // Registra o UID, Token, DeviceId e os snapshots de Saúde/Caixinhas/Agenda no serviço nativo Android em segundo plano (SutelloRealtimeSyncService + CloudSyncReceiver)
  if (typeof window !== 'undefined' && (window as any).SutelloNativeAndroid && effectiveUid) {
    try {
      const bridge = (window as any).SutelloNativeAndroid;
      if (typeof bridge.registerLoggedUserWithToken === 'function') {
        try {
          bridge.registerLoggedUserWithToken(
            effectiveUid,
            projectId,
            apiKey,
            idToken,
            refreshToken,
            deviceId
          );
        } catch {
          bridge.registerLoggedUserWithToken(
            effectiveUid,
            projectId,
            apiKey,
            idToken,
            refreshToken
          );
        }
      } else if (typeof bridge.registerLoggedUser === 'function') {
        bridge.registerLoggedUser(effectiveUid, projectId, apiKey);
      }

      if (allContaIds.length > 0 && typeof bridge.syncKnownAccountsSnapshot === 'function') {
        bridge.syncKnownAccountsSnapshot(
          JSON.stringify(allContaIds),
          JSON.stringify(paidContaIds)
        );
      }

      if (typeof bridge.syncModulesForNativeBackground === 'function') {
        bridge.syncModulesForNativeBackground(
          saudeBgSnapshot ? JSON.stringify(saudeBgSnapshot) : '',
          JSON.stringify(caixinhasBgSnapshot),
          JSON.stringify(agendaBgSnapshot)
        );
      }
    } catch {}
  }

  // Se estiver rodando como APK Android nativo, agenda também via AlarmManager do Capacitor
  if (isNativeApkPlatform()) {
    await scheduleNativeApkAlerts(contas, agendaItens, transmissoes, dadosSaude);
  }

  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return isNativeApkPlatform();
  }

  try {
    const prefs = getNotificationPreferences();
    const enabled = prefs.enabled !== false;

    const reg = await navigator.serviceWorker.ready;

    // 1. Tenta registrar Periodic Background Sync (Android Chrome / PWA instalado)
    if ('periodicSync' in reg) {
      try {
        const status = await (navigator as any).permissions?.query({
          name: 'periodic-background-sync',
        });
        if (!status || status.state === 'granted') {
          await (reg as any).periodicSync.register('sutello-daily-alerts', {
            minInterval: 1000 * 60 * 15, // Verifica a cada 15 min em 2º plano
          });
        }
      } catch {
        // Ignora se navegador não permitir periodicSync sem PWA instalado
      }
    }

    // 2. Tenta registrar Background Sync de reconexão
    if ('sync' in reg) {
      try {
        await (reg as any).sync.register('sutello-sync-alerts');
      } catch {
        // Ignora
      }
    }

    // 3. Envia os dados atualizados de Contas, Agenda, Saúde, Caixinhas, Transmissões Personalizadas, UID e Tokens para o Service Worker
    const swTarget = reg.active || navigator.serviceWorker.controller;
    if (swTarget) {
      swTarget.postMessage({
        type: 'SYNC_BG_ALERTS',
        payload: {
          enabled,
          uid: effectiveUid,
          projectId,
          apiKey,
          idToken,
          refreshToken,
          installedBuildId:
            typeof localStorage !== 'undefined'
              ? localStorage.getItem('sutello_installed_build_id') || '20261010-ota-v380'
              : '20261010-ota-v380',
          updatedAt: Date.now(),
          allContaIds,
          paidContaIds,
          contas: (contas || []).filter((c) => !c.paga && !c.oculta),
          agendaItens: (agendaItens || []).filter((i) => !i.concluido),
          transmissoes: (transmissoes || []).slice(0, 30),
          dadosSaude: dadosSaude || null,
          caixinhas: caixinhas || [],
        },
      });
      return true;
    }
  } catch (err) {
    console.warn('Falha ao sincronizar alertas de 2º plano com Service Worker:', err);
  }
  return false;
}


