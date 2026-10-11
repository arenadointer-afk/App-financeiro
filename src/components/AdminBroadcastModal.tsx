import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  Send,
  X,
  Bell,
  Lock,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Trash2,
  Zap,
  Laptop,
  CheckCheck,
  Radio,
  Eye,
  EyeOff,
  Link2,
  Image as ImageIcon,
  MousePointerClick,
  HelpCircle,
  RotateCcw,
  Download,
  Upload,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';
import { MensagemTransmissao } from '../types';
import {
  sendBroadcastNotificationToCloud,
  getAdminPassword,
  setAdminPassword,
  resetAdminPassword,
  deleteBroadcastMessageFromCloud,
} from '../lib/firebase';
import { notifyBroadcastAdmin, notifyAppUpdateAvailable } from '../lib/deviceNotifications';
import {
  AppVersionInfo,
  publishAppUpdateToCloud,
  getInstalledAppVersion,
  checkAppUpdateNow,
  applyOverTheAirUpdate,
  getSavedVercelLiveUrl,
  saveVercelLiveUrl,
} from '../lib/appUpdater';
import { ApkBuilderHelper } from './ApkBuilderHelper';

interface AdminBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  uid: string;
  transmissoes: MensagemTransmissao[];
  userEmail?: string | null;
  onExportBackup?: () => void;
  onImportBackup?: (file: File) => void;
  hasAppUpdate?: boolean;
  remoteAppVersion?: AppVersionInfo | null;
  onCheckAppUpdate?: () => Promise<boolean>;
}

