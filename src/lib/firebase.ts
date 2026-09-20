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

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);

/**
 * Escuta em tempo real os dados financeiros do usuário
 */
export function subscribeToFinancialData(
  uid: string,
  onData: (contas: Conta[], logs: LogAtividade[]) => void,
  onError?: (err: unknown) => void
) {
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
}

/**
 * Salva os dados financeiros na nuvem de forma silenciosa e resiliente
 */
export async function saveFinancialDataToCloud(
  uid: string,
  contas: Conta[],
  logs: LogAtividade[]
): Promise<boolean> {
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
    return true;
  } catch (error) {
    console.error('Falha ao salvar dados na nuvem:', error);
    return false;
  }
}

/**
 * Escuta em tempo real os dados de perfil do usuário
 */
export function subscribeToUserProfile(
  uid: string,
  onProfile: (profile: Partial<UserProfile>) => void,
  onError?: (err: unknown) => void
) {
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
}

/**
 * Salva os dados de perfil do usuário na nuvem
 */
export async function saveUserProfileToCloud(
  uid: string,
  profile: Partial<UserProfile>
): Promise<boolean> {
  try {
    const docRef = doc(db, 'usuarios', uid);
    await setDoc(docRef, profile, { merge: true });
    return true;
  } catch (error) {
    console.error('Erro ao atualizar perfil na nuvem:', error);
    return false;
  }
}

export async function loginWithEmailPassword(email: string, pass: string) {
  return signInWithEmailAndPassword(auth, email, pass);
}

export {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
};
export type { User };
