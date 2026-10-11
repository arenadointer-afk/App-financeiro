import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from './firebase';
import { isNativeApkPlatform } from './deviceNotifications';

export interface AppVersionInfo {
  version: string;
  buildId: string;
  title: string;
  notes: string;
  liveUrl: string;
  updatedAt: number;
}

export const DEFAULT_VERCEL_LIVE_URL = 'https://app-financeiro-beta-blue.vercel.app';

export const CURRENT_APP_VERSION: AppVersionInfo = {
  version: '3.8.3',
  buildId: '20261011-ota-v383',
  title: 'Versão Oficial v3.8.3',
  notes:
    'Central de Backup (.JSON), Restauração, Downloads (.ZIP) e Botão Atualizar App movidos para o Painel ADM (abaixo do disparo de mensagens).',
  liveUrl: DEFAULT_VERCEL_LIVE_URL,
  updatedAt: 1791695000000,
};

const INSTALLED_VERSION_KEY = 'sutello_installed_app_version';
const INSTALLED_BUILD_KEY = 'sutello_installed_build_id';
const OTA_LIVE_URL_KEY = 'sutello_ota_live_url';
const VERCEL_SERVER_URL_KEY = 'sutello_vercel_server_url';

/**
 * Normaliza e valida uma URL pública de atualização (ex: https://app-financeiro-beta-blue.vercel.app)
 */
export function normalizePublicLiveUrl(url?: string | null): string {
  if (!url) return '';
  let clean = url.trim();
  if (!clean) return '';
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = `https://${clean}`;
  }
  clean = clean.replace(/\/+$/, '');
  const lower = clean.toLowerCase();
  if (
    !lower.startsWith('https://') ||
    lower.includes('.run.app') ||
    lower.includes('localhost') ||
    lower.includes('127.0.0.1')
  ) {
    return '';
  }
  return clean;
}

/**
 * Verifica se uma URL é um domínio público válido (ex: Vercel) e NÃO um link temporário do AI Studio (.run.app)
 */
export function isValidPublicLiveUrl(url?: string | null): boolean {
  return normalizePublicLiveUrl(url).length > 0;
}

/**
 * Obtém a URL pública da Vercel salva na conta/aparelho ou usa o domínio oficial padrão
 */
export function getSavedVercelLiveUrl(): string {
  if (typeof window === 'undefined') return DEFAULT_VERCEL_LIVE_URL;
  try {
    const origin = normalizePublicLiveUrl(window.location.origin);
    if (origin) {
      localStorage.setItem(VERCEL_SERVER_URL_KEY, origin);
      return origin;
    }
    const saved = localStorage.getItem(VERCEL_SERVER_URL_KEY) || '';
    const validSaved = normalizePublicLiveUrl(saved);
    return validSaved || DEFAULT_VERCEL_LIVE_URL;
  } catch {
    return DEFAULT_VERCEL_LIVE_URL;
  }
}

/**
 * Salva a URL pública da Vercel vinculada à CONTA do usuário no Firebase (dados_financeiros/{uid}, usuarios/{uid} e versao_app)
 * para que todos os celulares conectados na mesma conta recebam automaticamente sem precisar digitar de novo!
 */
