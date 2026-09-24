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

/**
 * Escuta em tempo real os dados financeiros do usuário
 */
export function subscribeToFinancialData(
  uid: string,
  onData: (contas: Conta[], logs: LogAtividade[]) => void,
  onError?: (err: unknown) => void
) {
  if (!db) {
    onData([], []);
    return () => {};
  }
  try {
    const docRef = doc(db, 'dados_financeiros', uid);
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          onData(data.contas || [], data.logs || []);
        } else {
          onData([], []);
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

export const PENDING_SYNC_KEY = 'sutello_pending_cloud_sync';

/**
 * Salva os dados financeiros na nuvem de forma silenciosa e resiliente.
 * Se estiver offline, marca para sincronizar automaticamente assim que a conexão retornar.
 */
export async function saveFinancialDataToCloud(
  uid: string,
  contas: Conta[],
  logs: LogAtividade[]
): Promise<boolean> {
  // Garante que o estado mais recente fica salvo no localStorage mesmo que a nuvem falhe
  try {
    localStorage.setItem('contas', JSON.stringify(contas));
    localStorage.setItem('logs', JSON.stringify(logs));
  } catch (e) {
    console.warn('Erro ao salvar cópia local de segurança:', e);
  }

  // Se não houver internet ou se o SDK do Firestore não estiver pronto
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    try {
      localStorage.setItem(PENDING_SYNC_KEY, 'true');
    } catch {
      // Ignora erro de quota do storage
    }
    return false;
  }

  if (!db) {
    try {
      localStorage.setItem(PENDING_SYNC_KEY, 'true');
    } catch {
      // Ignora erro
    }
    return false;
  }

  try {
    const docRef = doc(db, 'dados_financeiros', uid);
    await setDoc(
      docRef,
      {
        contas,
        logs,
        ultimaAtualizacao: new Date().toISOString(),
      },
      { merge: true }
    );
    // Sucesso no salvamento: remove a flag de pendência
    try {
      localStorage.removeItem(PENDING_SYNC_KEY);
    } catch {
      // Ignora erro
    }
    return true;
  } catch (error) {
    console.warn('Falha temporária ao sincronizar com a nuvem, salvando localmente e enfileirando:', error);
    try {
      localStorage.setItem(PENDING_SYNC_KEY, 'true');
    } catch {
      // Ignora erro
    }
    return false;
  }
}

/**
 * Dispara envio de todas as alterações feitas offline assim que a internet voltar
 */
export async function syncPendingDataIfOnline(
  uid: string,
  contas: Conta[],
  logs: LogAtividade[],
  onSuccess?: () => void
): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
  if (!uid) return false;

  const isPending = localStorage.getItem(PENDING_SYNC_KEY) === 'true';
  // Mesmo que não haja a flag explícita, ao reconectar enviamos o estado atual consolidado
  const savedContas = localStorage.getItem('contas');
  const currentContas = savedContas ? JSON.parse(savedContas) : contas;
  const savedLogs = localStorage.getItem('logs');
  const currentLogs = savedLogs ? JSON.parse(savedLogs) : logs;

  const ok = await saveFinancialDataToCloud(uid, currentContas, currentLogs);
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
