import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  updatePassword,
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
} from 'firebase/firestore';
import { Conta, LogAtividade, UserProfile } from '../types';

// Configuração segura através de variáveis de ambiente com fallback do projeto
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDDguzJOP5GKqlqf8GW-xdsTCxh1Ha7C7k",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "sutello-financeiro.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "sutello-financeiro",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "sutello-financeiro.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "460447549653",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:460447549653:web:a36b0c7d2c2919ff633a5c",
};

let app: any;
let authInstance: any;
let dbInstance: any;

try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  authInstance = getAuth(app);
  try {
    // Configura persistência local em IndexedDB no Firestore para permitir abrir e operar offline
    dbInstance = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch (firestoreErr) {
    console.warn('Fallback para getFirestore padrão:', firestoreErr);
    dbInstance = getFirestore(app);
  }
} catch (err) {
  console.warn('Aviso: Falha ao inicializar Firebase SDK, operando em modo local offline:', err);
}

export const auth = authInstance;
export const db = dbInstance;

export const PENDING_SYNC_KEY = 'sutello_pending_cloud_sync';
export const LAST_LOCAL_UPDATE_KEY = 'sutello_last_local_update_time';

export interface SnapshotMetadataInfo {
  hasPendingWrites: boolean;
  fromCache: boolean;
  cloudTimestamp: number;
}

/**
 * Escuta em tempo real os dados financeiros do usuário
 */
export function subscribeToFinancialData(
  uid: string,
  onData: (contas: Conta[], logs: LogAtividade[], meta?: SnapshotMetadataInfo) => void,
  onError?: (err: unknown) => void
) {
  if (!db) {
    onData([], [], { hasPendingWrites: false, fromCache: false, cloudTimestamp: 0 });
    return () => {};
  }
  try {
    const docRef = doc(db, 'dados_financeiros', uid);
    return onSnapshot(
      docRef,
      { includeMetadataChanges: true },
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const cloudTimestamp = typeof data.timestamp === 'number' 
            ? data.timestamp 
            : (data.ultimaAtualizacao ? new Date(data.ultimaAtualizacao).getTime() : 0);
          onData(data.contas || [], data.logs || [], {
            hasPendingWrites: snapshot.metadata.hasPendingWrites,
            fromCache: snapshot.metadata.fromCache,
            cloudTimestamp,
          });
        } else {
          onData([], [], {
            hasPendingWrites: snapshot.metadata.hasPendingWrites,
            fromCache: snapshot.metadata.fromCache,
            cloudTimestamp: 0,
          });
        }
      },
      (error) => {
        console.warn('Erro ao escutar dados financeiros da nuvem:', error);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    console.warn('Falha ao iniciar snapshot financeiro:', err);
    return () => {};
  }
}

/**
 * Salva os dados financeiros de forma resiliente tanto offline (localStorage + IndexedDB) quanto na nuvem.
 * Mantém o registro seguro para não perder alterações ao fechar ou reabrir o app sem internet.
 */
export async function saveFinancialDataToCloud(
  uid: string,
  contas: Conta[],
  logs: LogAtividade[]
): Promise<boolean> {
  const now = Date.now();

  // 1. Sempre salva imediatamente no localStorage
  try {
    localStorage.setItem('contas', JSON.stringify(contas));
    localStorage.setItem('logs', JSON.stringify(logs));
    localStorage.setItem(LAST_LOCAL_UPDATE_KEY, String(now));
    localStorage.setItem(PENDING_SYNC_KEY, 'true');
    if (uid) {
      localStorage.setItem('sutello_last_uid', uid);
    }
  } catch (e) {
    console.warn('Erro ao salvar cópia local de segurança:', e);
  }

  // 2. Grava no Firestore (que possui cache persistente local IndexedDB mesmo sem internet)
  if (!db || !uid) {
    return false;
  }

  try {
    const docRef = doc(db, 'dados_financeiros', uid);
    const dataToSave = {
      contas,
      logs,
      ultimaAtualizacao: new Date(now).toISOString(),
      timestamp: now,
    };

    // setDoc grava no cache local do Firestore e enfileira para a nuvem
    const setPromise = setDoc(docRef, dataToSave, { merge: true });

    // Se estiver conectado à internet, aguarda a confirmação de envio para limpar a pendência
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        await Promise.race([
          setPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
        ]);
        // Só remove a flag de pendência se não houve uma alteração mais recente durante a espera
        const lastUpdate = Number(localStorage.getItem(LAST_LOCAL_UPDATE_KEY) || 0);
        if (lastUpdate <= now) {
          localStorage.removeItem(PENDING_SYNC_KEY);
        }
        return true;
      } catch (uploadErr) {
        console.warn('Envio para nuvem em segundo plano:', uploadErr);
        return false;
      }
    } else {
      // Offline: setPromise continua em fila e o Firestore enviará assim que reconectar
      setPromise
        .then(() => {
          const lastUpdate = Number(localStorage.getItem(LAST_LOCAL_UPDATE_KEY) || 0);
          if (lastUpdate <= now) {
            localStorage.removeItem(PENDING_SYNC_KEY);
          }
        })
        .catch(() => {});
      return false;
    }
  } catch (error) {
    console.warn('Falha temporária ao registrar no Firestore local:', error);
    return false;
  }
}

