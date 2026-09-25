import React, { useState, useRef, useEffect } from 'react';
import { Settings, X, Camera, Shield, Download, Upload, LogOut, Key, Check, AlertCircle, Archive, Smartphone, Bell, Cloud, Mail, LogIn, UserPlus } from 'lucide-react';
import { UserProfile } from '../types';
import { redimensionarImagem } from '../lib/utils';
import { updatePassword, signOut, auth, loginWithEmailPassword, registerWithEmailPassword } from '../lib/firebase';
import {
  getNotificationPreferences,
  saveNotificationPreferences,
  getDeviceNotificationPermission,
  requestDeviceNotificationPermission,
  triggerTestNotification,
  NotificationPreferences,
} from '../lib/deviceNotifications';

interface SettingsModalProps {
  isOpen: boolean;
  profile: UserProfile;
  userEmail?: string | null;
  onSaveProfile: (profile: Partial<UserProfile>) => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  onLogout: () => void;
  onClose: () => void;
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
}) => {
  const [nome, setNome] = useState(profile.nome || '');
  const [fotoPreview, setFotoPreview] = useState(profile.fotoPerfil || '');
  const [biometria, setBiometria] = useState(profile.biometriaAtivada);
  const [pin, setPin] = useState(profile.pinAcesso || '2007');
  const [novaSenha, setNovaSenha] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(getNotificationPreferences());
  const [testingNotif, setTestingNotif] = useState(false);

  // Estados de conexão em nuvem para sincronizar múltiplos celulares
  const [cloudEmail, setCloudEmail] = useState('');
  const [cloudPassword, setCloudPassword] = useState('');
  const [cloudLoading, setCloudLoading] = useState(false);
  const [isCloudRegister, setIsCloudRegister] = useState(false);

  const handleCloudAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloudEmail.trim() || !cloudPassword) {
      setStatusMsg({ type: 'error', text: 'Informe e-mail e senha para conectar.' });
      return;
    }
    if (cloudPassword.length < 6) {
      setStatusMsg({ type: 'error', text: 'A senha precisa ter pelo menos 6 dígitos.' });
      return;
    }

    setCloudLoading(true);
    setStatusMsg(null);

    try {
      if (isCloudRegister) {
        await registerWithEmailPassword(cloudEmail.trim(), cloudPassword);
        setStatusMsg({ type: 'success', text: 'Conta criada e sincronizada com sucesso!' });
      } else {
        await loginWithEmailPassword(cloudEmail.trim(), cloudPassword);
        setStatusMsg({ type: 'success', text: 'Conectado à nuvem! Este celular agora sincroniza em tempo real.' });
      }
      setCloudEmail('');
      setCloudPassword('');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setStatusMsg({ type: 'error', text: 'E-mail ou senha incorretos. Caso seja sua primeira vez, clique em Criar Conta.' });
      } else if (err.code === 'auth/user-not-found') {
        setStatusMsg({ type: 'error', text: 'Conta não encontrada. Alterne para Criar Conta para registrar.' });
      } else if (err.code === 'auth/email-already-in-use') {
        setStatusMsg({ type: 'error', text: 'Este e-mail já existe. Escolha "Entrar" com a senha existente.' });
      } else {
        setStatusMsg({ type: 'error', text: err.message || 'Falha ao conectar à nuvem.' });
      }
    } finally {
      setCloudLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setNotifPermission(getDeviceNotificationPermission());
      setNotifPrefs(getNotificationPreferences());
    }
  }, [isOpen]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleToggleNotif = async () => {
    if (notifPermission !== 'granted') {
      const res = await requestDeviceNotificationPermission();
      setNotifPermission(res);
      setNotifPrefs(getNotificationPreferences());
      if (res === 'granted') {
        setStatusMsg({ type: 'success', text: 'Notificações no celular ativadas com sucesso!' });
      } else {
        setStatusMsg({ type: 'error', text: 'Permissão de notificação não foi concedida pelo navegador.' });
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
      setStatusMsg({ type: 'success', text: 'Notificação de teste enviada para o celular!' });
    } else {
      setStatusMsg({ type: 'error', text: 'Não foi possível disparar. Permita notificações no navegador.' });
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
          {/* Foto de Perfil */}
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
          </div>

          {/* Nome */}
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

          {/* Biometria */}
          <div className="flex items-center justify-between p-3.5 bg-white/5 border border-white/10 rounded-xl">
            <div>
              <span className="font-semibold text-white block">Ativar Biometria / Touch ID</span>
              <span className="text-[11px] text-neutral-400">
                Permite autenticação rápida por impressão digital
              </span>
            </div>
            <input
              type="checkbox"
              checked={biometria}
              onChange={(e) => setBiometria(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-white/5 text-purple-600 focus:ring-purple-500 cursor-pointer"
            />
          </div>

          {/* Notificações no Celular */}
          <div className="p-3.5 bg-white/5 border border-white/10 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-purple-400 shrink-0" />
                <div>
                  <span className="font-semibold text-white block">Notificações no Celular</span>
                  <span className="text-[11px] text-neutral-400">
                    Avisos de contas vencidas, parcelas e novas contas
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={notifPermission === 'granted' && notifPrefs.enabled}
                onChange={handleToggleNotif}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-purple-600 focus:ring-purple-500 cursor-pointer"
              />
            </div>

            {notifPermission === 'granted' && notifPrefs.enabled && (
              <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Pronto para receber alertas
                </span>
                <button
                  type="button"
                  onClick={handleTestNotification}
                  disabled={testingNotif}
                  className="px-2.5 py-1 text-[11px] bg-purple-600/30 hover:bg-purple-600/50 active:scale-95 text-purple-200 rounded-lg border border-purple-500/30 flex items-center gap-1 transition-all touch-manipulation"
                >
                  <Bell className="w-3 h-3" />
                  <span>{testingNotif ? 'Enviando...' : 'Testar Agora'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Sincronização em Tempo Real entre 2 Celulares */}
          <div className="p-3.5 bg-gradient-to-br from-purple-900/20 to-neutral-900/60 border border-purple-500/30 rounded-xl space-y-3">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 text-purple-400 shrink-0" />
              <div>
                <span className="font-semibold text-white block text-sm">Sincronização em Tempo Real (2 Celulares)</span>
                <span className="text-[11px] text-neutral-400">
                  {userEmail
                    ? 'Conectado! O que você fizer aqui aparece no outro celular instantaneamente.'
                    : 'Conecte este celular à nuvem para sincronizar com seu outro aparelho.'}
                </span>
              </div>
            </div>

            {userEmail ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-emerald-300 font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Conta Conectada
                  </span>
                  <span className="text-[11px] font-mono text-emerald-200">{userEmail}</span>
                </div>
                <p className="text-[11px] text-neutral-300 leading-relaxed">
                  📱 Para ver as mesmas contas e receber notificações no outro celular, basta abrir o app nele e entrar com este mesmo e-mail.
                </p>
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={async () => {
                      await signOut(auth);
                      window.location.reload();
                    }}
                    className="text-[11px] text-red-400 hover:text-red-300 underline"
                  >
                    Desconectar desta conta
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCloudAuth} className="space-y-2 pt-1">
                <div className="flex bg-white/5 p-1 rounded-lg border border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsCloudRegister(false)}
                    className={`flex-1 py-1 text-xs font-semibold rounded-md transition-all ${
                      !isCloudRegister ? 'bg-purple-600 text-white' : 'text-neutral-400'
                    }`}
                  >
                    Entrar
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCloudRegister(true)}
                    className={`flex-1 py-1 text-xs font-semibold rounded-md transition-all ${
                      isCloudRegister ? 'bg-purple-600 text-white' : 'text-neutral-400'
                    }`}
                  >
                    Criar Conta
                  </button>
                </div>

                <input
                  type="email"
                  value={cloudEmail}
                  onChange={(e) => setCloudEmail(e.target.value)}
                  placeholder="Seu e-mail (ex: seu-nome@gmail.com)"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
                />

                <input
                  type="password"
                  value={cloudPassword}
                  onChange={(e) => setCloudPassword(e.target.value)}
                  placeholder="Senha (mínimo 6 dígitos)"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
                />

                <button
                  type="submit"
                  disabled={cloudLoading}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg shadow transition-all disabled:opacity-50"
                >
                  {cloudLoading
                    ? 'Conectando...'
                    : isCloudRegister
                    ? 'Cadastrar e Conectar Nuvem'
                    : 'Conectar à Nuvem'}
                </button>
              </form>
            )}
          </div>

          {/* Nova Senha */}
          <div>
            <label className="block font-semibold text-neutral-400 uppercase tracking-wider mb-1">
              Nova Senha (Deixe em branco para não alterar)
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

          {/* Seção de Backup */}
          <div className="pt-4 border-t border-white/10 space-y-2 touch-manipulation select-none">
            <span className="font-semibold text-neutral-400 uppercase tracking-wider block mb-1">
              Backup e Segurança dos Dados
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onExportBackup}
                className="py-2.5 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 active:bg-emerald-500/30 active:scale-95 text-emerald-300 rounded-xl border border-emerald-500/20 flex items-center justify-center gap-1.5 transition-transform duration-75 font-medium touch-manipulation"
              >
                <Download className="w-3.5 h-3.5 pointer-events-none" />
                Baixar Dados
              </button>

              <button
                type="button"
                onClick={() => backupInputRef.current?.click()}
                className="py-2.5 px-3 bg-white/5 hover:bg-white/10 active:bg-white/20 active:scale-95 text-neutral-300 rounded-xl border border-white/10 flex items-center justify-center gap-1.5 transition-transform duration-75 font-medium touch-manipulation"
              >
                <Upload className="w-3.5 h-3.5 pointer-events-none" />
                Restaurar Dados
              </button>
              <input
                ref={backupInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onImportBackup(file);
                }}
              />
            </div>

            <a
              href="./site-pronto-dist.zip"
              download="site-pronto-dist.zip"
              className="w-full py-2.5 px-3 bg-emerald-600/15 hover:bg-emerald-600/25 active:bg-emerald-600/35 active:scale-95 text-emerald-300 rounded-xl border border-emerald-500/30 flex items-center justify-center gap-2 transition-transform duration-75 font-medium text-center touch-manipulation"
            >
              <Download className="w-3.5 h-3.5 pointer-events-none" />
              Baixar Site Pronto (Arquivos Compilados)
            </a>

            <a
              href="./projeto-completo.zip"
              download="projeto-sutello-financeiro.zip"
              className="w-full py-2.5 px-3 bg-purple-600/15 hover:bg-purple-600/25 active:bg-purple-600/35 active:scale-95 text-purple-300 rounded-xl border border-purple-500/30 flex items-center justify-center gap-2 transition-transform duration-75 font-medium text-center touch-manipulation"
            >
              <Archive className="w-3.5 h-3.5 pointer-events-none" />
              Baixar Código Fonte Completo (.ZIP)
            </a>
          </div>

          {/* Sair da Conta */}
          <div className="pt-2 touch-manipulation select-none">
            <button
              type="button"
              onClick={onLogout}
              className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 active:scale-95 text-red-400 rounded-xl border border-red-500/20 flex items-center justify-center gap-2 transition-transform duration-75 font-semibold touch-manipulation"
            >
              <LogOut className="w-4 h-4 pointer-events-none" />
              Sair da Conta / Bloquear
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
