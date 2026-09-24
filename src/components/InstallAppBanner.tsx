import React, { useState, useEffect } from 'react';
import { Download, X, Check, Smartphone, Share, PlusSquare } from 'lucide-react';

interface InstallAppBannerProps {
  onOpenHelp?: () => void;
}

export const InstallAppBanner: React.FC<InstallAppBannerProps> = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Detectar se já está rodando como PWA (standalone)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Detectar iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isApple = /iphone|ipad|ipod/.test(ua);
    setIsIOS(isApple);

    // Capturar evento de instalação do Chrome / Android
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSGuide(true);
    } else {
      setShowIOSGuide(true);
    }
  };

  if (isInstalled || dismissed) return null;

  return (
    <>
      <div className="mx-4 mt-3 bg-gradient-to-r from-purple-950/60 via-[#16132b] to-purple-950/40 border border-purple-500/30 rounded-2xl p-3 flex items-center justify-between shadow-lg shadow-purple-950/30">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-black border border-white/10 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
            <img src="./icon-192.png" alt="Sutello" className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white truncate flex items-center gap-1.5">
              Instalar Sutello no Celular
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-purple-500/30 text-purple-300 font-normal">PWA</span>
            </h4>
            <p className="text-[11px] text-neutral-400 truncate">Adicione à tela inicial com 1 toque</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleInstallClick}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-purple-600/30 active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            Instalar
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            title="Fechar aviso"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Modal de Instruções para iOS / Navegadores sem prompt direto */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-[#13131f] border border-purple-500/30 rounded-3xl p-5 max-w-sm w-full space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-purple-600/20 text-purple-300 mx-auto flex items-center justify-center border border-purple-500/30">
              <Smartphone className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white font-display">Como Instalar no Celular</h3>
              <p className="text-xs text-neutral-400 mt-1">Siga os 2 passos rápidos no seu navegador:</p>
            </div>

            <div className="space-y-2.5 text-left text-xs bg-[#1a1a2b] p-3.5 rounded-2xl border border-white/5">
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-purple-600/20 text-purple-400 flex items-center justify-center shrink-0 font-bold text-[11px]">1</div>
                <p className="text-neutral-300">
                  {isIOS ? (
                    <>Toque no botão de <strong>Compartilhar</strong> (<Share className="w-3.5 h-3.5 inline text-blue-400" />) na barra inferior do Safari.</>
                  ) : (
                    <>Toque nos <strong>3 pontinhos (⋮)</strong> no topo do Chrome ou navegador.</>
                  )}
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-purple-600/20 text-purple-400 flex items-center justify-center shrink-0 font-bold text-[11px]">2</div>
                <p className="text-neutral-300">
                  {isIOS ? (
                    <>Role para baixo e selecione <strong>Adicionar à Tela de Início</strong> (<PlusSquare className="w-3.5 h-3.5 inline text-neutral-400" />).</>
                  ) : (
                    <>Selecione <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.</>
                  )}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all shadow-md"
            >
              Entendido!
            </button>
          </div>
        </div>
      )}
    </>
  );
};
