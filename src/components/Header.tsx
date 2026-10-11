import React, { useState } from 'react';
import { Bell, X } from 'lucide-react';
import { UserProfile } from '../types';

interface HeaderProps {
  profile: UserProfile;
  isPrivate?: boolean;
  isCloudSynced: boolean;
  isOnline?: boolean;
  userEmail?: string | null;
  unreadNotificationsCount?: number;
  onOpenNotifications?: () => void;
  onTogglePrivacy?: () => void;
  onOpenSettings: () => void;
  onLockApp?: () => void;
}

export const Header: React.FC<HeaderProps> = React.memo(({
  profile,
  isCloudSynced,
  isOnline = true,
  userEmail,
  unreadNotificationsCount = 0,
  onOpenNotifications,
}) => {
  const [isPhotoPreviewOpen, setIsPhotoPreviewOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#0c0c16]/90 backdrop-blur-xl border-b border-white/10 px-4 py-3 flex items-center justify-between touch-manipulation select-none">
        {/* Perfil (apenas clicar na foto abre a prévia; nome e descrição não abrem nada) */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsPhotoPreviewOpen(true)}
            title="Ver foto de perfil"
            className="relative group cursor-pointer focus:outline-none active:scale-95 transition-transform"
          >
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
                !isOnline ? 'bg-red-400' : isCloudSynced ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
              title={!isOnline ? 'Offline (Sem internet)' : isCloudSynced ? 'Online' : 'Offline'}
            />
          </button>

          <div className="cursor-default select-none">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-bold text-white font-display tracking-tight">
                {profile.nome ? `Olá, ${profile.nome}` : 'Sutello Financeiro'}
              </h2>
            </div>
            <p className="text-[11px] text-neutral-400 flex items-center gap-1">
              {isOnline && isCloudSynced ? (
                <span className="text-emerald-400 flex items-center gap-1 text-[10px] font-medium" title={userEmail ? `Online (${userEmail})` : 'Online'}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Online
                </span>
              ) : !isOnline ? (
                <span className="text-red-400 flex items-center gap-1 text-[10px] font-medium" title="Sem conexão com a internet">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  Offline
                </span>
              ) : (
                <span className="text-amber-400 flex items-center gap-1 text-[10px]" title="Modo local">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Offline
                </span>
              )}
            </p>
            {(profile.bio ?? 'Foco, fé e prosperidade ✨') && (
              <p className="font-bio text-xs text-purple-200/90 tracking-wide mt-0.5 leading-snug drop-shadow-sm">
                “{profile.bio ?? 'Foco, fé e prosperidade ✨'}”
              </p>
            )}
          </div>
        </div>

        {/* Controles do Topo (Apenas Sino de Notificações) */}
        <div className="flex items-center gap-1.5">
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
        </div>
      </header>

      {/* Modal de Prévia da Foto de Perfil */}
      {isPhotoPreviewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-6 animate-in fade-in duration-150"
          onClick={() => setIsPhotoPreviewOpen(false)}
        >
          <div
            className="relative max-w-xs w-full flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsPhotoPreviewOpen(false)}
              className="absolute -top-11 right-0 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/15 flex items-center justify-center transition-all"
              title="Fechar prévia"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-64 h-64 sm:w-72 sm:h-72 rounded-3xl border-2 border-purple-500/60 overflow-hidden bg-[#121222] shadow-2xl shadow-purple-900/30 flex items-center justify-center">
              {profile.fotoPerfil ? (
                <img
                  src={profile.fotoPerfil}
                  alt={profile.nome || 'Foto de Perfil'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-7xl font-bold text-purple-300 font-display">
                  {profile.nome?.charAt(0).toUpperCase() || 'S'}
                </span>
              )}
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-white font-display">
                {profile.nome || 'Sutello Financeiro'}
              </h3>
              {(profile.bio ?? 'Foco, fé e prosperidade ✨') && (
                <p className="font-bio text-xs text-purple-200/90 mt-0.5">
                  “{profile.bio ?? 'Foco, fé e prosperidade ✨'}”
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
});

