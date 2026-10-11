import React, { useState, useRef, useEffect } from 'react';
import { Settings, X, Camera, Download, Upload, LogOut, Check, AlertCircle, Smartphone, Bell, Cloud, ShieldAlert, Handshake, Package, Heart, Calendar, Fingerprint, ChevronDown, KeyRound, RefreshCw, Sparkles } from 'lucide-react';
import { UserProfile } from '../types';
import { redimensionarImagem } from '../lib/utils';
import { updatePassword, signOut, auth, loginWithEmailPassword, registerWithEmailPassword } from '../lib/firebase';
import {
  getNotificationPreferences,
  saveNotificationPreferences,
  getDeviceNotificationPermission,
  checkDeviceNotificationPermissionAsync,
  requestDeviceNotificationPermission,
  triggerTestNotification,
  isNativeApkPlatform,
  NotificationPreferences,
} from '../lib/deviceNotifications';
import {
  AppVersionInfo,
  getInstalledAppVersion,
  checkAppUpdateNow,
  applyOverTheAirUpdate,
  getSavedVercelLiveUrl,
  saveVercelLiveUrl,
} from '../lib/appUpdater';
import { ApkBuilderHelper } from './ApkBuilderHelper';

interface SettingsModalProps {
  isOpen: boolean;
  profile: UserProfile;
  userEmail?: string | null;
  onSaveProfile: (profile: Partial<UserProfile>) => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  onLogout: () => void;
  onClose: () => void;
  onOpenAdmin?: () => void;
  onOpenAcordos?: () => void;
  qtdAcordosPendentes?: number;
  onOpenCaixinhas?: () => void;
  qtdCaixinhas?: number;
  onOpenSaude?: () => void;
  onOpenAgenda?: () => void;
  qtdAgendaPendentes?: number;
  hasAppUpdate?: boolean;
  remoteAppVersion?: AppVersionInfo | null;
  onCheckAppUpdate?: () => Promise<boolean>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  profile,
  userEmail,
  onSaveProfile,
  onExportBackup,
  onImportBackup,
  onLogout,
  onClose,
  onOpenAdmin,
  onOpenAcordos,
  qtdAcordosPendentes = 0,
  onOpenCaixinhas,
  qtdCaixinhas = 0,
  onOpenSaude,
  onOpenAgenda,
  qtdAgendaPendentes = 0,
  hasAppUpdate = false,
  remoteAppVersion = null,
  onCheckAppUpdate,
}) => {
  const [nome, setNome] = useState(profile.nome || '');
  const [fotoPreview, setFotoPreview] = useState(profile.fotoPerfil || '');
  const [bio, setBio] = useState(profile.bio !== undefined ? profile.bio : 'Foco, fé e prosperidade ✨');
  const [biometria, setBiometria] = useState(profile.biometriaAtivada);
  const [pin, setPin] = useState(profile.pinAcesso || '2007');
  const [novaSenha, setNovaSenha] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(getNotificationPreferences());
  const [testingNotif, setTestingNotif] = useState(false);

  // Estados de atualização OTA do aplicativo (sem precisar baixar APK)
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [applyingUpdate, setApplyingUpdate] = useState(false);
  const [localUpdateDetected, setLocalUpdateDetected] = useState(false);
  const [detectedRemoteInfo, setDetectedRemoteInfo] = useState<AppVersionInfo | null>(remoteAppVersion);
  const [vercelServerUrl, setVercelServerUrl] = useState<string>(() => getSavedVercelLiveUrl());
  const [showVercelInput, setShowVercelInput] = useState<boolean>(false);
  const installedVer = getInstalledAppVersion();

  // Estados de conexão em nuvem para sincronizar múltiplos celulares
  const [cloudEmail, setCloudEmail] = useState('');
  const [cloudPassword, setCloudPassword] = useState('');
  const [cloudPin, setCloudPin] = useState('');
  const [cloudLoading, setCloudLoading] = useState(false);
  const [isCloudRegister, setIsCloudRegister] = useState(false);

  // Opção selecionada no menu de Backup / Download
  const [backupOption, setBackupOption] = useState<'dados_json' | 'restaurar_json' | 'apk_android' | 'site_pronto' | 'codigo_fonte'>('dados_json');

  const handleCloudAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloudEmail.trim() || !cloudPassword) {
      setStatusMsg({ type: 'error', text: 'Informe e-mail e senha.' });
      return;
    }
    if (cloudPassword.length < 6) {
      setStatusMsg({ type: 'error', text: 'A senha precisa ter pelo menos 6 dígitos.' });
      return;
    }
    if (isCloudRegister && cloudPin.replace(/\D/g, '').length !== 4) {
      setStatusMsg({ type: 'error', text: 'Informe o PIN do app (4 dígitos) para criar a conta.' });
      return;
    }

    setCloudLoading(true);
    setStatusMsg(null);

    try {
      if (isCloudRegister) {
        const cleanPin = cloudPin.replace(/\D/g, '');
        await registerWithEmailPassword(cloudEmail.trim(), cloudPassword, cleanPin);
        setPin(cleanPin);
        setStatusMsg({ type: 'success', text: 'Nova conta independente criada com sucesso!' });
      } else {
        await loginWithEmailPassword(cloudEmail.trim(), cloudPassword);
        setStatusMsg({ type: 'success', text: 'Conta conectada!' });
      }
      setCloudEmail('');
      setCloudPassword('');
      setCloudPin('');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setStatusMsg({ type: 'error', text: 'E-mail ou senha incorretos.' });
      } else if (err.code === 'auth/user-not-found') {
        setStatusMsg({ type: 'error', text: 'Conta não encontrada. Use Criar Conta.' });
      } else if (err.code === 'auth/email-already-in-use') {
        setStatusMsg({ type: 'error', text: 'Este e-mail já existe. Use Entrar.' });
      } else {
        setStatusMsg({ type: 'error', text: err.message || 'Falha ao conectar.' });
      }
    } finally {
      setCloudLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setNome(profile.nome || '');
      setFotoPreview(profile.fotoPerfil || '');
      setBio(profile.bio !== undefined ? profile.bio : 'Foco, fé e prosperidade ✨');
      setBiometria(profile.biometriaAtivada);
      setPin(profile.pinAcesso || '2007');
      setNotifPermission(getDeviceNotificationPermission());
      setNotifPrefs(getNotificationPreferences());
      setDetectedRemoteInfo(remoteAppVersion);
      setLocalUpdateDetected(hasAppUpdate);
      setVercelServerUrl(remoteAppVersion?.liveUrl || getSavedVercelLiveUrl());
      checkDeviceNotificationPermissionAsync().then((perm) => {
        setNotifPermission(perm);
        setNotifPrefs(getNotificationPreferences());
      });
    }
  }, [isOpen, profile, hasAppUpdate, remoteAppVersion]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const isUpdateReady = hasAppUpdate || localUpdateDetected;

  const handleCheckUpdateClick = async () => {
    setCheckingUpdate(true);
    setStatusMsg(null);
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
        setStatusMsg({
          type: 'success',
          text: `Nova atualização v${res.remoteInfo.version} encontrada! Toque em "Atualizar" abaixo para carregar as mudanças.`,
        });
      } else if (!res.remoteInfo.liveUrl && window.location.hostname === 'localhost') {
        setShowVercelInput(true);
        setStatusMsg({
          type: 'error',
          text: 'Para o APK puxar as mudanças novas da Vercel sem gerar outro APK, informe o link do seu site da Vercel abaixo (apenas 1 vez) ou abra o site da Vercel uma vez.',
        });
      } else {
        setStatusMsg({
          type: 'success',
          text: `Versão v${res.remoteInfo.version} verificada. Toque em "Atualizar" para recarregar os arquivos mais recentes da Vercel.`,
        });
      }
    } catch {
      setStatusMsg({ type: 'error', text: 'Não foi possível verificar atualizações agora.' });
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleApplyOtaUpdateClick = async () => {
    setApplyingUpdate(true);
    if (vercelServerUrl.trim()) {
      await saveVercelLiveUrl(vercelServerUrl.trim());
    }
    const targetUrl = vercelServerUrl.trim() || detectedRemoteInfo?.liveUrl || remoteAppVersion?.liveUrl || getSavedVercelLiveUrl();
    if (!targetUrl && window.location.hostname === 'localhost') {
      setApplyingUpdate(false);
      setShowVercelInput(true);
      setStatusMsg({
        type: 'error',
        text: 'Informe o link do seu site na Vercel abaixo (ex: https://seu-app.vercel.app) para o APK carregar os arquivos novos!',
      });
      return;
    }
    setStatusMsg({
      type: 'success',
      text: 'Sincronizando arquivos novos da Vercel (seus dados estão 100% protegidos)...',
    });
    setTimeout(async () => {
      await applyOverTheAirUpdate(detectedRemoteInfo || remoteAppVersion, targetUrl);
    }, 500);
  };

  const handleToggleNotif = async () => {
    if (notifPermission !== 'granted') {
      const res = await requestDeviceNotificationPermission();
      setNotifPermission(res);
      setNotifPrefs(getNotificationPreferences());
      if (res === 'granted') {
        setStatusMsg({ type: 'success', text: 'Notificações ativadas!' });
      } else {
        setStatusMsg({ type: 'error', text: 'Permissão negada no navegador.' });
      }
    } else {
      const updated = saveNotificationPreferences({ enabled: !notifPrefs.enabled });
      setNotifPrefs(updated);
    }
  };

  const handleTestNotification = async () => {
    setTestingNotif(true);
    const ok = await triggerTestNotification();
    setTestingNotif(false);
    if (ok) {
      setStatusMsg({ type: 'success', text: 'Teste enviado!' });
    } else {
      setStatusMsg({ type: 'error', text: 'Permita notificações no navegador.' });
    }
  };

  const downloadZipSafe = async (fileNames: string[], downloadAs: string) => {
    setStatusMsg({ type: 'success', text: `Baixando ${downloadAs} atualizado...` });
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
        setStatusMsg({ type: 'success', text: `Download de ${downloadAs} concluído com sucesso!` });
        return;
      } catch {
        // tenta a próxima URL
      }
    }

    setStatusMsg({
      type: 'error',
      text: 'Não foi possível baixar o arquivo ZIP neste navegador. Abra pelo link oficial do App no navegador Chrome.',
    });
  };

  const handleExecutarBackupOpcao = () => {
    if (backupOption === 'dados_json') {
      onExportBackup();
    } else if (backupOption === 'restaurar_json') {
      backupInputRef.current?.click();
    } else if (backupOption === 'apk_android') {
      downloadZipSafe(
        ['sutello-android-apk-projeto.zip', 'projeto-android-apk.zip'],
        'sutello-android-apk-nativo.zip'
      );
    } else if (backupOption === 'site_pronto') {
      downloadZipSafe(['site-pronto-dist.zip'], 'site-pronto-dist.zip');
    } else if (backupOption === 'codigo_fonte') {
      downloadZipSafe(
        ['projeto-completo.zip', 'projeto-sutello-financeiro.zip', 'sutello-codigo-fonte-github.zip'],
        'projeto-sutello-financeiro.zip'
      );
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === 'string') {
        const optimized = await redimensionarImagem(reader.result, 300);
        setFotoPreview(optimized);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    setStatusMsg(null);

    try {
      if (novaSenha.trim()) {
        if (auth.currentUser) {
          await updatePassword(auth.currentUser, novaSenha.trim());
        }
      }

      onSaveProfile({
        nome: nome.trim(),
        fotoPerfil: fotoPreview,
        biometriaAtivada: biometria,
        pinAcesso: pin.trim() || '2007',
        bio: bio.trim(),
      });

      setStatusMsg({ type: 'success', text: 'Configurações atualizadas com sucesso!' });
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      console.error(err);
      setStatusMsg({
        type: 'error',
        text: err.message || 'Erro ao atualizar. Se alterou a senha, tente fazer login novamente antes.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#13131f] border border-white/10 rounded-2xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto text-left">
        {/* Topo */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-600/20 text-purple-400 flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-display">Configurações do Perfil</h3>
              <p className="text-xs text-neutral-400">{userEmail || 'Sutello Financeiro'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {statusMsg && (
          <div
            className={`p-3 rounded-xl mb-4 text-xs flex items-center gap-2 ${
              statusMsg.type === 'success'
                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/15 border border-red-500/30 text-red-300'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        <div className="space-y-4 text-xs">
          {/* Foto de Perfil + Bio estilo WhatsApp abaixo da foto */}
          <div className="flex flex-col items-center justify-center py-2">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <div className="w-20 h-20 rounded-full border-2 border-purple-500 overflow-hidden bg-purple-900/30 flex items-center justify-center">
                {fotoPreview ? (
                  <img src={fotoPreview} alt="Foto de Perfil" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-purple-300 font-display">
                    {nome.charAt(0).toUpperCase() || 'S'}
                  </span>
                )}
              </div>
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-5 h-5 text-white" />
              </div>
              <div className="absolute bottom-0 right-0 p-1.5 bg-purple-600 text-white rounded-full shadow">
                <Camera className="w-3 h-3" />
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />
            <span className="text-[11px] text-neutral-400 mt-2">Clique na foto para alterar</span>

            {/* Mensagem / Bio abaixo da foto de perfil (estilo recado do WhatsApp) */}
            {bio.trim() && (
              <div className="mt-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/25 max-w-[90%] text-center shadow-sm">
                <p className="font-bio text-sm text-purple-200 tracking-wide leading-snug">
                  “{bio.trim()}”
                </p>
              </div>
            )}
          </div>

          {/* Nome e Mensagem / Bio (Recado estilo Whats) */}
          <div className="space-y-3">
            <div>
              <label className="block font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                Nome da Conta
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome completo ou apelido"
                className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                Mensagem / Bio (Estilo WhatsApp)
              </label>
              <input
                type="text"
                maxLength={80}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Digite sua frase ou recado..."
                className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-purple-200 font-bio text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* PIN de Segurança */}
          <div>
            <label className="block font-semibold text-neutral-400 uppercase tracking-wider mb-1">
              PIN de Acesso Rápido (4 Dígitos)
            </label>
            <input
              type="password"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="2007"
              className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white font-mono text-center tracking-widest text-base focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Biometria e Notificações (Resumido lado a lado ou compacto) */}
          <div className="grid grid-cols-2 gap-2">
            {/* Ativar Biometria */}
            <button
              type="button"
              onClick={() => setBiometria(!biometria)}
              className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                biometria
                  ? 'bg-purple-600/20 border-purple-500/40 text-white'
                  : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <Fingerprint className={`w-4 h-4 shrink-0 ${biometria ? 'text-purple-400' : 'text-neutral-500'}`} />
                <span className="font-semibold text-xs">Biometria</span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                biometria ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-neutral-400'
              }`}>
                {biometria ? 'ON' : 'OFF'}
              </span>
            </button>

            {/* Ativar Notificações */}
            <button
              type="button"
              onClick={handleToggleNotif}
              className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                notifPermission === 'granted' && notifPrefs.enabled
                  ? 'bg-purple-600/20 border-purple-500/40 text-white'
                  : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <Smartphone className={`w-4 h-4 shrink-0 ${notifPermission === 'granted' && notifPrefs.enabled ? 'text-purple-400' : 'text-neutral-500'}`} />
                <span className="font-semibold text-xs">Notificações</span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                notifPermission === 'granted' && notifPrefs.enabled
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-white/10 text-neutral-400'
              }`}>
                {notifPermission === 'granted' && notifPrefs.enabled ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>

          {/* Sincronização de Conta (Resumido, sem textos longos) */}
          <div className="p-3 bg-white/5 border border-white/10 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-purple-400 shrink-0" />
                <span className="font-semibold text-white text-xs">Sincronização de Conta</span>
              </div>
              {userEmail && (
                <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full truncate max-w-[160px]">
                  {userEmail}
                </span>
              )}
            </div>

            {userEmail ? (
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-emerald-400 flex items-center gap-1.5 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Conectado
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await signOut(auth);
                    window.location.reload();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-[11px] text-red-300 font-semibold transition-all"
                >
                  Desconectar
                </button>
              </div>
            ) : (
              <form onSubmit={handleCloudAuth} className="space-y-2">
                <div className="flex bg-white/5 p-1 rounded-lg border border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsCloudRegister(false)}
                    className={`flex-1 py-1 text-xs font-semibold rounded-md transition-all ${
                      !isCloudRegister ? 'bg-purple-600 text-white' : 'text-neutral-400'
                    }`}
                  >
                    Conectar Conta
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCloudRegister(true)}
                    className={`flex-1 py-1 text-xs font-semibold rounded-md transition-all ${
                      isCloudRegister ? 'bg-purple-600 text-white' : 'text-neutral-400'
                    }`}
                  >
                    Criar Nova Conta
                  </button>
                </div>

                <input
                  type="email"
                  value={cloudEmail}
                  onChange={(e) => setCloudEmail(e.target.value)}
                  placeholder="E-mail"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
                />

                <div className={isCloudRegister ? 'grid grid-cols-2 gap-2' : ''}>
                  <input
                    type="password"
                    value={cloudPassword}
                    onChange={(e) => setCloudPassword(e.target.value)}
                    placeholder="Senha (mín. 6)"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
                  />

                  {isCloudRegister && (
                    <div className="relative">
                      <KeyRound className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        value={cloudPin}
                        onChange={(e) => setCloudPin(e.target.value.replace(/\D/g, ''))}
                        placeholder="PIN (4 díg.)"
                        className="w-full pl-8 pr-2.5 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white font-mono tracking-widest placeholder-neutral-500 focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={cloudLoading}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg shadow transition-all disabled:opacity-50"
                >
                  {cloudLoading
                    ? 'Aguarde...'
                    : isCloudRegister
                    ? 'Criar Conta Nova'
                    : 'Conectar'}
                </button>
              </form>
            )}
          </div>

          {/* Nova Senha */}
          <div>
            <label className="block font-semibold text-neutral-400 uppercase tracking-wider mb-1">
              Nova Senha (Opcional)
            </label>
            <input
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Botão Salvar Perfil */}
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="w-full py-3 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-bold rounded-xl shadow-lg shadow-purple-600/30 transition-transform duration-75 text-sm disabled:opacity-50 touch-manipulation"
          >
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>

          {/* Seção Acordos e Negociações — Ícones Quadrados Pequenos e Simples */}
          {(onOpenAcordos || onOpenCaixinhas || onOpenSaude || onOpenAgenda) && (
            <div className="pt-3 border-t border-white/10 space-y-2 touch-manipulation select-none">
              <span className="font-semibold text-neutral-400 uppercase tracking-wider block text-[11px]">
                Atalhos & Módulos
              </span>

              <div className="grid grid-cols-4 gap-2">
                {onOpenAcordos && (
                  <button
                    type="button"
                    onClick={onOpenAcordos}
                    className="relative p-2.5 rounded-xl bg-white/5 hover:bg-purple-600/20 active:scale-95 border border-white/10 hover:border-purple-500/40 flex flex-col items-center justify-center gap-1.5 transition-all group"
                  >
                    {qtdAcordosPendentes > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-black text-[9px] font-extrabold flex items-center justify-center">
                        {qtdAcordosPendentes}
                      </span>
                    )}
                    <div className="w-8 h-8 rounded-lg bg-purple-500/15 text-purple-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Handshake className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-semibold text-neutral-200 truncate w-full text-center">
                      Acordos
                    </span>
                  </button>
                )}

                {onOpenCaixinhas && (
                  <button
                    type="button"
                    onClick={onOpenCaixinhas}
                    className="relative p-2.5 rounded-xl bg-white/5 hover:bg-emerald-600/20 active:scale-95 border border-white/10 hover:border-emerald-500/40 flex flex-col items-center justify-center gap-1.5 transition-all group"
                  >
                    {qtdCaixinhas > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-emerald-500 text-black text-[9px] font-extrabold flex items-center justify-center">
                        {qtdCaixinhas}
                      </span>
                    )}
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Package className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-semibold text-neutral-200 truncate w-full text-center">
                      Caixinhas
                    </span>
                  </button>
                )}

                {onOpenSaude && (
                  <button
                    type="button"
                    onClick={onOpenSaude}
                    className="relative p-2.5 rounded-xl bg-white/5 hover:bg-rose-600/20 active:scale-95 border border-white/10 hover:border-rose-500/40 flex flex-col items-center justify-center gap-1.5 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-rose-500/15 text-rose-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Heart className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-semibold text-neutral-200 truncate w-full text-center">
                      Saúde
                    </span>
                  </button>
                )}

                {onOpenAgenda && (
                  <button
                    type="button"
                    onClick={onOpenAgenda}
                    className="relative p-2.5 rounded-xl bg-white/5 hover:bg-amber-600/20 active:scale-95 border border-white/10 hover:border-amber-500/40 flex flex-col items-center justify-center gap-1.5 transition-all group"
                  >
                    {qtdAgendaPendentes > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-black text-[9px] font-extrabold flex items-center justify-center">
                        {qtdAgendaPendentes}
                      </span>
                    )}
                    <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-semibold text-neutral-200 truncate w-full text-center">
                      Agenda
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Sair da Conta */}
          <div className="pt-2 border-t border-white/10 touch-manipulation select-none">
            <button
              type="button"
              onClick={onLogout}
              className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 active:scale-95 text-red-400 rounded-xl border border-red-500/20 flex items-center justify-center gap-2 transition-transform duration-75 font-semibold touch-manipulation"
            >
              <LogOut className="w-4 h-4 pointer-events-none" />
              Sair da Conta / Bloquear
            </button>
          </div>

          {/* Botão ADM Discreto e Escondido */}
          {onOpenAdmin && (
            <div className="pt-3 pb-1 flex items-center justify-center touch-manipulation select-none">
              <button
                type="button"
                onClick={onOpenAdmin}
                className="py-1 px-3 text-[11px] text-neutral-600 hover:text-neutral-400 active:text-purple-300 transition-colors rounded-lg flex items-center gap-1.5 touch-manipulation opacity-40 hover:opacity-100"
                title="Acesso ADM"
              >
                <ShieldAlert className="w-3 h-3 text-neutral-500" />
                <span className="font-mono text-[10px] tracking-wider">ADM</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