export const AdminBroadcastModal: React.FC<AdminBroadcastModalProps> = ({
  isOpen,
  onClose,
  uid,
  transmissoes = [],
  userEmail,
  onExportBackup,
  onImportBackup,
  hasAppUpdate = false,
  remoteAppVersion = null,
  onCheckAppUpdate,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Recuperação de senha caso esqueça
  const [isRecoveringPassword, setIsRecoveringPassword] = useState(false);
  const [recoveryPinInput, setRecoveryPinInput] = useState('');
  const [recoveryNewPass, setRecoveryNewPass] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  // Formulário de envio (com suporte a Link, Botão, Imagem e Aba do App)
  const [titulo, setTitulo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [urgencia, setUrgencia] = useState<'alta' | 'media' | 'baixa'>('alta');
  const [horarioEnvio, setHorarioEnvio] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [botaoTexto, setBotaoTexto] = useState('');
  const [imagemUrl, setImagemUrl] = useState('');
  const [targetModal, setTargetModal] = useState<'' | 'saude' | 'caixinhas' | 'agenda' | 'acordos' | 'notificacoes' | 'settings'>('');
  const [showRichExtras, setShowRichExtras] = useState(false);

  const [vercelUrlInput, setVercelUrlInput] = useState('');
  const [sending, setSending] = useState(false);
  const [publishingOta, setPublishingOta] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Backup / Download ZIP / Restaurar Dados no Painel ADM
  const [backupOption, setBackupOption] = useState<'dados_json' | 'restaurar_json' | 'apk_android' | 'site_pronto' | 'codigo_fonte'>('dados_json');
  const backupInputRef = useRef<HTMLInputElement>(null);

  // Estados de atualização OTA do aplicativo no Painel ADM
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [applyingUpdate, setApplyingUpdate] = useState(false);
  const [localUpdateDetected, setLocalUpdateDetected] = useState(false);
  const [detectedRemoteInfo, setDetectedRemoteInfo] = useState<AppVersionInfo | null>(remoteAppVersion);
  const [vercelServerUrl, setVercelServerUrl] = useState<string>(() => getSavedVercelLiveUrl());
  const [showVercelInput, setShowVercelInput] = useState<boolean>(false);
  const installedVer = getInstalledAppVersion();

  // Alteração de senha
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passSaveLoading, setPassSaveLoading] = useState(false);

  // Limpa estados ao fechar e sincroniza estado de atualização ao abrir
  useEffect(() => {
    if (!isOpen) {
      setIsAuthenticated(false);
      setPasswordInput('');
      setAuthError(null);
      setStatusMessage(null);
      setIsChangingPass(false);
      setIsRecoveringPassword(false);
      setRecoveryPinInput('');
      setRecoveryNewPass('');
      setNewPass('');
      setConfirmPass('');
    } else {
      setDetectedRemoteInfo(remoteAppVersion);
      setLocalUpdateDetected(hasAppUpdate);
      setVercelServerUrl(remoteAppVersion?.liveUrl || getSavedVercelLiveUrl());
    }
  }, [isOpen, hasAppUpdate, remoteAppVersion]);

  if (!isOpen) return null;

  // Verificação rigorosa da senha de ADM (NÃO aceita mais a senha antiga depois que você altera!)
  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const targetPass = await getAdminPassword(uid);
    if (passwordInput.trim() === targetPass) {
      setIsAuthenticated(true);
      setPasswordInput('');
    } else {
      setAuthError('Senha de administrador incorreta. Se esqueceu, clique em "Esqueci a senha" abaixo.');
      setPasswordInput('');
    }
  };

  // Recuperar / Redefinir senha de ADM caso esqueça (usando o PIN do App ou validação da conta logada)
  const handleRecoverPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setStatusMessage(null);

    const savedAppPin = (localStorage.getItem('pinAcesso') || '2007').trim();
    const isOwnerEmail =
      userEmail &&
      (userEmail.toLowerCase().includes('leonardo') ||
        userEmail.toLowerCase().includes('sutello') ||
        userEmail.toLowerCase().includes('vitorya'));

    if (recoveryPinInput.trim() !== savedAppPin && !(isOwnerEmail && recoveryPinInput.trim().length >= 4)) {
      setAuthError('PIN de acesso do aplicativo incorreto. Digite o mesmo PIN de 4 dígitos que você usa para desbloquear o app.');
      return;
    }

    const nova = recoveryNewPass.trim() || 'adm85';
    if (nova.length < 4) {
      setAuthError('A nova senha deve ter pelo menos 4 caracteres.');
      return;
    }

    setRecoveryLoading(true);
    try {
      await resetAdminPassword(uid, nova);
      setIsRecoveringPassword(false);
      setIsAuthenticated(true);
      setRecoveryPinInput('');
      setRecoveryNewPass('');
      setStatusMessage({
        type: 'success',
        text: `Senha de ADM recuperada e definida para "${nova}" com sucesso!`,
      });
    } catch {
      setAuthError('Não foi possível redefinir a senha agora.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  // Envia aviso de Atualização OTA do Aplicativo para todos os aparelhos (sem precisar baixar APK)
  const handlePublishOtaUpdate = async () => {
    setPublishingOta(true);
    setStatusMessage(null);
    try {
      const updated = await publishAppUpdateToCloud({
        liveUrl: vercelUrlInput.trim() || undefined,
        notes:
          mensagem.trim() ||
          'Nova atualização do Sutello Financeiro disponível! Abra as Configurações (⚙️) e toque em "Atualizar" sem precisar baixar APK.',
      });
      if (updated) {
        await sendBroadcastNotificationToCloud(uid, {
          titulo: `🚀 Atualização v${updated.version} Disponível!`,
          mensagem: updated.notes,
          urgencia: 'alta',
          enviadoPor: 'Sistema OTA',
          timestampAgendado: Date.now(),
          botaoTexto: 'Atualizar Agora',
          targetModal: 'settings',
        });
        await notifyAppUpdateAvailable(updated.version, updated.buildId, updated.title, updated.notes);
        setStatusMessage({
          type: 'success',
          text: `🚀 Atualização v${updated.version} liberada! Todos os celulares receberam a notificação com botão e o aviso nas Configurações.`,
        });
      } else {
        setStatusMessage({ type: 'error', text: 'Falha ao publicar atualização OTA.' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Erro ao liberar atualização OTA.' });
    } finally {
      setPublishingOta(false);
    }
  };

  // Envio da notificação rica para todos os celulares
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !mensagem.trim()) {
      setStatusMessage({ type: 'error', text: 'Preencha o título e a mensagem para enviar.' });
      return;
    }

    setSending(true);
    setStatusMessage(null);

    try {
      const enviadoPor = userEmail ? userEmail.split('@')[0] : 'ADM';
      let timestampAgendado = Date.now();
      const horaLimpa = horarioEnvio.trim();

      if (horaLimpa && horaLimpa.includes(':')) {
        const [hh, mm] = horaLimpa.split(':').map(Number);
        if (!isNaN(hh) && !isNaN(mm)) {
          const dt = new Date();
          dt.setHours(hh, mm, 0, 0);
          if (dt.getTime() < Date.now() - 120000) {
            dt.setDate(dt.getDate() + 1);
          }
          timestampAgendado = dt.getTime();
        }
      }

      const cleanLink = linkUrl.trim() || undefined;
      const cleanBotao = botaoTexto.trim() || undefined;
      const cleanImagem = imagemUrl.trim() || undefined;
      const cleanTargetModal = targetModal || undefined;
      const cleanTargetSaudeTab = cleanTargetModal === 'saude' ? 'remedios' : undefined;

      const result = await sendBroadcastNotificationToCloud(uid, {
        titulo: titulo.trim(),
        mensagem: mensagem.trim(),
        urgencia,
        enviadoPor,
        horarioEnvio: horaLimpa || undefined,
        timestampAgendado,
        linkUrl: cleanLink,
        botaoTexto: cleanBotao,
        imagemUrl: cleanImagem,
        targetModal: cleanTargetModal,
        targetSaudeTab: cleanTargetSaudeTab,
      });

      if (result) {
        const delayMs = timestampAgendado - Date.now();
        const extraRich = {
          linkUrl: cleanLink,
          botaoTexto: cleanBotao,
          imagemUrl: cleanImagem,
          targetModal: cleanTargetModal,
          targetSaudeTab: cleanTargetSaudeTab as any,
        };

        if (delayMs <= 2000) {
          notifyBroadcastAdmin(titulo.trim(), mensagem.trim(), urgencia, result.id, extraRich);
          setStatusMessage({
            type: 'success',
            text: '🚀 Notificação nativa enviada agora para todos os celulares logados!',
          });
        } else {
          setTimeout(() => {
            notifyBroadcastAdmin(result.titulo, result.mensagem, result.urgencia, result.id, extraRich);
          }, delayMs);
          setStatusMessage({
            type: 'success',
            text: `⏰ Notificação agendada para ${horaLimpa}! Ela tocará nesse horário mesmo com o app fechado.`,
          });
        }
        setTitulo('');
        setMensagem('');
        setLinkUrl('');
        setBotaoTexto('');
        setImagemUrl('');
      } else {
        setStatusMessage({ type: 'error', text: 'Não foi possível enviar a transmissão. Verifique a conexão.' });
      }
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: 'error', text: err.message || 'Erro ao enviar notificação.' });
    } finally {
      setSending(false);
    }
  };

  // Alterar senha de ADM
  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass.trim().length < 4) {
      setStatusMessage({ type: 'error', text: 'A nova senha deve ter no mínimo 4 caracteres.' });
      return;
    }
    if (newPass.trim() !== confirmPass.trim()) {
      setStatusMessage({ type: 'error', text: 'As senhas não coincidem.' });
      return;
    }

    setPassSaveLoading(true);
    setStatusMessage(null);
    try {
      await setAdminPassword(uid, newPass.trim());
      setStatusMessage({
        type: 'success',
        text: '🔒 Senha de administrador atualizada! A senha antiga foi desativada.',
      });
      setIsChangingPass(false);
      setNewPass('');
      setConfirmPass('');
    } catch {
      setStatusMessage({ type: 'error', text: 'Erro ao alterar a senha de administrador.' });
    } finally {
      setPassSaveLoading(false);
    }
  };

  // Excluir mensagem do histórico
  const handleDeleteBroadcast = async (id: string) => {
    if (!confirm('Deseja remover esta mensagem do banco de dados de transmissões?')) return;
    await deleteBroadcastMessageFromCloud(uid, id);
  };

  // Presets rápidos de notificação
  const applyPreset = (
    presetTitulo: string,
    presetMsg: string,
    presetUrgencia: 'alta' | 'media' | 'baixa',
    presetTarget?: '' | 'saude' | 'caixinhas' | 'agenda' | 'acordos'
  ) => {
    setTitulo(presetTitulo);
    setMensagem(presetMsg);
    setUrgencia(presetUrgencia);
    if (presetTarget !== undefined) setTargetModal(presetTarget);
  };

  const isUpdateReady = hasAppUpdate || localUpdateDetected;

  const downloadZipSafe = async (fileNames: string[], downloadAs: string) => {
    setStatusMessage({ type: 'success', text: `Baixando ${downloadAs} atualizado...` });
    const ts = Date.now();
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const basePath =
      typeof window !== 'undefined'
        ? window.location.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '')
        : '';

    const urlsToTry: string[] = [];
    for (const fileName of fileNames) {
      if (origin) {
        urlsToTry.push(`${origin}${basePath}/${fileName}?v=${ts}`);
        urlsToTry.push(`${origin}/${fileName}?v=${ts}`);
      }
      urlsToTry.push(`./${fileName}?v=${ts}`);
      urlsToTry.push(`/${fileName}?v=${ts}`);
      urlsToTry.push(`https://ais-dev-yt2j7mvi2df6kqcwuathrr-265581544198.us-east5.run.app/${fileName}?v=${ts}`);
      urlsToTry.push(`https://ais-pre-yt2j7mvi2df6kqcwuathrr-265581544198.us-east5.run.app/${fileName}?v=${ts}`);
    }

    for (const url of urlsToTry) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) continue;
        const contentType = (res.headers.get('content-type') || '').toLowerCase();
        if (contentType.includes('text/html')) continue;

        const arrayBuffer = await res.arrayBuffer();
        if (arrayBuffer.byteLength < 500) continue;

        // Verifica assinatura PK (0x50 0x4B) de arquivo ZIP real para nunca baixar erro 404 disfarçado
        const header = new Uint8Array(arrayBuffer.slice(0, 2));
        if (header[0] !== 0x50 || header[1] !== 0x4b) continue;

        const blob = new Blob([arrayBuffer], { type: 'application/zip' });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = downloadAs;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
        setStatusMessage({ type: 'success', text: `Download de ${downloadAs} concluído com sucesso!` });
        return;
      } catch {
        // tenta a próxima URL
      }
    }

    setStatusMessage({
      type: 'error',
      text: 'Não foi possível baixar o arquivo ZIP neste navegador. Abra pelo link oficial do App no navegador Chrome.',
    });
  };

  const handleExecutarBackupOpcao = () => {
    if (backupOption === 'dados_json') {
      if (onExportBackup) {
        onExportBackup();
        setStatusMessage({ type: 'success', text: 'Backup de dados (.JSON) exportado com sucesso!' });
      }
    } else if (backupOption === 'restaurar_json') {
      backupInputRef.current?.click();
    } else if (backupOption === 'apk_android') {
      downloadZipSafe(
        ['sutello-android-apk-nativo.zip', 'sutello-android-apk-projeto.zip', 'projeto-android-apk.zip'],
        'sutello-android-apk-nativo.zip'
      );
    } else if (backupOption === 'site_pronto') {
      downloadZipSafe(['site-pronto-dist.zip'], 'site-pronto-dist.zip');
    } else if (backupOption === 'codigo_fonte') {
      downloadZipSafe(
        ['projeto-sutello-financeiro.zip', 'projeto-completo.zip', 'sutello-codigo-fonte-github.zip'],
        'projeto-sutello-financeiro.zip'
      );
    }
  };

  const handleCheckUpdateClick = async () => {
    setCheckingUpdate(true);
    setStatusMessage(null);
    try {
      if (vercelServerUrl.trim()) {
        await saveVercelLiveUrl(vercelServerUrl.trim());
      }
      const res = await checkAppUpdateNow(vercelServerUrl.trim() || undefined);
      setDetectedRemoteInfo(res.remoteInfo);
      if (res.remoteInfo.liveUrl) {
        setVercelServerUrl(res.remoteInfo.liveUrl);
      }
      const found = onCheckAppUpdate ? await onCheckAppUpdate() : false;
      if (found || res.hasUpdate) {
        setLocalUpdateDetected(true);
        setStatusMessage({
          type: 'success',
          text: `Nova atualização v${res.remoteInfo.version} encontrada! Toque em "Atualizar" abaixo para carregar as mudanças.`,
        });
      } else if (!res.remoteInfo.liveUrl && window.location.hostname === 'localhost') {
        setShowVercelInput(true);
        setStatusMessage({
          type: 'error',
          text: 'Para o APK puxar as mudanças novas da Vercel sem gerar outro APK, informe o link do seu site da Vercel abaixo (apenas 1 vez).',
        });
      } else {
        setStatusMessage({
          type: 'success',
          text: `Versão v${res.remoteInfo.version} verificada. Toque em "Atualizar" para recarregar os arquivos mais recentes da Vercel.`,
        });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Não foi possível verificar atualizações agora.' });
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleApplyOtaUpdateClick = async () => {
    setApplyingUpdate(true);
    if (vercelServerUrl.trim()) {
      await saveVercelLiveUrl(vercelServerUrl.trim());
    }
    const targetUrl =
      vercelServerUrl.trim() ||
      detectedRemoteInfo?.liveUrl ||
      remoteAppVersion?.liveUrl ||
      getSavedVercelLiveUrl();
    if (!targetUrl && window.location.hostname === 'localhost') {
      setApplyingUpdate(false);
      setShowVercelInput(true);
      setStatusMessage({
        type: 'error',
        text: 'Informe o link do seu site na Vercel abaixo (ex: https://seu-app.vercel.app) para o APK carregar os arquivos novos!',
      });
      return;
    }
    setStatusMessage({
      type: 'success',
      text: 'Sincronizando arquivos novos da Vercel (seus dados estão 100% protegidos)...',
    });
    setTimeout(async () => {
      await applyOverTheAirUpdate(detectedRemoteInfo || remoteAppVersion, targetUrl);
    }, 500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#0e0e1a] border border-purple-500/30 rounded-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Topo do Modal */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-purple-950/20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-md">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white font-display">Painel Administrativo</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  ADM
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Notificações nativas com links, botões e imagens no Android
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

        {/* Mensagens de Feedback */}
        {statusMessage && (
          <div
            className={`p-3 text-xs flex items-center gap-2 border-b ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/15 border-red-500/30 text-red-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Tela 1: Bloqueio por Senha de ADM ou Recuperação de Senha */}
        {!isAuthenticated ? (
          <div className="p-6 flex flex-col items-center justify-center space-y-4 my-auto">
            <div className="w-16 h-16 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
              <Lock className="w-8 h-8" />
            </div>

            {!isRecoveringPassword ? (
              <>
                <div className="text-center space-y-1">
                  <h4 className="text-base font-bold text-white font-display">Acesso Restrito ADM</h4>
                  <p className="text-xs text-neutral-400 max-w-xs">
                    Digite sua senha exclusiva de administrador para acessar o painel de notificações.
                  </p>
                </div>

                {authError && (
                  <div className="w-full max-w-xs p-2.5 bg-red-500/15 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                    <span>{authError}</span>
                  </div>
                )}

                <form onSubmit={handleVerifyPassword} className="w-full max-w-xs space-y-3">
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="Sua senha de ADM"
                      autoFocus
                      className="w-full pl-10 pr-10 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/30 transition-transform duration-75 touch-manipulation"
                  >
                    Acessar Painel ADM
                  </button>

                  <div className="pt-2 flex flex-col items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsRecoveringPassword(true);
                        setAuthError(null);
                      }}
                      className="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1 underline"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Esqueci a senha / Recuperar Senha ADM</span>
                    </button>
                  </div>
                </form>
              </>
            ) : (
              /* Tela de Recuperação de Senha do ADM */
              <form onSubmit={handleRecoverPassword} className="w-full max-w-xs space-y-3">
                <div className="text-center space-y-1">
                  <h4 className="text-base font-bold text-white font-display">Recuperar Senha ADM</h4>
                  <p className="text-xs text-neutral-400">
                    Confirme o PIN de 4 dígitos que você usa para desbloquear o aplicativo e escolha uma nova senha ADM.
                  </p>
                </div>

                {authError && (
                  <div className="w-full p-2.5 bg-red-500/15 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                    <span>{authError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                    PIN de Desbloqueio do App (4 dígitos)
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={recoveryPinInput}
                    onChange={(e) => setRecoveryPinInput(e.target.value)}
                    placeholder="Ex: 2007"
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white text-center font-mono tracking-widest focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                    Nova Senha ADM (ou deixe em branco para voltar para adm85)
                  </label>
                  <input
                    type="text"
                    value={recoveryNewPass}
                    onChange={(e) => setRecoveryNewPass(e.target.value)}
                    placeholder="Nova senha (ex: adm85)"
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRecoveringPassword(false);
                      setAuthError(null);
                    }}
                    className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-semibold rounded-xl"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    disabled={recoveryLoading}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{recoveryLoading ? 'Salvando...' : 'Redefinir'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          /* Tela 2: Painel de Controle e Disparo ADM */
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Status da Transmissão */}
            <div className="p-3 bg-gradient-to-r from-purple-900/30 to-neutral-900/40 border border-purple-500/20 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <span className="text-xs font-semibold text-white">Transmissão Nativa + Auto-Limpeza Ativa</span>
              </div>
              <button
                type="button"
                onClick={() => setIsChangingPass(!isChangingPass)}
                className="text-[11px] text-purple-400 hover:text-purple-300 font-medium underline"
              >
                {isChangingPass ? 'Voltar ao Disparo' : 'Alterar Senha ADM'}
              </button>
            </div>

            {isChangingPass ? (
              /* Formulário de Alteração de Senha do ADM */
              <form onSubmit={handleSaveNewPassword} className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-purple-400" />
                  Alterar Senha Exclusiva do ADM
                </h4>
                <p className="text-[11px] text-neutral-400">
                  Ao salvar uma nova senha, a senha antiga deixará de funcionar imediatamente em todos os aparelhos.
                </p>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Nova Senha</label>
                  <input
                    type="password"
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    placeholder="Mínimo 4 caracteres"
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Confirmar Nova Senha</label>
                  <input
                    type="password"
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    placeholder="Repita a nova senha"
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsChangingPass(false)}
                    className="flex-1 py-2.5 bg-white/5 text-neutral-300 text-xs rounded-xl hover:bg-white/10"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={passSaveLoading}
                    className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md transition-transform"
                  >
                    {passSaveLoading ? 'Salvando...' : 'Salvar Nova Senha'}
                  </button>
                </div>
              </form>
            ) : (
              /* Formulário Principal de Disparo */
              <form onSubmit={handleSendBroadcast} className="space-y-3">
                {/* Botão Especial: Liberar Atualização do App (OTA Sem APK) para todos os celulares */}
                <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-950/60 to-purple-950/40 border border-emerald-500/40 space-y-2.5">
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 shrink-0" />
                        <span>Liberar Atualização do App (Vercel + APK)</span>
                      </p>
                      <p className="text-[10px] text-neutral-300 mt-0.5 leading-snug">
                        Notifica os celulares na barra do Android para atualizar em 1 toque sem precisar baixar outro APK.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={publishingOta}
                      onClick={handlePublishOtaUpdate}
                      className="py-2 px-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-[11px] rounded-xl shadow-md shrink-0 transition-all disabled:opacity-50"
                    >
                      {publishingOta ? 'Liberando...' : 'Notificar Atualização'}
                    </button>
                  </div>
                  <input
                    type="url"
                    value={vercelUrlInput}
                    onChange={(e) => setVercelUrlInput(e.target.value)}
                    placeholder="Link da sua Vercel (ex: https://seu-app.vercel.app) - opcional"
                    className="w-full px-3 py-1.5 bg-black/40 border border-emerald-500/30 rounded-xl text-[11px] text-white placeholder-neutral-400 focus:outline-none focus:border-emerald-400"
                  />
                </div>

                {/* Presets Rápidos */}
                <div>
                  <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1.5">
                    Modelos Rápidos (1 Toque)
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => applyPreset('⚠️ Lembrete de Pagamento!', 'Favor verificar as contas com vencimento para hoje.', 'alta', '')}
                      className="p-2 text-left bg-white/5 hover:bg-purple-600/20 active:scale-95 rounded-xl border border-white/10 text-xs text-neutral-300 transition-all flex items-center gap-1.5"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">Pagar conta hoje</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => applyPreset('💊 Hora do Remédio!', 'Não esqueça de tomar seu medicamento agora e marcar na aba Saúde.', 'alta', 'saude')}
                      className="p-2 text-left bg-white/5 hover:bg-purple-600/20 active:scale-95 rounded-xl border border-white/10 text-xs text-neutral-300 transition-all flex items-center gap-1.5"
                    >
                      <Bell className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span className="truncate">Lembrete de Remédio</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => applyPreset('✅ Conta Paga!', 'Uma conta foi quitada com sucesso. Confira no extrato.', 'media', '')}
                      className="p-2 text-left bg-white/5 hover:bg-purple-600/20 active:scale-95 rounded-xl border border-white/10 text-xs text-neutral-300 transition-all flex items-center gap-1.5"
                    >
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">Conta já foi paga</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => applyPreset('🚨 Alerta Importante!', 'Mensagem urgente do administrador para os celulares.', 'alta', '')}
                      className="p-2 text-left bg-white/5 hover:bg-purple-600/20 active:scale-95 rounded-xl border border-white/10 text-xs text-neutral-300 transition-all flex items-center gap-1.5"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <span className="truncate">Aviso Urgente</span>
                    </button>
                  </div>
                </div>

                {/* Grau de Urgência */}
                <div>
                  <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1">
                    Nível do Alerta
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setUrgencia('alta')}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                        urgencia === 'alta'
                          ? 'bg-red-500/20 border-red-500/50 text-red-300 shadow'
                          : 'bg-white/5 border-white/10 text-neutral-400'
                      }`}
                    >
                      🚨 Urgente
                    </button>
                    <button
                      type="button"
                      onClick={() => setUrgencia('media')}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                        urgencia === 'media'
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow'
                          : 'bg-white/5 border-white/10 text-neutral-400'
                      }`}
                    >
                      📢 Importante
                    </button>
                    <button
                      type="button"
                      onClick={() => setUrgencia('baixa')}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                        urgencia === 'baixa'
                          ? 'bg-blue-500/20 border-blue-500/50 text-blue-300 shadow'
                          : 'bg-white/5 border-white/10 text-neutral-400'
                      }`}
                    >
                      💬 Informativo
                    </button>
                  </div>
                </div>

                {/* Título */}
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                    Título da Notificação
                  </label>
                  <input
                    type="text"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Ex: ⚠️ Lembrete de Pagamento ou 💊 Hora do Remédio"
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Mensagem */}
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                    Mensagem na Barra do Android e Tela de Bloqueio
                  </label>
                  <textarea
                    rows={2}
                    value={mensagem}
                    onChange={(e) => setMensagem(e.target.value)}
                    placeholder="Escreva a mensagem aqui..."
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500 resize-none"
                  />
                </div>

                {/* Recursos Nativos Extras: Link, Botão na Notificação, Imagem e Abrir Aba */}
                <div className="p-3 bg-purple-950/20 border border-purple-500/25 rounded-xl space-y-2.5">
                  <button
                    type="button"
                    onClick={() => setShowRichExtras(!showRichExtras)}
                    className="w-full flex items-center justify-between text-left text-xs font-bold text-purple-300"
                  >
                    <span className="flex items-center gap-1.5">
                      <MousePointerClick className="w-4 h-4 text-purple-400" />
                      <span>Adicionar Link, Botão ou Imagem na Notificação Nativa</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30">
                      {showRichExtras ? 'Ocultar' : 'Personalizar +'}
                    </span>
                  </button>

                  {showRichExtras && (
                    <div className="space-y-2.5 pt-2 border-t border-white/10 animate-in fade-in duration-150">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-neutral-300 mb-1 flex items-center gap-1">
                            <MousePointerClick className="w-3 h-3 text-purple-400" />
                            Texto do Botão Nativo
                          </label>
                          <input
                            type="text"
                            value={botaoTexto}
                            onChange={(e) => setBotaoTexto(e.target.value)}
                            placeholder="Ex: Abrir Link / Ver Agora"
                            className="w-full px-2.5 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-purple-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-neutral-300 mb-1">
                            Ou Abrir Aba do App
                          </label>
                          <select
                            value={targetModal}
                            onChange={(e) => setTargetModal(e.target.value as any)}
                            className="w-full px-2.5 py-2 bg-[#141424] border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-purple-500"
                          >
                            <option value="">Tela Principal (Contas)</option>
                            <option value="saude">❤️ Aba Saúde / Remédios</option>
                            <option value="caixinhas">🐷 Aba Caixinhas</option>
                            <option value="agenda">📅 Aba Agenda / Notas</option>
                            <option value="acordos">🤝 Aba Acordos</option>
                            <option value="settings">⚙️ Configurações</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-neutral-300 mb-1 flex items-center gap-1">
                          <Link2 className="w-3 h-3 text-emerald-400" />
                          Link para Abrir ao Tocar no Botão (Opcional)
                        </label>
                        <input
                          type="url"
                          value={linkUrl}
                          onChange={(e) => setLinkUrl(e.target.value)}
                          placeholder="https://... (Site, Comprovante, WhatsApp, etc.)"
                          className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-neutral-300 mb-1 flex items-center gap-1">
                          <ImageIcon className="w-3 h-3 text-blue-400" />
                          URL de Imagem Grande na Notificação Android (Opcional)
                        </label>
                        <input
                          type="url"
                          value={imagemUrl}
                          onChange={(e) => setImagemUrl(e.target.value)}
                          placeholder="https://exemplo.com/foto.jpg (Aparece expandida na barra do Android)"
                          className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-purple-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Horário de Envio (Opcional - ótimo para testar em 2º plano) */}
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-purple-400" />
                      Horário para Enviar (Opcional)
                    </label>
                    {horarioEnvio && (
                      <button
                        type="button"
                        onClick={() => setHorarioEnvio('')}
                        className="text-[10px] text-purple-400 hover:text-purple-300 underline"
                      >
                        Enviar Agora (Sem horário)
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={horarioEnvio}
                      onChange={(e) => setHorarioEnvio(e.target.value)}
                      className="flex-1 px-3 py-2 bg-[#141424] border border-white/10 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date(Date.now() + 60 * 1000);
                        setHorarioEnvio(
                          `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
                        );
                      }}
                      className="px-2.5 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-[11px] font-bold text-purple-300 transition-all whitespace-nowrap"
                      title="Preenche com 1 minuto no futuro para você fechar o app e testar!"
                    >
                      +1 min (Teste)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date(Date.now() + 2 * 60 * 1000);
                        setHorarioEnvio(
                          `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
                        );
                      }}
                      className="px-2.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-semibold text-neutral-300 transition-all whitespace-nowrap"
                    >
                      +2 min
                    </button>
                  </div>
                  <p className="text-[10px] text-neutral-400">
                    {horarioEnvio
                      ? `Programado para tocar às ${horarioEnvio} em todos os celulares logados (mesmo com o app fechado).`
                      : 'Deixe em branco para disparar imediatamente ou escolha um horário.'}
                  </p>
                </div>

                {/* Botão de Disparo */}
                <button
                  type="submit"
                  disabled={sending}
                  className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 transition-transform duration-75 disabled:opacity-50 touch-manipulation"
                >
                  <Radio className="w-4 h-4 animate-pulse" />
                  <span>
                    {sending
                      ? 'Enviando...'
                      : horarioEnvio
                      ? `Agendar Notificação Nativa para ${horarioEnvio}`
                      : 'Disparar Agora para Todos os Aparelhos'}
                  </span>
                </button>
              </form>
            )}

            {/* =====================================================
                BACKUP, RESTAURAÇÃO (.JSON) E DOWNLOADS (.ZIP) — Abaixo do Disparar Mensagens
               ===================================================== */}
            <div className="pt-3 border-t border-white/10 space-y-2.5 touch-manipulation select-none">
              <span className="font-semibold text-neutral-300 uppercase tracking-wider block text-[11px]">
                Backup, Restauração de Dados & Downloads (.ZIP)
              </span>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <select
                    value={backupOption}
                    onChange={(e) => setBackupOption(e.target.value as any)}
                    className="w-full appearance-none pl-3 pr-8 py-2.5 bg-[#1b1b2f] border border-white/10 rounded-xl text-xs text-white font-medium focus:outline-none focus:border-purple-500 cursor-pointer"
                  >
                    <option value="dados_json">📄 Baixar Dados (.JSON)</option>
                    <option value="restaurar_json">📂 Restaurar Dados de Backup (.JSON)</option>
                    <option value="codigo_fonte">📦 Baixar Código Fonte Completo (.ZIP)</option>
                    <option value="apk_android">🤖 Projeto Android APK Nativo (.ZIP)</option>
                    <option value="site_pronto">🌐 Baixar Site Pronto (Compilado .ZIP)</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-neutral-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {backupOption === 'restaurar_json' ? (
                  <label
                    htmlFor="adm-backup-restore-file-input"
                    className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all shrink-0 cursor-pointer select-none"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Escolher Arquivo</span>
                  </label>
                ) : (
                  <button
                    type="button"
                    onClick={handleExecutarBackupOpcao}
                    className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar</span>
                  </button>
                )}

                <input
                  id="adm-backup-restore-file-input"
                  ref={backupInputRef}
                  type="file"
                  accept=".json,application/json,text/plain,*/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && onImportBackup) {
                      onImportBackup(file);
                      setStatusMessage({
                        type: 'success',
                        text: `Arquivo "${file.name}" carregado e dados do app restaurados com sucesso!`,
                      });
                    }
                    e.target.value = '';
                  }}
                />
              </div>

              {backupOption === 'restaurar_json' && (
                <label
                  htmlFor="adm-backup-restore-file-input"
                  className="mt-1 w-full p-3 border border-dashed border-emerald-500/40 hover:border-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15 rounded-xl flex items-center justify-center gap-2 text-xs text-emerald-300 font-semibold cursor-pointer transition-all"
                >
                  <Upload className="w-4 h-4 shrink-0" />
                  <span>Toque aqui para selecionar o arquivo de backup (.JSON) e restaurar os dados do app</span>
                </label>
              )}

              {backupOption === 'codigo_fonte' && (
                <button
                  type="button"
                  onClick={() =>
                    downloadZipSafe(
                      ['projeto-sutello-financeiro.zip', 'projeto-completo.zip', 'sutello-codigo-fonte-github.zip'],
                      'projeto-sutello-financeiro.zip'
                    )
                  }
                  className="w-full py-2 px-3 bg-purple-600/20 hover:bg-purple-600/30 active:scale-[0.99] border border-purple-500/40 rounded-xl text-left flex items-center justify-between gap-2 transition-all"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-purple-200 truncate">
                      📦 Código Fonte Completo + GitHub + Android (.ZIP)
                    </p>
                    <p className="text-[10px] text-neutral-400 truncate">
                      Pronto para enviar ao GitHub / Vercel e gerar o APK
                    </p>
                  </div>
                  <Download className="w-4 h-4 text-purple-300 shrink-0" />
                </button>
              )}

              {backupOption === 'apk_android' && (
                <button
                  type="button"
                  onClick={() =>
                    downloadZipSafe(
                      ['sutello-android-apk-nativo.zip', 'sutello-android-apk-projeto.zip', 'projeto-android-apk.zip'],
                      'sutello-android-apk-nativo.zip'
                    )
                  }
                  className="w-full py-2 px-3 bg-emerald-600/15 hover:bg-emerald-600/25 active:scale-[0.99] border border-emerald-500/30 rounded-xl text-left flex items-center justify-between gap-2 transition-all"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-emerald-200 truncate">
                      🤖 Pasta Android APK Nativo (.ZIP)
                    </p>
                    <p className="text-[10px] text-neutral-400 truncate">
                      Contém o sincronizador em 2º plano e bloqueio anti-print
                    </p>
                  </div>
                  <Download className="w-4 h-4 text-emerald-300 shrink-0" />
                </button>
              )}

              {backupOption === 'site_pronto' && (
                <button
                  type="button"
                  onClick={() => downloadZipSafe(['site-pronto-dist.zip'], 'site-pronto-dist.zip')}
                  className="w-full py-2 px-3 bg-white/5 hover:bg-white/10 active:scale-[0.99] border border-white/10 rounded-xl text-left flex items-center justify-between gap-2 transition-all"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-neutral-200 truncate">
                      🌐 Site Pronto Compilado - Pasta dist (.ZIP)
                    </p>
                    <p className="text-[10px] text-neutral-400 truncate">
                      Arquivos prontos compilados para hospedagem rápida
                    </p>
                  </div>
                  <Download className="w-4 h-4 text-neutral-300 shrink-0" />
                </button>
              )}

              {(backupOption === 'apk_android' || backupOption === 'codigo_fonte') && <ApkBuilderHelper />}
            </div>

            {/* =====================================================
                ATUALIZAR APP (OTA) — Mais abaixo do Backup/Restauração
               ===================================================== */}
            <div
              className={`p-3 rounded-xl border space-y-2.5 transition-all ${
                isUpdateReady
                  ? 'bg-emerald-500/15 border-emerald-500/40'
                  : 'bg-white/[0.03] border-white/10'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <RefreshCw
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isUpdateReady
                        ? 'text-emerald-400 animate-spin'
                        : checkingUpdate || applyingUpdate
                        ? 'text-purple-400 animate-spin'
                        : 'text-neutral-400'
                    }`}
                  />
                  <p className="text-[11px] font-semibold text-white truncate">
                    {isUpdateReady
                      ? `Nova v${(detectedRemoteInfo || remoteAppVersion)?.version || installedVer.version} disponível`
                      : `Versão do App: v${installedVer.version}`}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {isUpdateReady ? (
                    <button
                      type="button"
                      disabled={applyingUpdate}
                      onClick={handleApplyOtaUpdateClick}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold rounded-lg text-[11px] transition-all disabled:opacity-50"
                    >
                      {applyingUpdate ? 'Atualizando...' : 'Atualizar App'}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={checkingUpdate || applyingUpdate}
                        onClick={handleCheckUpdateClick}
                        className="px-2.5 py-1.5 bg-white/10 hover:bg-white/15 active:scale-95 text-neutral-200 font-semibold rounded-lg text-[10px] border border-white/10 transition-all disabled:opacity-50"
                      >
                        {checkingUpdate ? 'Buscando...' : 'Verificar'}
                      </button>
                      <button
                        type="button"
                        disabled={applyingUpdate || checkingUpdate}
                        onClick={handleApplyOtaUpdateClick}
                        className="px-2.5 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 active:scale-95 text-purple-200 font-semibold rounded-lg text-[10px] border border-purple-500/30 transition-all disabled:opacity-50"
                        title="Atualizar aplicativo direto da nuvem"
                      >
                        {applyingUpdate ? '...' : 'Atualizar App'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span className="text-[10px] text-neutral-400 truncate">
                    OTA da Conta:{' '}
                    <span className="text-purple-300 font-mono">
                      {vercelServerUrl
                        ? vercelServerUrl.replace(/^https?:\/\//, '')
                        : 'app-financeiro-beta-blue.vercel.app'}
                    </span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowVercelInput(!showVercelInput)}
                  className="text-[10px] text-purple-400 hover:text-purple-300 font-semibold underline shrink-0"
                >
                  {showVercelInput ? 'Fechar' : 'Alterar link'}
                </button>
              </div>

              {showVercelInput && (
                <div className="pt-2 border-t border-white/10 space-y-1.5">
                  <label className="block text-[10px] text-neutral-300 font-medium">
                    Link da Vercel (sincronizado automaticamente em todos os aparelhos da conta):
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="url"
                      value={vercelServerUrl}
                      onChange={(e) => setVercelServerUrl(e.target.value)}
                      placeholder="https://app-financeiro-beta-blue.vercel.app"
                      className="flex-1 min-w-0 px-2.5 py-1.5 bg-black/40 border border-white/15 rounded-lg text-[11px] text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const saved = await saveVercelLiveUrl(vercelServerUrl);
                        if (saved) {
                          setVercelServerUrl(saved);
                          setShowVercelInput(false);
                          setStatusMessage({
                            type: 'success',
                            text: `Link (${saved}) vinculado à sua conta! Todos os seus aparelhos já receberam.`,
                          });
                        } else {
                          setStatusMessage({
                            type: 'error',
                            text: 'Informe um link público válido (ex: https://app-financeiro-beta-blue.vercel.app).',
                          });
                        }
                      }}
                      className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-[10px] shrink-0"
                    >
                      Salvar na Conta
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Histórico Recente de Transmissões */}
            <div className="pt-3 border-t border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                  Notificações Ativas no Banco ({transmissoes.length})
                </span>
                <span className="text-[10px] text-emerald-400">
                  Auto-limpeza após visualização ativa
                </span>
              </div>

              {transmissoes.length === 0 ? (
                <div className="p-4 bg-white/5 rounded-xl border border-white/5 text-center text-xs text-neutral-500">
                  Nenhuma notificação pendente no banco de dados (todas as visualizadas já foram limpas para economizar espaço).
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {transmissoes.slice(0, 10).map((msg) => (
                    <div
                      key={msg.id}
                      className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-start justify-between gap-2 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-white truncate">{msg.titulo}</span>
                          {msg.horarioEnvio && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono font-bold">
                              ⏰ {msg.horarioEnvio}
                            </span>
                          )}
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-neutral-400 font-mono">
                            {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-300 mt-0.5 break-words">{msg.mensagem}</p>
                        {(msg.linkUrl || msg.botaoTexto || msg.imagemUrl) && (
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-purple-300 flex-wrap">
                            {msg.botaoTexto && <span>🔘 Botão: {msg.botaoTexto}</span>}
                            {msg.linkUrl && <span className="truncate max-w-[180px]">🔗 {msg.linkUrl}</span>}
                            {msg.imagemUrl && <span>🖼️ Com imagem</span>}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteBroadcast(msg.id)}
                        title="Excluir do banco de dados"
                        className="p-1 text-neutral-500 hover:text-red-400 transition-colors shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

