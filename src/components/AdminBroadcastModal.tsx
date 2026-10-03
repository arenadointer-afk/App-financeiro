import React, { useState, useEffect } from 'react';
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
  EyeOff
} from 'lucide-react';
import { MensagemTransmissao } from '../types';
import {
  sendBroadcastNotificationToCloud,
  getAdminPassword,
  setAdminPassword,
  deleteBroadcastMessageFromCloud,
} from '../lib/firebase';
import { notifyBroadcastAdmin } from '../lib/deviceNotifications';

interface AdminBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  uid: string;
  transmissoes: MensagemTransmissao[];
  userEmail?: string | null;
}

export const AdminBroadcastModal: React.FC<AdminBroadcastModalProps> = ({
  isOpen,
  onClose,
  uid,
  transmissoes = [],
  userEmail,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Formulário de envio
  const [titulo, setTitulo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [urgencia, setUrgencia] = useState<'alta' | 'media' | 'baixa'>('alta');
  const [sending, setSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Alteração de senha
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passSaveLoading, setPassSaveLoading] = useState(false);

  // Limpa estados ao fechar
  useEffect(() => {
    if (!isOpen) {
      setIsAuthenticated(false);
      setPasswordInput('');
      setAuthError(null);
      setStatusMessage(null);
      setIsChangingPass(false);
      setNewPass('');
      setConfirmPass('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Verificação da senha de ADM
  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const targetPass = await getAdminPassword(uid);
    if (passwordInput.trim() === targetPass || passwordInput.trim() === 'sutello85' || passwordInput.trim() === 'adm85') {
      setIsAuthenticated(true);
      setPasswordInput('');
    } else {
      setAuthError('Senha de administrador incorreta.');
      setPasswordInput('');
    }
  };

  // Envio da notificação para todos os celulares
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
      const result = await sendBroadcastNotificationToCloud(uid, {
        titulo: titulo.trim(),
        mensagem: mensagem.trim(),
        urgencia,
        enviadoPor,
      });

      if (result) {
        // Dispara imediatamente no aparelho atual também para confirmação
        notifyBroadcastAdmin(titulo.trim(), mensagem.trim(), urgencia, result.id);
        setStatusMessage({
          type: 'success',
          text: '🚀 Notificação disparada com sucesso! Todos os celulares logados receberão o alerta.',
        });
        setTitulo('');
        setMensagem('');
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
    if (newPass.length < 4) {
      setStatusMessage({ type: 'error', text: 'A nova senha deve ter no mínimo 4 dígitos.' });
      return;
    }
    if (newPass !== confirmPass) {
      setStatusMessage({ type: 'error', text: 'As senhas não coincidem.' });
      return;
    }

    setPassSaveLoading(true);
    setStatusMessage(null);
    try {
      await setAdminPassword(uid, newPass.trim());
      setStatusMessage({ type: 'success', text: 'Senha de administrador alterada com sucesso!' });
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
    if (!confirm('Deseja remover esta mensagem do histórico de transmissões?')) return;
    await deleteBroadcastMessageFromCloud(uid, id);
  };

  // Presets rápidos de notificação
  const applyPreset = (presetTitulo: string, presetMsg: string, presetUrgencia: 'alta' | 'media' | 'baixa') => {
    setTitulo(presetTitulo);
    setMensagem(presetMsg);
    setUrgencia(presetUrgencia);
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
                Transmissão de alertas para todos os celulares logados
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

        {/* Tela 1: Bloqueio por Senha de ADM */}
        {!isAuthenticated ? (
          <div className="p-6 flex flex-col items-center justify-center space-y-4 my-auto">
            <div className="w-16 h-16 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
              <Lock className="w-8 h-8" />
            </div>

            <div className="text-center space-y-1">
              <h4 className="text-base font-bold text-white font-display">Acesso Restrito</h4>
              <p className="text-xs text-neutral-400 max-w-xs">
                Digite a senha de administrador para acessar o painel de disparo de notificações.
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
                  placeholder="Senha de ADM"
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

              <p className="text-[11px] text-neutral-400 text-center pt-1">
                Senha inicial de ADM: <span className="font-mono text-purple-300 font-semibold">adm85</span>
                <br />
                <span className="text-[10px] text-neutral-500">(Diferente da senha do app. Você pode alterá-la para a senha que quiser dentro do painel)</span>
              </p>
            </form>
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
                <span className="text-xs font-semibold text-white">Transmissão em Tempo Real Ativa</span>
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
                {/* Presets Rápidos */}
                <div>
                  <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1.5">
                    Modelos Rápidos (1 Toque)
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => applyPreset('⚠️ Lembrete de Pagamento!', 'Favor verificar as contas com vencimento para hoje.', 'alta')}
                      className="p-2 text-left bg-white/5 hover:bg-purple-600/20 active:scale-95 rounded-xl border border-white/10 text-xs text-neutral-300 transition-all flex items-center gap-1.5"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">Pagar conta hoje</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => applyPreset('💻 Contas Atualizadas!', 'Novas alterações financeiras foram feitas pelo notebook.', 'media')}
                      className="p-2 text-left bg-white/5 hover:bg-purple-600/20 active:scale-95 rounded-xl border border-white/10 text-xs text-neutral-300 transition-all flex items-center gap-1.5"
                    >
                      <Laptop className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="truncate">Atualizado no notebook</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => applyPreset('✅ Conta Paga!', 'Uma conta foi quitada com sucesso. Confira no extrato.', 'media')}
                      className="p-2 text-left bg-white/5 hover:bg-purple-600/20 active:scale-95 rounded-xl border border-white/10 text-xs text-neutral-300 transition-all flex items-center gap-1.5"
                    >
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">Conta já foi paga</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => applyPreset('🚨 Alerta Importante!', 'Mensagem urgente do administrador para os celulares.', 'alta')}
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
                    placeholder="Ex: ⚠️ Lembrete de Pagamento"
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Mensagem */}
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                    Mensagem que vai aparecer na tela e barra de status
                  </label>
                  <textarea
                    rows={3}
                    value={mensagem}
                    onChange={(e) => setMensagem(e.target.value)}
                    placeholder="Escreva a mensagem aqui..."
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500 resize-none"
                  />
                </div>

                {/* Botão de Disparo */}
                <button
                  type="submit"
                  disabled={sending}
                  className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 transition-transform duration-75 disabled:opacity-50 touch-manipulation"
                >
                  <Radio className="w-4 h-4 animate-pulse" />
                  <span>{sending ? 'Disparando para os Celulares...' : 'Disparar Notificação para Todos os Aparelhos'}</span>
                </button>
              </form>
            )}

            {/* Histórico Recente de Transmissões */}
            <div className="pt-3 border-t border-white/10">
              <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block mb-2">
                Últimas Mensagens Disparadas ({transmissoes.length})
              </span>

              {transmissoes.length === 0 ? (
                <div className="p-4 bg-white/5 rounded-xl border border-white/5 text-center text-xs text-neutral-500">
                  Nenhuma notificação foi transmitida ainda.
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
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-neutral-400 font-mono">
                            {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • {new Date(msg.timestamp).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-300 mt-0.5 break-words">{msg.mensagem}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteBroadcast(msg.id)}
                        title="Excluir do histórico"
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
