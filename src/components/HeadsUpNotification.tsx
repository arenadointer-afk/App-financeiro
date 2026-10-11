import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  PartyPopper,
  X,
  ChevronRight,
  Shield,
  ExternalLink,
} from 'lucide-react';

export interface HeadsUpData {
  id: string;
  title: string;
  body: string;
  tipo?: string;
  tag?: string;
  contaId?: string | number;
  targetModal?: 'saude' | 'caixinhas' | 'agenda' | 'acordos' | 'notificacoes' | 'settings';
  targetSaudeTab?: 'pesoxaltura' | 'remedios' | 'consultas' | 'metricas' | 'cartao';
  linkUrl?: string;
  botaoTexto?: string;
  imagemUrl?: string;
  timestamp: number;
}

interface HeadsUpNotificationProps {
  onSelectConta?: (contaId: string | number) => void;
  onOpenNotifications?: () => void;
  onOpenTargetModal?: (targetModal: 'saude' | 'caixinhas' | 'agenda' | 'acordos' | 'notificacoes' | 'settings', targetSaudeTab?: 'pesoxaltura' | 'remedios' | 'consultas' | 'metricas' | 'cartao') => void;
}

export const HeadsUpNotification: React.FC<HeadsUpNotificationProps> = ({
  onSelectConta,
  onOpenNotifications,
  onOpenTargetModal,
}) => {
  const [currentNotice, setCurrentNotice] = useState<HeadsUpData | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartY = useRef<number>(0);

  useEffect(() => {
    const handleNotificationEvent = (event: Event) => {
      const customEv = event as CustomEvent<HeadsUpData>;
      if (!customEv.detail) return;

      const data = customEv.detail;
      setCurrentNotice(data);
      setIsVisible(true);

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => setCurrentNotice(null), 300);
      }, 7000);
    };

    window.addEventListener('sutello_heads_up_notification', handleNotificationEvent);

    return () => {
      window.removeEventListener('sutello_heads_up_notification', handleNotificationEvent);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!currentNotice) return null;

  const handleDismiss = () => {
    setIsVisible(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    setTimeout(() => setCurrentNotice(null), 300);
  };

  const handleBannerClick = () => {
    if (currentNotice.linkUrl) {
      window.location.href = currentNotice.linkUrl;
      handleDismiss();
      return;
    }
    if (currentNotice.targetModal && onOpenTargetModal) {
      onOpenTargetModal(currentNotice.targetModal, currentNotice.targetSaudeTab);
    } else if (currentNotice.contaId && onSelectConta) {
      onSelectConta(currentNotice.contaId);
    } else if (onOpenNotifications) {
      onOpenNotifications();
    }
    handleDismiss();
  };

  // Suporte a swipe up para dispensar
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    if (deltaY < -30) {
      handleDismiss();
    }
  };

  const isVencida = currentNotice.title.includes('VENCEU') || currentNotice.tipo === 'atrasada';
  const isPaga = currentNotice.title.includes('PAGA') || currentNotice.tipo === 'conta_paga';
  const isHoje = currentNotice.title.includes('HOJE') || currentNotice.tipo === 'hoje';
  const isQuitada = currentNotice.title.includes('QUITADA') || currentNotice.tipo === 'parcela_quitada';

  const badgeColor = isVencida
    ? 'border-red-500/40 shadow-red-950/40 bg-gradient-to-r from-red-950/40 to-[#12111d]'
    : isPaga
    ? 'border-emerald-500/40 shadow-emerald-950/40 bg-gradient-to-r from-emerald-950/40 to-[#12111d]'
    : isHoje
    ? 'border-amber-500/40 shadow-amber-950/40 bg-gradient-to-r from-amber-950/40 to-[#12111d]'
    : isQuitada
    ? 'border-purple-500/40 shadow-purple-950/40 bg-gradient-to-r from-purple-950/40 to-[#12111d]'
    : 'border-blue-500/40 shadow-blue-950/40 bg-gradient-to-r from-blue-950/40 to-[#12111d]';

  const iconElement = isVencida ? (
    <div className="w-8 h-8 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 flex items-center justify-center shrink-0">
      <AlertTriangle className="w-4 h-4" />
    </div>
  ) : isPaga ? (
    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
      <CheckCircle2 className="w-4 h-4" />
    </div>
  ) : isHoje ? (
    <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
      <Clock className="w-4 h-4" />
    </div>
  ) : isQuitada ? (
    <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0">
      <PartyPopper className="w-4 h-4" />
    </div>
  ) : (
    <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
      <Bell className="w-4 h-4" />
    </div>
  );

  return (
    <div
      role="alert"
      aria-live="assertive"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`fixed top-3 left-1/2 -translate-x-1/2 z-[99999] w-[calc(100%-1.25rem)] max-w-md transition-all duration-300 ease-out select-none ${
        isVisible
          ? 'translate-y-0 opacity-100 scale-100'
          : '-translate-y-8 opacity-0 scale-95 pointer-events-none'
      }`}
    >
      <div
        onClick={handleBannerClick}
        className={`relative overflow-hidden rounded-2xl border backdrop-blur-2xl shadow-2xl p-3.5 flex flex-col gap-2 cursor-pointer active:scale-[0.98] transition-all ${badgeColor}`}
      >
        {/* Barra superior com marca e tempo estilo heads-up iOS / Android */}
        <div className="flex items-center justify-between text-[11px] text-neutral-400">
          <div className="flex items-center gap-1.5 font-medium tracking-wide">
            <span className="w-4 h-4 rounded-md bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300 text-[10px]">
              <Shield className="w-2.5 h-2.5" />
            </span>
            <span className="font-semibold text-neutral-200 uppercase tracking-wider text-[10px]">
              Sutello Financeiro
            </span>
            <span className="text-neutral-500">•</span>
            <span className="text-[10px] text-neutral-400">agora</span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDismiss();
            }}
            className="w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-neutral-300 flex items-center justify-center transition-colors"
            title="Fechar notificação"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* Conteúdo principal com ícone, título destacado e mensagem sem corte */}
        <div className="flex items-start gap-3">
          {iconElement}
          <div className="flex-1 min-w-0 pr-1">
            <h4 className="text-xs font-bold text-white tracking-tight leading-snug line-clamp-2">
              {currentNotice.title}
            </h4>
            <p className="text-[11px] text-neutral-300 leading-snug mt-0.5 break-words">
              {currentNotice.body}
            </p>
          </div>
          {currentNotice.contaId && onSelectConta && (
            <div className="self-center text-neutral-400 shrink-0">
              <ChevronRight className="w-4 h-4" />
            </div>
          )}
        </div>

        {/* Imagem rica expandida na notificação (se houver) */}
        {currentNotice.imagemUrl && (
          <div className="rounded-xl overflow-hidden border border-white/10 max-h-36 bg-black/40">
            <img
              src={currentNotice.imagemUrl}
              alt="Anexo da notificação"
              className="w-full h-full object-cover max-h-36"
            />
          </div>
        )}

        {/* Botões de ação na notificação (se houver link ou texto de botão) */}
        {(currentNotice.linkUrl || currentNotice.botaoTexto) && (
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/10">
            {currentNotice.linkUrl ? (
              <a
                href={currentNotice.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDismiss();
                }}
                className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] flex items-center gap-1 shadow"
              >
                <span>{currentNotice.botaoTexto || 'Acessar Link'}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleBannerClick();
                }}
                className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] flex items-center gap-1 shadow"
              >
                <span>{currentNotice.botaoTexto}</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Indicador de dispensar deslizando para cima */}
        <div className="w-8 h-1 bg-white/15 rounded-full mx-auto mt-0.5" />
      </div>
    </div>
  );
};

