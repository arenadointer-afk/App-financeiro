import React, { useState, useRef } from 'react';
import { Settings, X, Camera, Shield, Download, Upload, LogOut, Key, Check, AlertCircle, Archive } from 'lucide-react';
import { UserProfile } from '../types';
import { redimensionarImagem } from '../lib/utils';
import { updatePassword, signOut, auth } from '../lib/firebase';

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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

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
              className="w-4 h-4 rounded border-white/20 bg-white/5 text-purple-600 focus:ring-purple-500"
            />
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
            className="w-full py-3 bg-purple-600 hover:bg-purple-500 active:scale-[0.98] text-white font-bold rounded-xl shadow-lg shadow-purple-600/30 transition-all text-sm disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>

          {/* Seção de Backup */}
          <div className="pt-4 border-t border-white/10 space-y-2">
            <span className="font-semibold text-neutral-400 uppercase tracking-wider block mb-1">
              Backup e Segurança dos Dados
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onExportBackup}
                className="py-2.5 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 rounded-xl border border-emerald-500/20 flex items-center justify-center gap-1.5 transition-colors font-medium"
              >
                <Download className="w-3.5 h-3.5" />
                Baixar Dados
              </button>

              <button
                type="button"
                onClick={() => backupInputRef.current?.click()}
                className="py-2.5 px-3 bg-white/5 hover:bg-white/10 text-neutral-300 rounded-xl border border-white/10 flex items-center justify-center gap-1.5 transition-colors font-medium"
              >
                <Upload className="w-3.5 h-3.5" />
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
              href="/projeto-completo.zip"
              download="projeto-sutello-financeiro.zip"
              className="w-full py-2.5 px-3 bg-purple-600/15 hover:bg-purple-600/25 text-purple-300 rounded-xl border border-purple-500/30 flex items-center justify-center gap-2 transition-colors font-medium text-center"
            >
              <Archive className="w-3.5 h-3.5" />
              Baixar Código Fonte Completo (.ZIP)
            </a>
          </div>

          {/* Sair da Conta */}
          <div className="pt-2">
            <button
              type="button"
              onClick={onLogout}
              className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl border border-red-500/20 flex items-center justify-center gap-2 transition-colors font-semibold"
            >
              <LogOut className="w-4 h-4" />
              Sair da Conta / Bloquear
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
