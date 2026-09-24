import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
(window as any).__SUTELLO_LOADED__ = true;

// Registro seguro do Service Worker para abertura sem internet e funcionamento offline no celular
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        // Verifica atualizações e recarrega cache suavemente
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('Nova versão do Sutello Financeiro disponível.');
              }
            });
          }
        });
      })
      .catch((err) => {
        console.warn('Registro de Service Worker ignorado:', err);
      });
  });
}