/**
 * Dispara envio de todas as alterações feitas offline assim que a internet voltar
 */
export async function syncPendingDataIfOnline(
  uid: string,
  contas?: Conta[],
  logs?: LogAtividade[],
  onSuccess?: () => void
): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
  const targetUid = uid || (typeof localStorage !== 'undefined' ? localStorage.getItem('sutello_last_uid') : null);
  if (!targetUid) return false;

  // Lê com prioridade absoluta os dados salvos localmente
  let currentContas = contas;
  let currentLogs = logs;

  try {
    const savedContas = localStorage.getItem('contas');
    if (savedContas) currentContas = JSON.parse(savedContas);
    const savedLogs = localStorage.getItem('logs');
    if (savedLogs) currentLogs = JSON.parse(savedLogs);
  } catch (e) {
    console.warn('Erro ao ler estado do storage local:', e);
  }

  if (!currentContas) currentContas = [];
  if (!currentLogs) currentLogs = [];

  const ok = await saveFinancialDataToCloud(targetUid, currentContas, currentLogs);
  if (ok && onSuccess) {
    onSuccess();
  }
  return ok;
}


/**
 * Escuta em tempo real os dados de perfil do usuário
 */
export function subscribeToUserProfile(
  uid: string,
  onProfile: (profile: Partial<UserProfile>) => void,
  onError?: (err: unknown) => void
) {
  if (!db) return () => {};
  try {
    const docRef = doc(db, 'usuarios', uid);
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          onProfile({
            nome: data.nome || data.nomeConta || '',
            fotoPerfil: data.fotoPerfil || '',
            biometriaAtivada: !!data.biometriaAtivada,
            pinAcesso: data.pinAcesso || '2007',
          });
        }
      },
      (error) => {
        console.warn('Erro ao escutar perfil na nuvem:', error);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    console.warn('Falha ao iniciar snapshot de perfil:', err);
    return () => {};
  }
}

/**
 * Salva os dados de perfil do usuário na nuvem
 */
export async function saveUserProfileToCloud(
  uid: string,
  profile: Partial<UserProfile>
): Promise<boolean> {
  if (!db) return false;
  try {
    const docRef = doc(db, 'usuarios', uid);
    await setDoc(docRef, profile, { merge: true });
    return true;
  } catch (error) {
    console.error('Erro ao atualizar perfil na nuvem:', error);
    return false;
  }
}

export function onAuthStateChangedSafe(callback: (user: User | null) => void) {
  if (!auth) {
    callback(null);
    return () => {};
  }
  try {
    return onAuthStateChanged(auth, callback, (error) => {
      console.warn('Erro ao monitorar estado de autenticação:', error);
      callback(null);
    });
  } catch (err) {
    console.warn('Falha no listener de auth:', err);
    callback(null);
    return () => {};
  }
}

export async function loginWithEmailPassword(email: string, pass: string) {
  if (!auth) {
    throw new Error('Firebase Auth não inicializado. Verifique suas credenciais.');
  }
  return signInWithEmailAndPassword(auth, email, pass);
}

export {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
};
export type { User };