export async function saveVercelLiveUrl(url: string): Promise<string> {
  const normalized = normalizePublicLiveUrl(url);
  if (typeof window !== 'undefined') {
    try {
      if (normalized) {
        localStorage.setItem(VERCEL_SERVER_URL_KEY, normalized);
      } else {
        localStorage.removeItem(VERCEL_SERVER_URL_KEY);
      }
    } catch {}
  }

  if (db && normalized) {
    const uid = auth?.currentUser?.uid || (typeof window !== 'undefined' ? localStorage.getItem('sutello_last_uid') : '') || '';
    try {
      const ref = doc(db, 'dados_caixinhas_agenda', 'versao_app');
      await setDoc(
        ref,
        {
          liveUrl: normalized,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    } catch {}

    // Também vincula diretamente ao documento da conta logada para sincronizar entre todos os aparelhos da conta
    if (uid) {
      try {
        await setDoc(
          doc(db, 'dados_financeiros', uid),
          {
            otaLiveUrl: normalized,
            otaVersion: CURRENT_APP_VERSION.version,
          },
          { merge: true }
        );
      } catch {}
      try {
        await setDoc(
          doc(db, 'usuarios', uid),
          {
            otaLiveUrl: normalized,
          },
          { merge: true }
        );
      } catch {}
    }
  }

  return normalized;
}

/**
 * Compara duas versões semânticas (ex: "3.9.0" > "3.8.0" retorna 1)
 */
export function compareSemver(v1: string, v2: string): number {
  const clean1 = String(v1 || '0.0.0').replace(/[^0-9.]/g, '').split('.').map(Number);
  const clean2 = String(v2 || '0.0.0').replace(/[^0-9.]/g, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const a = clean1[i] || 0;
    const b = clean2[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

/**
 * Retorna a versão atualmente instalada/aplicada neste aparelho
 */
export function getInstalledAppVersion(): { version: string; buildId: string; codeVersion: string } {
  if (typeof window === 'undefined') {
    return {
      version: CURRENT_APP_VERSION.version,
      buildId: CURRENT_APP_VERSION.buildId,
      codeVersion: CURRENT_APP_VERSION.version,
    };
  }
  try {
    localStorage.removeItem(OTA_LIVE_URL_KEY);

    const savedVer = localStorage.getItem(INSTALLED_VERSION_KEY);
    const savedBuild = localStorage.getItem(INSTALLED_BUILD_KEY);
    // Se o código-fonte carregado for mais novo que o salvo no localStorage, sincroniza
    if (!savedVer || compareSemver(CURRENT_APP_VERSION.version, savedVer) >= 0) {
      localStorage.setItem(INSTALLED_VERSION_KEY, CURRENT_APP_VERSION.version);
      if (!savedBuild || compareSemver(CURRENT_APP_VERSION.version, savedVer) > 0) {
        localStorage.setItem(INSTALLED_BUILD_KEY, CURRENT_APP_VERSION.buildId);
      }
      return {
        version: CURRENT_APP_VERSION.version,
        buildId: localStorage.getItem(INSTALLED_BUILD_KEY) || CURRENT_APP_VERSION.buildId,
        codeVersion: CURRENT_APP_VERSION.version,
      };
    }
    return {
      version: savedVer,
      buildId: savedBuild || CURRENT_APP_VERSION.buildId,
      codeVersion: CURRENT_APP_VERSION.version,
    };
  } catch {
    return {
      version: CURRENT_APP_VERSION.version,
      buildId: CURRENT_APP_VERSION.buildId,
      codeVersion: CURRENT_APP_VERSION.version,
    };
  }
}

/**
 * Verifica se há uma versão mais nova na nuvem ou se o APK ainda está rodando o código antigo local (localhost) quando a Vercel tem código mais novo
 */
export function isRemoteVersionNewer(remote: AppVersionInfo | null): boolean {
  if (!remote || !remote.version) return false;
  const installed = getInstalledAppVersion();

  // Se o código JS em execução (CURRENT_APP_VERSION) ainda for mais antigo que o remote.version, também indica atualização disponível!
  const cmpCode = compareSemver(remote.version, CURRENT_APP_VERSION.version);
  if (cmpCode > 0 && isValidPublicLiveUrl(remote.liveUrl)) {
    return true;
  }

  const cmp = compareSemver(remote.version, installed.version);
  if (cmp > 0) return true;
  if (cmp === 0 && remote.buildId && remote.buildId !== installed.buildId) {
    return true;
  }
  return false;
}

/**
 * Detecta automaticamente se o app está rodando no seu site oficial na Vercel (ou domínio próprio)
 */
export function getDetectedPublicOrigin(): string {
  if (typeof window === 'undefined') return '';
  return normalizePublicLiveUrl(window.location.origin);
}

/**
 * Sincroniza a versão atual com o Firestore:
 * - Se estiver rodando na Vercel (domínio público), salva automaticamente a versão + URL da Vercel na nuvem!
 * - Se estiver rodando no APK Android (`https://localhost`) e encontrar na nuvem uma `liveUrl` da Vercel mais nova que o código embutido do APK, sincroniza automaticamente!
 */
export async function syncCurrentVersionToCloudIfNeeded(): Promise<void> {
  if (!db || typeof window === 'undefined') return;

  try {
    const publicOrigin = getDetectedPublicOrigin();
    const ref = doc(db, 'dados_caixinhas_agenda', 'versao_app');
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      await setDoc(
        ref,
        {
          ...CURRENT_APP_VERSION,
          liveUrl: publicOrigin || getSavedVercelLiveUrl() || '',
          updatedAt: Date.now(),
        },
        { merge: true }
      );
      return;
    }

    const cloudData = snap.data() as AppVersionInfo;
    const validCloudUrl = normalizePublicLiveUrl(cloudData.liveUrl);

    if (validCloudUrl) {
      try {
        localStorage.setItem(VERCEL_SERVER_URL_KEY, validCloudUrl);
      } catch {}
    }

    // Se o Firestore tiver uma URL inválida (.run.app), limpa na hora!
    if (cloudData.liveUrl && !validCloudUrl) {
      await setDoc(
        ref,
        {
          ...CURRENT_APP_VERSION,
          liveUrl: publicOrigin || getSavedVercelLiveUrl() || '',
          updatedAt: Date.now(),
        },
        { merge: true }
      );
      return;
    }

    // Se estiver aberto direto no site da Vercel, registra automaticamente o domínio da Vercel e a versão!
    if (
      publicOrigin &&
      (compareSemver(CURRENT_APP_VERSION.version, cloudData.version || '0.0.0') > 0 ||
        (compareSemver(CURRENT_APP_VERSION.version, cloudData.version || '0.0.0') === 0 &&
          validCloudUrl !== publicOrigin))
    ) {
      await setDoc(
        ref,
        {
          ...CURRENT_APP_VERSION,
          liveUrl: publicOrigin,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    }
  } catch {
    // Ignora caso esteja sem permissão ou offline
  }
}

/**
 * Permite publicar manualmente uma nova atualização OTA para todos os aparelhos (ex: pelo painel ADM)
 */
export async function publishAppUpdateToCloud(customInfo?: Partial<AppVersionInfo>): Promise<AppVersionInfo | null> {
  if (!db) return null;
  try {
    const ref = doc(db, 'dados_caixinhas_agenda', 'versao_app');
    const snap = await getDoc(ref);
    let nextVersion = CURRENT_APP_VERSION.version;
    let existingValidUrl = getDetectedPublicOrigin() || getSavedVercelLiveUrl();

    if (snap.exists() && snap.data()) {
      const data = snap.data() as AppVersionInfo;
      if (data.version && !customInfo?.version) {
        const parts = String(data.version).split('.').map(Number);
        if (parts.length === 3) {
          parts[2] = (parts[2] || 0) + 1;
          nextVersion = `${parts[0]}.${parts[1]}.${parts[2]}`;
        }
      }
      if (!existingValidUrl && isValidPublicLiveUrl(data.liveUrl)) {
        existingValidUrl = normalizePublicLiveUrl(data.liveUrl);
      }
    }

    const candidateUrl =
      customInfo?.liveUrl !== undefined
        ? normalizePublicLiveUrl(customInfo.liveUrl)
        : existingValidUrl;

    if (candidateUrl) {
      try {
        localStorage.setItem(VERCEL_SERVER_URL_KEY, candidateUrl);
      } catch {}
    }

    const newUpdate: AppVersionInfo = {
      version: customInfo?.version || nextVersion,
      buildId: customInfo?.buildId || `ota-${Date.now()}`,
      title: customInfo?.title || `Nova Atualização v${customInfo?.version || nextVersion} Disponível!`,
      notes:
        customInfo?.notes ||
        'Novas melhorias de desempenho, sincronização instantânea e alertas inteligentes prontos para aplicar.',
      liveUrl: candidateUrl,
      updatedAt: Date.now(),
    };

    await setDoc(ref, newUpdate, { merge: true });
    return newUpdate;
  } catch (err) {
    console.warn('Erro ao publicar atualização OTA na nuvem:', err);
    return null;
  }
}

/**
 * Busca imediatamente se há uma versão mais nova no version.json (local ou Vercel) ou no Firestore
 */
export async function checkAppUpdateNow(customVercelUrl?: string): Promise<{
  hasUpdate: boolean;
  remoteInfo: AppVersionInfo;
  installedVersion: string;
}> {
  const installed = getInstalledAppVersion();
  const savedVercel = normalizePublicLiveUrl(customVercelUrl) || getSavedVercelLiveUrl();
  let bestRemote: AppVersionInfo = {
    ...CURRENT_APP_VERSION,
    liveUrl: savedVercel || CURRENT_APP_VERSION.liveUrl || '',
  };

  // 1. Consulta Firestore em dados_caixinhas_agenda/versao_app e na CONTA do usuário (dados_financeiros/{uid})
  if (db) {
    try {
      const uid = auth?.currentUser?.uid || (typeof window !== 'undefined' ? localStorage.getItem('sutello_last_uid') : '') || '';
      if (uid) {
        try {
          const userFinSnap = await getDoc(doc(db, 'dados_financeiros', uid));
          if (userFinSnap.exists()) {
            const uData = userFinSnap.data();
            const accountUrl = normalizePublicLiveUrl(uData?.otaLiveUrl);
            if (accountUrl) {
              bestRemote.liveUrl = accountUrl;
              try {
                localStorage.setItem(VERCEL_SERVER_URL_KEY, accountUrl);
              } catch {}
            }
          }
        } catch {}
      }

      const snap = await getDoc(doc(db, 'dados_caixinhas_agenda', 'versao_app'));
      if (snap.exists()) {
        const data = snap.data() as AppVersionInfo;
        if (data && data.version) {
          const validCloudUrl = normalizePublicLiveUrl(data.liveUrl) || bestRemote.liveUrl || savedVercel;
          if (validCloudUrl) {
            try {
              localStorage.setItem(VERCEL_SERVER_URL_KEY, validCloudUrl);
            } catch {}
          }
          if (
            compareSemver(data.version, bestRemote.version) > 0 ||
            (compareSemver(data.version, bestRemote.version) === 0 && data.buildId !== bestRemote.buildId)
          ) {
            bestRemote = {
              version: data.version,
              buildId: data.buildId || `build-${data.version}`,
              title: data.title || `Atualização v${data.version}`,
              notes: data.notes || CURRENT_APP_VERSION.notes,
              liveUrl: validCloudUrl,
              updatedAt: data.updatedAt || Date.now(),
            };
          } else if (validCloudUrl && !bestRemote.liveUrl) {
            bestRemote.liveUrl = validCloudUrl;
          }
        }
      }
    } catch {}
  }

  // 2. Se houver URL pública da Vercel configurada, checa o version.json direto na Vercel
  const activeVercelUrl = normalizePublicLiveUrl(bestRemote.liveUrl) || savedVercel;
  if (activeVercelUrl) {
    try {
      const res = await fetch(`${activeVercelUrl}/version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json && json.version) {
          const remoteLiveUrl = normalizePublicLiveUrl(json.liveUrl) || activeVercelUrl;
          if (
            compareSemver(json.version, bestRemote.version) >= 0 ||
            json.buildId !== bestRemote.buildId
          ) {
            bestRemote = {
              version: json.version,
              buildId: json.buildId || `build-${json.version}`,
              title: json.title || `Atualização v${json.version}`,
              notes: json.notes || CURRENT_APP_VERSION.notes,
              liveUrl: remoteLiveUrl,
              updatedAt: json.updatedAt || Date.now(),
            };
          }
        }
      }
    } catch {}
  }

  // 3. Consulta version.json da própria origem atual (com cache-busting)
  try {
    const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (json && json.version) {
        const jsonLiveUrl = normalizePublicLiveUrl(json.liveUrl) || bestRemote.liveUrl || getDetectedPublicOrigin();
        if (jsonLiveUrl) {
          try {
            localStorage.setItem(VERCEL_SERVER_URL_KEY, jsonLiveUrl);
          } catch {}
        }
        if (
          compareSemver(json.version, bestRemote.version) > 0 ||
          (compareSemver(json.version, bestRemote.version) === 0 && json.buildId !== bestRemote.buildId)
        ) {
          bestRemote = {
            version: json.version,
            buildId: json.buildId || `build-${json.version}`,
            title: json.title || `Atualização v${json.version}`,
            notes: json.notes || CURRENT_APP_VERSION.notes,
            liveUrl: jsonLiveUrl,
            updatedAt: json.updatedAt || Date.now(),
          };
        } else if (jsonLiveUrl && !bestRemote.liveUrl) {
          bestRemote.liveUrl = jsonLiveUrl;
        }
      }
    }
  } catch {}

  // 4. Verifica se há um Service Worker aguardando ativação (waiting)
  let swWaiting = false;
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.update().catch(() => {});
        if (reg.waiting) {
          swWaiting = true;
        }
      }
    } catch {}
  }

  // Se estiver rodando no APK local (https://localhost) e houver uma URL da Vercel configurada onde o código é diferente/mais novo, sinaliza atualização
  const isRunningOnLocalApkBundle =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const needsSwitchToVercel =
    isRunningOnLocalApkBundle &&
    !!bestRemote.liveUrl &&
    compareSemver(bestRemote.version, CURRENT_APP_VERSION.version) >= 0 &&
    bestRemote.version !== CURRENT_APP_VERSION.version;

  const hasNewer = isRemoteVersionNewer(bestRemote) || swWaiting || needsSwitchToVercel;
  return {
    hasUpdate: hasNewer,
    remoteInfo: bestRemote,
    installedVersion: installed.version,
  };
}

/**
 * Escuta em tempo real qualquer nova versão publicada no Firestore e no documento da conta logada
 */
export function subscribeToAppUpdates(
  onUpdateDetected: (remoteInfo: AppVersionInfo) => void
): () => void {
  let unsubFirestore = () => {};
  let unsubAccount = () => {};

  if (db) {
    try {
      const ref = doc(db, 'dados_caixinhas_agenda', 'versao_app');
      unsubFirestore = onSnapshot(
        ref,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as AppVersionInfo;
            const safeUrl = normalizePublicLiveUrl(data.liveUrl) || getSavedVercelLiveUrl();
            if (safeUrl) {
              try {
                localStorage.setItem(VERCEL_SERVER_URL_KEY, safeUrl);
              } catch {}
            }
            if (isRemoteVersionNewer({ ...data, liveUrl: safeUrl })) {
              onUpdateDetected({ ...data, liveUrl: safeUrl });
            }
          }
        },
        () => {}
      );

      const uid = auth?.currentUser?.uid || (typeof window !== 'undefined' ? localStorage.getItem('sutello_last_uid') : '') || '';
      if (uid) {
        unsubAccount = onSnapshot(
          doc(db, 'dados_financeiros', uid),
          (snap) => {
            if (snap.exists()) {
              const uData = snap.data();
              const accountUrl = normalizePublicLiveUrl(uData?.otaLiveUrl);
              if (accountUrl) {
                try {
                  localStorage.setItem(VERCEL_SERVER_URL_KEY, accountUrl);
                } catch {}
              }
            }
          },
          () => {}
        );
      }
    } catch {}
  }

  return () => {
    unsubFirestore();
    unsubAccount();
  };
}

/**
 * Testa se a URL pública da Vercel está respondendo com HTTP 200 antes de o APK abrir
 */
export async function verifyPublicUrlReachable(url: string): Promise<boolean> {
  const cleanBase = normalizePublicLiveUrl(url);
  if (!cleanBase) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(`${cleanBase}/version.json?t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) return true;
  } catch {}

  try {
    const controller2 = new AbortController();
    const timer2 = setTimeout(() => controller2.abort(), 4500);
    const res2 = await fetch(`${cleanBase}/?t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller2.signal,
    });
    clearTimeout(timer2);
    return res2.ok;
  } catch {
    return false;
  }
}

/**
 * Aplica a atualização OTA de forma 100% segura:
 * - Se houver site público na Vercel respondendo OK, sincroniza o APK ou navegador com ele para puxar os arquivos novos da Vercel!
 * - Se não houver ou se falhar o teste, recarrega apenas o bundle local https://localhost (nunca dá Page not found).
 */
export async function applyOverTheAirUpdate(
  remoteInfo?: AppVersionInfo | null,
  customVercelUrl?: string
): Promise<void> {
  const targetVer = remoteInfo?.version || CURRENT_APP_VERSION.version;
  const targetBuild = remoteInfo?.buildId || CURRENT_APP_VERSION.buildId;
  const candidateUrl =
    normalizePublicLiveUrl(customVercelUrl) ||
    normalizePublicLiveUrl(remoteInfo?.liveUrl) ||
    getSavedVercelLiveUrl() ||
    getDetectedPublicOrigin();

  try {
    localStorage.setItem(INSTALLED_VERSION_KEY, targetVer);
    localStorage.setItem(INSTALLED_BUILD_KEY, targetBuild);
    localStorage.removeItem(OTA_LIVE_URL_KEY);
    if (candidateUrl) {
      localStorage.setItem(VERCEL_SERVER_URL_KEY, candidateUrl);
    }
  } catch {}

  // Salva a URL da Vercel também no Firestore para que todos os aparelhos recebam automaticamente
  if (candidateUrl) {
    await saveVercelLiveUrl(candidateUrl).catch(() => {});
  }

  // 1. Limpa todos os caches de Service Worker para buscar os arquivos mais recentes
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((k) => caches.delete(k)));
    } catch {}
  }

  // 2. Força atualização imediata do Service Worker
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        await reg.update().catch(() => {});
      }
    } catch {}
  }

  // 3. Verifica se a URL da Vercel está 100% online para carregar os arquivos novos sem precisar compilar outro APK
  let verifiedVercelUrl = '';
  if (candidateUrl) {
    const isOnline = await verifyPublicUrlReachable(candidateUrl);
    if (isOnline) {
      verifiedVercelUrl = candidateUrl;
    }
  }

  // 4. Se estiver no APK Android Nativo, aplica na ponte nativa (ou redireciona o WebView para o bundle novo da Vercel)
  if (typeof window !== 'undefined') {
    if (typeof (window as any).SutelloNativeAndroid?.applyOtaUpdate === 'function') {
      try {
        (window as any).SutelloNativeAndroid.applyOtaUpdate(verifiedVercelUrl, targetVer, targetBuild);
        return;
      } catch {}
    }

    // Mesmo que o APK instalado tenha sido compilado antes da ponte applyOtaUpdate existir,
    // se estiver no APK (capacitor/localhost) e a Vercel estiver online, navega para a Vercel!
    if (verifiedVercelUrl && (isNativeApkPlatform() || window.location.hostname === 'localhost')) {
      const sep = verifiedVercelUrl.includes('?') ? '&' : '?';
      window.location.replace(`${verifiedVercelUrl}${sep}ota_updated=${Date.now()}`);
      return;
    }

    // Caso contrário, recarrega na própria origem com cache-busting
    const cleanUrl = window.location.origin + window.location.pathname + `?ota_updated=${Date.now()}`;
    window.location.replace(cleanUrl);
  }
}

