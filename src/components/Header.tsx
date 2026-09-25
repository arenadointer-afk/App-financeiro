import React from 'react';
import { Eye, EyeOff, Settings, Lock, CloudCheck, CloudOff, Bell } from 'lucide-react';
import { UserProfile } from '../types';

interface HeaderProps {
  profile: UserProfile;
  isPrivate: boolean;
  isCloudSynced: boolean;
  userEmail?: string | null;
  unreadNotificationsCount?: number;
  onOpenNotifications?: () => void;
  onTogglePrivacy: () => void;
  onOpenSettings: () => void;
  onLockApp: () => void;
}

export const Header: React.FC<HeaderProps> = React.memo(({
  profile,
  isPrivate,
  isCloudSynced,
  userEmail,
  unreadNotificationsCount = 0,
  onOpenNotifications,
  onTogglePrivacy,
  onOpenSettings,
  onLockApp,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#0c0c16]/90 backdrop-blur-xl border-b border-white/10 px-4 py-3.5 flex items-center justify-between touch-manipulation select-none">
      {/* Perfil */}
      <div
        className="flex items-center gap-3 cursor-pointer group"
        onClick={onOpenSettings}
        title="Abrir configurações de perfil"
      >
        <div className="relative">
          <div className="w-11 h-11 rounded-full border-2 border-purple-500 overflow-hidden bg-purple-900/40 flex items-center justify-center shadow-md shadow-purple-600/20 group-hover:scale-105 transition-transform">
            {profile.fotoPerfil ? (
              <img src={profile.fotoPerfil} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-base font-bold text-purple-300 font-display">
                {profile.nome?.charAt(0).toUpperCase() || 'S'}
              </span>
            )}
          </div>
          {/* Status badge */}
          <span
            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0c0c16] ${
              isCloudSynced ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
            title={isCloudSynced ? 'Conectado à nuvem Firebase' : 'Sincronizando / Offline'}
          />
        </div>

        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-bold text-white font-display tracking-tight group-hover:text-purple-300 transition-colors">
              {profile.nome ? `Olá, ${profile.nome}` : 'Sutello Financeiro'}
            </h2>
          </div>
          <p className="text-[11px] text-neutral-400 flex items-center gap-1">
            {isCloudSynced && userEmail ? (
              <span className="text-emerald-400 flex items-center gap-1 text-[10px] font-medium" title={`Sincronizado via ${userEmail}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Nuvem ativa ({userEmail.split('@')[0]})
              </span>
            ) : isCloudSynced ? (
              <span className="text-emerald-400/90 flex items-center gap-1 text-[10px]">
                ● Nuvem ativa
              </span>
            ) : (
              <span className="text-amber-400 flex items-center gap-1 text-[10px] hover:underline" title="Clique para sincronizar com outro celular">
                ○ Conectar nuvem (2 celulares)
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Controles do Topo */}
      <div className="flex items-center gap-1.5">
        {/* Sino de Notificações */}
        <button
          type="button"
          onClick={onOpenNotifications}
          className={`relative w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${
            unreadNotificationsCount > 0
              ? 'bg-purple-600/20 text-purple-300 border-purple-500/40 hover:bg-purple-600/30'
              : 'bg-white/5 hover:bg-white/10 text-neutral-400 border-white/10'
          }`}
          title={
            unreadNotificationsCount > 0
              ? `${unreadNotificationsCount} novas notificações pendentes`
              : 'Nenhuma notificação nova'
          }
        >
          <Bell className="w-4 h-4" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center border-2 border-[#0c0c16] shadow-sm animate-pulse">
              {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
            </span>
          )}
        </button>

        {/* Botão de Privacidade */}
        <button
          type="button"
          onClick={onTogglePrivacy}
          className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${
            isPrivate
              ? 'bg-purple-600/20 text-purple-300 border-purple-500/40 shadow-sm'
              : 'bg-white/5 hover:bg-white/10 text-neutral-400 border-white/10'
          }`}
          title={isPrivate ? 'Mostrar valores' : 'Ocultar valores (Modo Privacidade)'}
        >
          {isPrivate ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>

        {/* Botão Configurações */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white border border-white/10 flex items-center justify-center transition-colors"
          title="Configurações"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Botão Bloquear */}
        <button
          type="button"
          onClick={onLockApp}
          className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-red-400 border border-white/10 flex items-center justify-center transition-colors"
          title="Bloquear aplicativo"
        >
          <Lock className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
});

