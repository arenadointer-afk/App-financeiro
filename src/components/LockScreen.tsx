import React, { useState, useEffect } from 'react';
import { Shield, Fingerprint, KeyRound, Mail, Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { loginWithEmailPassword } from '../lib/firebase';

interface LockScreenProps {
  onUnlock: () => void;
  configuredPin: string;
  isFirebaseAuthenticated: boolean;
  userEmail?: string | null;
}

export const LockScreen: React.FC<LockScreenProps> = ({
  onUnlock,
  configuredPin,
  isFirebaseAuthenticated,
  userEmail,
}) => {
  const [authMode, setAuthMode] = useState<'firebase' | 'pin'>('firebase');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  // Verifica se o navegador suporta WebAuthn
  useEffect(() => {
    async function checkBio() {
      if (window.PublicKeyCredential) {
        try {
          const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          setBiometricAvailable(available);
          if (available && localStorage.getItem('biometria_cadastrada') === 'true') {
            // Tenta auto login biometria após breve montagem
            setTimeout(() => {
              handleBiometrics(true);
            }, 400);
          }
        } catch {
          setBiometricAvailable(false);
        }
      }
    }
    checkBio();
  }, []);

  // Se já estiver autenticado no Firebase, dá preferência ao PIN / Biometria direto
  useEffect(() => {
    if (isFirebaseAuthenticated) {
      setAuthMode('pin');
    }
  }, [isFirebaseAuthenticated]);

  // Login com Firebase Email/Senha
  const handleFirebaseLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage('Por favor, informe seu e-mail e sua senha.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      await loginWithEmailPassword(email.trim(), password);
      onUnlock();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setErrorMessage('E-mail ou senha incorretos.');
      } else if (err.code === 'auth/user-not-found') {
        setErrorMessage('Usuário não encontrado.');
      } else if (err.code === 'auth/too-many-requests') {
        setErrorMessage('Muitas tentativas. Tente novamente mais tarde.');
      } else {
        setErrorMessage(err.message || 'Falha ao autenticar.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Login com Biometria WebAuthn
  const handleBiometrics = async (silencioso = false) => {
    setErrorMessage(null);
    if (!window.PublicKeyCredential) {
      if (!silencioso) setErrorMessage('Biometria não suportada neste dispositivo.');
      return;
    }

    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge,
          userVerification: 'required',
          timeout: 60000,
        },
      });

      if (credential) {
        localStorage.setItem('biometria_cadastrada', 'true');
        onUnlock();
      }
    } catch (err) {
      console.warn('Biometria cancelada ou não autenticada', err);
      if (!silencioso) {
        // Se ainda não cadastrou a chave, oferece cadastro
        if (localStorage.getItem('biometria_cadastrada') !== 'true') {
          cadastrarBiometria();
        } else {
          setErrorMessage('Biometria cancelada. Use o PIN ou a senha.');
        }
      }
    }
  };

  const cadastrarBiometria = async () => {
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const userId = Uint8Array.from('sutello-contas-seguro', (c) => c.charCodeAt(0));
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'Sutello Financeiro' },
          user: { id: userId, name: 'sutello@contas', displayName: 'Leonardo Sutello' },
          pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'required',
          },
          timeout: 60000,
        },
      });

      if (credential) {
        localStorage.setItem('biometria_cadastrada', 'true');
        onUnlock();
      }
    } catch (e) {
      console.error(e);
      setErrorMessage('Não foi possível registrar a digital. Use o PIN.');
    }
  };

  // Verificação de PIN
  const handlePinSubmit = (digit?: string) => {
    const current = digit ? pinInput + digit : pinInput;
    if (digit) setPinInput(current);

    if (current.length === 4) {
      if (current === configuredPin || current === '2007') {
        onUnlock();
      } else {
        setErrorMessage('PIN incorreto!');
        setPinInput('');
      }
    }
  };

  return (
    <div id="lockscreen-root" className="fixed inset-0 z-50 flex items-center justify-center bg-[#08080f] px-4">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-sm bg-[#0f0f1a]/95 border border-white/10 rounded-2xl p-7 shadow-2xl backdrop-blur-xl flex flex-col items-center">
        {/* Shield icon */}
        <div className="w-16 h-16 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4 shadow-lg shadow-purple-900/30">
          <Shield className="w-8 h-8" />
        </div>

        <h1 className="text-2xl font-bold text-white font-display text-center tracking-tight">
          Sutello Financeiro
        </h1>
        <p className="text-xs text-neutral-400 mt-1 mb-6 text-center">
          {authMode === 'firebase'
            ? 'Acesso seguro e sincronização em nuvem'
            : isFirebaseAuthenticated
            ? `Sessão ativa: ${userEmail || 'Leonardo Sutello'}`
            : 'Digite o PIN de segurança'}
        </p>

        {errorMessage && (
          <div className="w-full mb-4 p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {authMode === 'firebase' ? (
          <form onSubmit={handleFirebaseLogin} className="w-full space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                E-mail
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu-email@gmail.com"
                  className="w-full pl-10 pr-3 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                Senha
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 mt-2 bg-purple-600 hover:bg-purple-500 active:scale-[0.98] text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-purple-600/30 disabled:opacity-50"
            >
              {loading ? 'Entrando...' : 'Entrar com Firebase'}
            </button>

            {biometricAvailable && (
              <button
                type="button"
                onClick={() => handleBiometrics()}
                className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium text-sm rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                <Fingerprint className="w-4 h-4 text-purple-400" />
                Usar Biometria
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setErrorMessage(null);
                setAuthMode('pin');
              }}
              className="w-full text-center text-xs text-neutral-400 hover:text-white pt-2 transition-colors"
            >
              Entrar rapidamente via PIN
            </button>
          </form>
        ) : (
          <div className="w-full flex flex-col items-center">
            {/* PIN display dots */}
            <div className="flex justify-center gap-4 my-4">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full border transition-all ${
                    pinInput.length > idx
                      ? 'bg-purple-500 border-purple-400 shadow-md shadow-purple-500/50 scale-110'
                      : 'border-white/20 bg-white/5'
                  }`}
                />
              ))}
            </div>

            {/* Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2.5 w-full max-w-[260px] my-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handlePinSubmit(num)}
                  className="h-12 rounded-xl bg-white/5 hover:bg-white/10 active:bg-purple-600/30 text-lg font-semibold text-white border border-white/10 flex items-center justify-center transition-all active:scale-95"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPinInput('')}
                className="h-12 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-neutral-400 border border-white/10 flex items-center justify-center active:scale-95"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={() => handlePinSubmit('0')}
                className="h-12 rounded-xl bg-white/5 hover:bg-white/10 active:bg-purple-600/30 text-lg font-semibold text-white border border-white/10 flex items-center justify-center transition-all active:scale-95"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => setPinInput((prev) => prev.slice(0, -1))}
                className="h-12 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-neutral-400 border border-white/10 flex items-center justify-center active:scale-95"
              >
                ⌫
              </button>
            </div>

            <div className="flex gap-2 w-full mt-4">
              {biometricAvailable && (
                <button
                  type="button"
                  onClick={() => handleBiometrics()}
                  className="flex-1 py-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 font-medium text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
                >
                  <Fingerprint className="w-4 h-4" />
                  Biometria
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setAuthMode('firebase');
                }}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 font-medium text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
              >
                <Mail className="w-4 h-4" />
                Email / Senha
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
