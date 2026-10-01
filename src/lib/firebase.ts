import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
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
  getDoc,
  getDocFromServer,
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
    // Configura persistência local em IndexedDB no Firestore e ignora propriedades undefined para nunca falhar no setDoc
    dbInstance = initializeFirestore(app, {
      ignoreUndefinedProperties: true,
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

/**
 * Remove campos undefined de arrays/objetos antes de gravar no Firestore
 */
function sanitizeForFirestore<T>(data: T): T {
  try {
    return JSON.parse(JSON.stringify(data));
  } catch {
    return data;
  }
}

/**
 * Retorna o ID único deste dispositivo para evitar eco/conflito de sincronização
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    let id = localStorage.getItem('sutello_device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
      localStorage.setItem('sutello_device_id', id);
    }
    return id;
  } catch {
    return 'temp_device';
  }
}

export interface SnapshotMetadataInfo {
  hasPendingWrites: boolean;
  fromCache: boolean;
  cloudTimestamp: number;
  updatedByDeviceId?: string;
  actionType?: string;
}

/**
 * Escuta em tempo real os dados financeiros do usuário
 */
export function subscribeToFinancialData(
  uid: string,
  onData: (contas: Conta[], logs: LogAtividade[], meta?: SnapshotMetadataInfo) => void,
  onError?: (err: unknown) => void
) {
  if (!db || !uid) {
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
            updatedByDeviceId: data.updatedByDeviceId,
            actionType: data.actionType,
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
 * Busca imediatamente os dados mais recentes direto do servidor na nuvem
 * (ideal quando o usuário abre ou alterna para o celular/notebook/computador)
 */
export async function fetchFinancialDataFromCloud(
  uid: string
): Promise<{ contas: Conta[]; logs: LogAtividade[]; timestamp: number; exists: boolean } | null> {
  if (!db || !uid) return null;
  try {
    const docRef = doc(db, 'dados_financeiros', uid);
    let snapshot;
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        snapshot = await getDocFromServer(docRef);
      } catch {
        snapshot = await getDoc(docRef);
      }
    } else {
      snapshot = await getDoc(docRef);
    }

    if (snapshot.exists()) {
      const data = snapshot.data();
      const cloudTimestamp =
        typeof data.timestamp === 'number'
          ? data.timestamp
          : data.ultimaAtualizacao
          ? new Date(data.ultimaAtualizacao).getTime()
          : 0;
      return {
        contas: data.contas || [],
        logs: data.logs || [],
        timestamp: cloudTimestamp,
        exists: true,
      };
    }
    return { contas: [], logs: [], timestamp: 0, exists: false };
  } catch (err) {
    console.warn('Erro ao buscar dados recentes da nuvem:', err);
    return null;
  }
}

/**
 * Salva os dados financeiros de forma resiliente tanto offline (localStorage + IndexedDB) quanto na nuvem.
 * Transmite o ID do dispositivo para que todos os aparelhos conectados à mesma conta recebam imediatamente a atualização.
 */
export async function saveFinancialDataToCloud(
  uid: string,
  contas: Conta[],
  logs: LogAtividade[],
  actionType: string = 'update'
): Promise<boolean> {
  const now = Date.now();
  const deviceId = getDeviceId();
  const safeContas = sanitizeForFirestore(contas || []);
  const safeLogs = sanitizeForFirestore(logs || []);

  // 1. Sempre salva imediatamente no localStorage para abertura instantânea e modo offline
  try {
    localStorage.setItem('contas', JSON.stringify(safeContas));
    localStorage.setItem('logs', JSON.stringify(safeLogs));
    localStorage.setItem(LAST_LOCAL_UPDATE_KEY, String(now));
    if (uid) {
      localStorage.setItem('sutello_last_uid', uid);
    }
  } catch (e) {
    console.warn('Erro ao salvar cópia local de segurança:', e);
  }

  // 2. Se não houver banco ou usuário autenticado, deixa pendente para enviar assim que logar
  if (!db || !uid) {
    try {
      localStorage.setItem(PENDING_SYNC_KEY, 'true');
    } catch {}
    return false;
  }

  try {
    const docRef = doc(db, 'dados_financeiros', uid);
    const dataToSave = {
      contas: safeContas,
      logs: safeLogs,
      ultimaAtualizacao: new Date(now).toISOString(),
      timestamp: now,
      updatedByDeviceId: deviceId,
      actionType,
    };

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      await setDoc(docRef, dataToSave, { merge: true });
      try {
        localStorage.removeItem(PENDING_SYNC_KEY);
      } catch {}
      return true;
    } else {
      // Modo offline: setDoc grava na persistência local IndexedDB do Firestore e envia quando reconectar
      setDoc(docRef, dataToSave, { merge: true }).catch(() => {});
      try {
        localStorage.setItem(PENDING_SYNC_KEY, 'true');
      } catch {}
      return false;
    }
  } catch (error) {
    console.warn('Falha temporária ao registrar no Firestore:', error);
    try {
      localStorage.setItem(PENDING_SYNC_KEY, 'true');
    } catch {}
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

  const ok = await saveFinancialDataToCloud(targetUid, currentContas, currentLogs, 'sync_offline');
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
  return signInWithEmailAndPassword(auth, email.trim().toLowerCase(), pass);
}

export async function registerWithEmailPassword(email: string, pass: string) {
  if (!auth) {
    throw new Error('Firebase Auth não inicializado. Verifique suas credenciais.');
  }
  return createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), pass);
}

export {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
};
export type { User };
