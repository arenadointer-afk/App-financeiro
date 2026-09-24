import React, { useState, useEffect } from 'react';
import {
  X,
  Bell,
  AlertTriangle,
  Clock,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  Check,
  Smartphone,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp,
  Settings2,
  PlusCircle,
  PartyPopper,
  Info
} from 'lucide-react';
import { NotificacaoAlerta } from '../types';
import {
  getNotificationPreferences,
  saveNotificationPreferences,
  getDeviceNotificationPermission,
  requestDeviceNotificationPermission,
  triggerTestNotification,
  NotificationPreferences
} from '../lib/deviceNotifications';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notificacoes: NotificacaoAlerta[];
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
  onSelectConta?: (contaId: string | number) => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  notificacoes,
  onDismiss,
  onDismissAll,
  onSelectConta,
}) => {
  const [devicePermission, setDevicePermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [prefs, setPrefs] = useState<NotificationPreferences>(getNotificationPreferences());
  const [showConfig, setShowConfig] = useState(false);
  const [testingNotification, setTestingNotification] = useState(false);
  const [testResultMsg, setTestResultMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDevicePermission(getDeviceNotificationPermission());
      setPrefs(getNotificationPreferences());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRequestPermission = async () => {
    const res = await requestDeviceNotificationPermission();
    setDevicePermission(res);
    setPrefs(getNotificationPreferences());
    if (res === 'granted') {
      setTestResultMsg('Permissão concedida! Enviando notificação de boas-vindas...');
      await triggerTestNotification();
      setTimeout(() => setTestResultMsg(null), 4000);
    }
  };

  const handleTestNotification = async () => {
    setTestingNotification(true);
    setTestResultMsg(null);
    try {
      const ok = await triggerTestNotification();
      if (ok) {
        setTestResultMsg('Notificação enviada com sucesso para o celular!');
      } else {
        setTestResultMsg('Não foi possível enviar. Verifique se o navegador ou sistema bloqueou.');
      }
    } catch {
      setTestResultMsg('Erro ao disparar notificação.');
    } finally {
      setTestingNotification(false);
      setTimeout(() => setTestResultMsg(null), 4000);
    }
  };

  const togglePref = (key: keyof NotificationPreferences) => {
    const updated = saveNotificationPreferences({ [key]: !prefs[key] });
    setPrefs(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-lg bg-[#0f0f1c] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do Modal */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white font-display">
                  Central de Notificações
                </h3>
                {notificacoes.length > 0 && (
                  <span className="px-2 py-0.5 text-[11px] font-bold bg-purple-600/30 text-purple-300 border border-purple-500/40 rounded-full">
                    {notificacoes.length}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-400">
                Alertas no celular e histórico do aplicativo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {notificacoes.length > 0 && (
              <button
                type="button"
                onClick={onDismissAll}
                className="px-2.5 py-1.5 text-xs text-neutral-400 hover:text-white hover:bg-white/10 active:scale-95 rounded-lg transition-all flex items-center gap-1 touch-manipulation select-none"
                title="Limpar todas as notificações"
              >
                <Check className="w-3.5 h-3.5 text-purple-400" />
                <span>Marcar lidas</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white hover:bg-white/10 active:scale-90 rounded-lg transition-colors touch-manipulation"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Card de Configuração de Notificações no Celular */}
        <div className="p-3.5 bg-gradient-to-r from-purple-950/40 via-[#161628] to-purple-950/20 border-b border-white/10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0 mt-0.5">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    Notificações no Celular
                  </h4>
                  {devicePermission === 'granted' ? (
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Ativadas
                    </span>
                  ) : devicePermission === 'denied' ? (
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-red-500/20 text-red-300 border border-red-500/30 rounded-full">
                      Bloqueadas
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
                      Pendente
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-300 mt-0.5 leading-snug">
                  Avisos quando contas vencerem, parcelas acabarem ou novas contas forem adicionadas.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {devicePermission === 'granted' ? (
                <button
                  type="button"
                  onClick={handleTestNotification}
                  disabled={testingNotification}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-lg border border-white/10 transition-all flex items-center gap-1 touch-manipulation"
                  title="Disparar notificação de teste agora"
                >
                  <Bell className="w-3 h-3 text-purple-400" />
                  <span>{testingNotification ? 'Enviando...' : 'Testar'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestPermission}
                  className="px-3 py-1 text-[11px] font-bold bg-purple-600 hover:bg-purple-500 active:scale-95 text-white rounded-lg shadow-md transition-all flex items-center gap-1 touch-manipulation"
                >
                  <Smartphone className="w-3 h-3" />
                  <span>Ativar</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowConfig(!showConfig)}
                className="p-1.5 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Opções de Notificação"
              >
                {showConfig ? <ChevronUp className="w-4 h-4" /> : <Settings2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Feedback de Teste */}
          {testResultMsg && (
            <div className="mt-2 text-[11px] font-medium text-purple-300 bg-purple-950/60 border border-purple-500/30 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 animate-fade-in">
              <Info className="w-3.5 h-3.5 shrink-0 text-purple-400" />
              <span>{testResultMsg}</span>
            </div>
          )}

          {/* Seção expansível de configurações das notificações no celular */}
          {showConfig && (
            <div className="mt-3 pt-3 border-t border-white/10 space-y-2 animate-fade-in text-xs">
              <div className="font-semibold text-neutral-300 mb-1 text-[11px]">
                Escolha quando receber avisos no celular:
              </div>

              <label className="flex items-center justify-between p-2 rounded-lg bg-black/30 hover:bg-black/40 cursor-pointer transition-colors">
                <span className="text-neutral-200">Contas vencidas (Atrasadas)</span>
                <input
                  type="checkbox"
                  checked={prefs.contasVencidas}
                  onChange={() => togglePref('contasVencidas')}
                  className="accent-purple-600 w-4 h-4 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-lg bg-black/30 hover:bg-black/40 cursor-pointer transition-colors">
                <span className="text-neutral-200">Parcelas acabando ou quitadas</span>
                <input
                  type="checkbox"
                  checked={prefs.parcelasQuitadas}
                  onChange={() => togglePref('parcelasQuitadas')}
                  className="accent-purple-600 w-4 h-4 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-lg bg-black/30 hover:bg-black/40 cursor-pointer transition-colors">
                <span className="text-neutral-200">Novas contas adicionadas</span>
                <input
                  type="checkbox"
                  checked={prefs.novasContas}
                  onChange={() => togglePref('novasContas')}
                  className="accent-purple-600 w-4 h-4 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-lg bg-black/30 hover:bg-black/40 cursor-pointer transition-colors">
                <div className="flex items-center gap-1.5 text-neutral-200">
                  {prefs.somVibracao ? <Volume2 className="w-3.5 h-3.5 text-purple-400" /> : <VolumeX className="w-3.5 h-3.5 text-neutral-500" />}
                  <span>Som e Vibração no celular</span>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.somVibracao}
                  onChange={() => togglePref('somVibracao')}
                  className="accent-purple-600 w-4 h-4 rounded cursor-pointer"
                />
              </label>

              <div className="p-2 rounded-lg bg-white/[0.03] text-[10px] text-neutral-400 leading-relaxed border border-white/5">
                💡 <strong className="text-neutral-300">Dica iPhone / iOS:</strong> Adicione o app à Tela de Início pelo Safari (<span className="text-purple-300 font-medium">Compartilhar → Adicionar à Tela de Início</span>) para receber notificações na tela de bloqueio do iOS.
              </div>
            </div>
          )}
        </div>

        {/* Lista de Notificações Recentes */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar">
          {notificacoes.length === 0 ? (
            <div className="py-12 px-4 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3 shadow-inner">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-bold text-white font-display mb-1">
                Tudo em dia!
              </h4>
              <p className="text-xs text-neutral-400 max-w-[260px] leading-relaxed">
                Nenhuma conta atrasada, vencendo hoje ou pendência de atenção no momento.
              </p>
            </div>
          ) : (
            notificacoes.map((item) => {
              const isAtrasada = item.tipo === 'atrasada';
              const isHoje = item.tipo === 'hoje';
              const isBreve = item.tipo === 'breve';
              const isParcelaFim = item.tipo === 'parcela_fim' || item.tipo === 'parcela_penultima';
              const isParcelaQuitada = item.tipo === 'parcela_quitada';
              const isNovaConta = item.tipo === 'nova_conta';

              const cardBorder = isAtrasada
                ? 'border-red-500/30 bg-red-950/20 hover:border-red-500/50'
                : isHoje
                ? 'border-amber-500/30 bg-amber-950/20 hover:border-amber-500/50'
                : isParcelaQuitada
                ? 'border-emerald-500/30 bg-emerald-950/20 hover:border-emerald-500/50'
                : isParcelaFim
                ? 'border-purple-500/30 bg-purple-950/20 hover:border-purple-500/50'
                : isNovaConta
                ? 'border-cyan-500/30 bg-cyan-950/20 hover:border-cyan-500/50'
                : 'border-blue-500/30 bg-blue-950/20 hover:border-blue-500/50';

              const iconBadge = isAtrasada ? (
                <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              ) : isHoje ? (
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
              ) : isParcelaQuitada ? (
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <PartyPopper className="w-4 h-4" />
                </div>
              ) : isParcelaFim ? (
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
              ) : isNovaConta ? (
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                  <PlusCircle className="w-4 h-4" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
              );

              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-xl border transition-all relative flex flex-col gap-2 ${cardBorder}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      {iconBadge}
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-xs font-bold text-white leading-tight">
                            {item.titulo}
                          </h4>
                          {item.urgencia === 'alta' && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-300 uppercase tracking-wider">
                              Urgente
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-neutral-300 mt-1 leading-snug">
                          {item.mensagem}
                        </p>
                      </div>
                    </div>

                    {/* Botão de dispensar / visto rápido */}
                    <button
                      type="button"
                      onClick={() => onDismiss(item.id)}
                      className="p-1.5 text-neutral-400 hover:text-white hover:bg-white/10 active:scale-90 rounded-lg transition-colors touch-manipulation shrink-0"
                      title="Dispensar notificação"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Ações adicionais */}
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/5">
                    {item.contaId && onSelectConta && (
                      <button
                        type="button"
                        onClick={() => {
                          onDismiss(item.id);
                          onSelectConta(item.contaId!);
                          onClose();
                        }}
                        className="px-2.5 py-1 bg-white/10 hover:bg-white/20 active:scale-95 text-white text-[11px] font-medium rounded-lg transition-all flex items-center gap-1 touch-manipulation"
                      >
                        <span>Ver Conta</span>
                        <ExternalLink className="w-3 h-3 text-neutral-400" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onDismiss(item.id)}
                      className="px-2.5 py-1 bg-purple-600/30 hover:bg-purple-600/50 active:scale-95 text-purple-200 text-[11px] font-semibold rounded-lg transition-all flex items-center gap-1 touch-manipulation"
                    >
                      <Check className="w-3 h-3" />
                      <span>Marcar como vista</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé Informativo */}
        <div className="p-3 border-t border-white/10 bg-white/[0.01] flex items-center justify-between text-[11px] text-neutral-400">
          <span>Notificações lidas saem da lista ao tocar no check.</span>
          <button
            type="button"
            onClick={onClose}
            className="text-purple-400 hover:text-purple-300 font-medium active:scale-95 touch-manipulation"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
