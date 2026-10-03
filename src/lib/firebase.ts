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
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import {
  Conta,
  LogAtividade,
  UserProfile,
  MensagemTransmissao,
  Acordo,
  DividaLimpaNome,
  Caixinha,
  DadosSaude,
  DadosAgenda,
  RegistroPesoAltura,
  MedicamentoSaude,
  ConsultaExameSaude,
  MetricaSaude,
  ItemAgenda,
  NotaRapida,
} from '../types';

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
  transmissoes?: MensagemTransmissao[];
  admPassword?: string;
  acordos?: Acordo[];
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
            transmissoes: data.transmissoes || [],
            admPassword: data.admPassword,
            acordos: Array.isArray(data.acordos) && data.acordos.length > 0 ? data.acordos : undefined,
          });
        } else {
          onData([], [], {
            hasPendingWrites: snapshot.metadata.hasPendingWrites,
            fromCache: snapshot.metadata.fromCache,
            cloudTimestamp: 0,
            transmissoes: [],
            acordos: undefined,
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
): Promise<{ contas: Conta[]; logs: LogAtividade[]; timestamp: number; exists: boolean; transmissoes?: MensagemTransmissao[]; admPassword?: string; acordos?: Acordo[] } | null> {
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

      let acordosCarregados: Acordo[] | undefined =
        Array.isArray(data.acordos) && data.acordos.length > 0 ? data.acordos : undefined;

      // Se ainda não existia em dados_financeiros, busca de dados_limpanome
      if (!acordosCarregados) {
        try {
          const limpaNomeRef = doc(db, 'dados_limpanome', uid);
          const snapLimpa = await getDoc(limpaNomeRef);
          if (snapLimpa.exists()) {
            const dl = snapLimpa.data().dividas || [];
            if (dl.length > 0) {
              acordosCarregados = convertDividasToAcordos(dl);
              // Salva em dados_financeiros para ficar sincronizado
              setDoc(docRef, { acordos: acordosCarregados }, { merge: true }).catch(() => {});
            }
          }
        } catch {}
      }

      return {
        contas: data.contas || [],
        logs: data.logs || [],
        timestamp: cloudTimestamp,
        exists: true,
        transmissoes: data.transmissoes || [],
        admPassword: data.admPassword,
        acordos: acordosCarregados,
      };
    }
    return { contas: [], logs: [], timestamp: 0, exists: false, transmissoes: [], acordos: undefined };
  } catch (err) {
    console.warn('Erro ao buscar dados recentes da nuvem:', err);
    return null;
  }
}

/**
 * Dispara uma mensagem de transmissão ADM para todos os aparelhos conectados à conta
 */
export async function sendBroadcastNotificationToCloud(
  uid: string,
  msg: { titulo: string; mensagem: string; urgencia: 'alta' | 'media' | 'baixa'; enviadoPor?: string }
): Promise<MensagemTransmissao | null> {
  if (!db || !uid) return null;
  try {
    const docRef = doc(db, 'dados_financeiros', uid);
    const snap = await getDoc(docRef);
    const currentTransmissoes: MensagemTransmissao[] = snap.exists() ? (snap.data().transmissoes || []) : [];

    const novaMensagem: MensagemTransmissao = {
      id: `broadcast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      titulo: msg.titulo.trim(),
      mensagem: msg.mensagem.trim(),
      data: new Date().toISOString(),
      timestamp: Date.now(),
      urgencia: msg.urgencia,
      enviadoPor: msg.enviadoPor || 'Administrador',
      deviceId: getDeviceId(),
    };

    const updated = [novaMensagem, ...currentTransmissoes.slice(0, 29)];
    await setDoc(
      docRef,
      {
        transmissoes: sanitizeForFirestore(updated),
        ultimaAtualizacao: new Date().toISOString(),
        timestamp: Date.now(),
        actionType: 'broadcast_adm',
        updatedByDeviceId: getDeviceId(),
      },
      { merge: true }
    );
    return novaMensagem;
  } catch (err) {
    console.error('Erro ao enviar transmissão ADM:', err);
    return null;
  }
}

/**
 * Obtém a senha do ADM (com padrão adm85 caso ainda não configurada)
 */
export async function getAdminPassword(uid: string): Promise<string> {
  if (db && uid) {
    try {
      const docRef = doc(db, 'dados_financeiros', uid);
      const snap = await getDoc(docRef);
      if (snap.exists() && snap.data().admPassword) {
        const cloudPass = snap.data().admPassword;
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('sutello_adm_pwd', cloudPass);
        }
        return cloudPass;
      }
    } catch {}
  }
  if (typeof localStorage !== 'undefined') {
    const local = localStorage.getItem('sutello_adm_pwd');
    if (local) return local;
  }
  return 'adm85';
}

/**
 * Atualiza a senha de ADM na nuvem e localmente
 */
export async function setAdminPassword(uid: string, newPass: string): Promise<boolean> {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sutello_adm_pwd', newPass);
    }
    if (!db || !uid) return true;
    const docRef = doc(db, 'dados_financeiros', uid);
    await setDoc(docRef, { admPassword: newPass }, { merge: true });
    return true;
  } catch (err) {
    console.error('Erro ao atualizar senha do ADM:', err);
    return false;
  }
}

/**
 * Remove uma mensagem do histórico de transmissão
 */
export async function deleteBroadcastMessageFromCloud(uid: string, messageId: string): Promise<boolean> {
  if (!db || !uid) return false;
  try {
    const docRef = doc(db, 'dados_financeiros', uid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const current: MensagemTransmissao[] = snap.data().transmissoes || [];
      const filtered = current.filter((m) => m.id !== messageId);
      await setDoc(docRef, { transmissoes: sanitizeForFirestore(filtered) }, { merge: true });
      return true;
    }
    return false;
  } catch (err) {
    console.error('Erro ao excluir mensagem de transmissão:', err);
    return false;
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
 * Converte dividas da coleção legada 'dados_limpanome' para o formato Acordo
 */
export function convertDividasToAcordos(dividas: any[]): Acordo[] {
  if (!Array.isArray(dividas) || dividas.length === 0) return [];

  const acordos: Acordo[] = [];
  const mapIds = new Set<string>();

  dividas.forEach((d, idx) => {
    if (!d) return;

    // Se já é um Acordo completo:
    if (d.credor && typeof d.valorTotal === 'number') {
      const id = String(d.id || `acordo_${idx}`);
      if (!mapIds.has(id)) {
        mapIds.add(id);
        acordos.push(d as Acordo);
      }
      return;
    }

    const id = String(d.id || `divida_${idx}_${Date.now()}`);
    if (mapIds.has(id)) return;
    mapIds.add(id);

    const credor = (d.nome || d.credor || `Dívida ${idx + 1}`).trim();
    const totalParcelas = Number(d.totalParcelas) > 0 ? Number(d.totalParcelas) : 1;
    const valorParcela = parseFloat(String(d.valor || 0).replace(',', '.')) || 0;
    const valorTotalOriginal = parseFloat(String(d.valorTotalOriginal || 0).replace(',', '.')) || 0;
    const valorTotal = valorTotalOriginal > 0 ? valorTotalOriginal : valorParcela * totalParcelas;
    const valorOriginalDica = parseFloat(String(d.valorOriginalDica || 0).replace(',', '.')) || null;

    const parcelaAtual = Number(d.parcelaAtual) || 1;
    let parcelasPagas = 0;
    if (d.paga) {
      parcelasPagas = Math.min(parcelaAtual, totalParcelas);
    } else {
      parcelasPagas = Math.max(0, parcelaAtual - 1);
    }

    const quitado = Boolean(d.paga && (parcelasPagas >= totalParcelas || totalParcelas <= 1));
    const economia = valorOriginalDica && valorOriginalDica > valorTotal ? valorOriginalDica - valorTotal : null;
    const descontoPercentual = valorOriginalDica && economia ? Math.round((economia / valorOriginalDica) * 100) : null;

    let venc = d.vencimento || new Date().toISOString().split('T')[0];
    if (typeof venc === 'string' && venc.includes('/')) {
      const parts = venc.split('/');
      if (parts.length === 3) {
        venc = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }

    acordos.push({
      id,
      credor,
      valorOriginal: valorOriginalDica,
      valorTotal: valorTotal > 0 ? valorTotal : valorParcela,
      descontoPercentual,
      economia,
      vencimentoPrimeiraParcela: venc,
      parcelado: totalParcelas > 1,
      totalParcelas,
      parcelasPagas: Math.min(parcelasPagas, totalParcelas),
      valorParcela: valorParcela > 0 ? valorParcela : (valorTotal > 0 ? valorTotal / totalParcelas : 0),
      quitado,
      dataCriacao: d.dataCriacao || new Date().toISOString(),
      observacoes: d.observacoes || undefined,
    });
  });

  return acordos;
}

/**
 * Converte a lista de acordos para o formato legado de dividas para 'dados_limpanome'
 */
export function convertAcordosToDividas(acordos: Acordo[]): any[] {
  return (acordos || []).map((a) => {
    const total = a.totalParcelas || 1;
    const pagas = a.parcelasPagas || 0;
    return {
      id: a.id,
      nome: a.credor,
      valor: a.valorParcela || (a.valorTotal / total),
      valorTotalOriginal: a.valorTotal,
      valorOriginalDica: a.valorOriginal || 0,
      vencimento: a.vencimentoPrimeiraParcela,
      paga: a.quitado || pagas >= total,
      totalParcelas: total,
      parcelaAtual: a.quitado ? total : Math.min(pagas + 1, total),
      dataCriacao: a.dataCriacao,
      observacoes: a.observacoes,
    };
  });
}

/**
 * Escuta em tempo real a coleção legada dados_limpanome (usada pelo outro app de acordos)
 */
export function subscribeToLimpaNomeData(
  uid: string,
  onData: (acordosImportados: Acordo[]) => void
) {
  if (!db || !uid) return () => {};
  try {
    const docRef = doc(db, 'dados_limpanome', uid);
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const dividasRaw = data.dividas || [];
          const acordos = convertDividasToAcordos(dividasRaw);
          onData(acordos);
        } else {
          onData([]);
        }
      },
      (err) => {
        console.warn('Coleção dados_limpanome não encontrada ou sem permissão:', err);
      }
    );
  } catch (err) {
    console.warn('Falha ao registrar snapshot de dados_limpanome:', err);
    return () => {};
  }
}

/**
 * Escuta em tempo real as dívidas brutas de dados_limpanome exatamente como o app.js original
 */
export function subscribeToLimpaNomeDividas(
  uid: string,
  onData: (dividas: DividaLimpaNome[]) => void
) {
  if (!db || !uid) return () => {};
  try {
    const docRef = doc(db, 'dados_limpanome', uid);
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const raw = data.dividas || [];
          const list: DividaLimpaNome[] = raw.map((d: any, idx: number) => {
            const id = String(d.id || `divida_${idx}_${Date.now()}`);
            const nome = String(d.nome || d.credor || 'Dívida').trim();
            const valor = parseFloat(String(d.valor || 0).replace(',', '.')) || 0;
            const totalParcelas = Number(d.totalParcelas) > 0 ? Number(d.totalParcelas) : (Number(d.parcelaAtual) > 0 ? Number(d.parcelaAtual) : 1);
            const parcelaAtual = Number(d.parcelaAtual) > 0 ? Number(d.parcelaAtual) : 1;
            const valorTotalOriginal = parseFloat(String(d.valorTotalOriginal || 0).replace(',', '.')) || (valor * totalParcelas);
            const valorOriginalDica = d.valorOriginalDica !== undefined && d.valorOriginalDica !== null
              ? parseFloat(String(d.valorOriginalDica).replace(',', '.'))
              : null;
            let venc = String(d.vencimento || '').trim();
            if (!venc) venc = new Date().toISOString().split('T')[0];
            if (venc.includes('/')) {
              const p = venc.split('/');
              if (p.length === 3) venc = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
            }

            return {
              id,
              nome,
              valor,
              valorTotalOriginal,
              valorOriginalDica,
              vencimento: venc,
              paga: Boolean(d.paga),
              totalParcelas,
              parcelaAtual,
              dataCriacao: d.dataCriacao || new Date().toISOString(),
              observacoes: d.observacoes || undefined,
            };
          });
          onData(list);
        }
      },
      (err) => {
        console.warn('Erro ao escutar dados_limpanome:', err);
      }
    );
  } catch (err) {
    console.warn('Falha ao registrar snapshot de dados_limpanome:', err);
    return () => {};
  }
}

/**
 * Salva a lista exata de dívidas diretamente em 'dados_limpanome' no Firestore
 */
export async function saveLimpaNomeDividas(
  uid: string,
  dividas: DividaLimpaNome[]
): Promise<boolean> {
  const safeDividas = sanitizeForFirestore(dividas || []);
  try {
    localStorage.setItem('sutello_dividas', JSON.stringify(safeDividas));
  } catch {}

  if (!db || !uid) return true;
  try {
    // 1. Grava diretamente em dados_limpanome
    const limpaNomeRef = doc(db, 'dados_limpanome', uid);
    await setDoc(limpaNomeRef, { dividas: safeDividas }, { merge: true });

    // 2. Grava também em dados_financeiros
    try {
      const financeiroRef = doc(db, 'dados_financeiros', uid);
      await setDoc(financeiroRef, { dividas: safeDividas, acordos: convertDividasToAcordos(safeDividas) }, { merge: true });
    } catch {}

    return true;
  } catch (err) {
    console.warn('Erro ao gravar em dados_limpanome:', err);
    return false;
  }
}

/**
 * Salva a lista de acordos e dívidas de forma resiliente tanto offline quanto na nuvem
 * (atualiza dados_financeiros e dados_limpanome para sincronia bilateral)
 */
export async function saveAcordosToCloud(
  uid: string,
  acordos: Acordo[]
): Promise<boolean> {
  const safeAcordos = sanitizeForFirestore(acordos || []);
  try {
    localStorage.setItem('sutello_acordos', JSON.stringify(safeAcordos));
  } catch {}

  if (!db || !uid) return true;
  try {
    const docRef = doc(db, 'dados_financeiros', uid);
    await setDoc(
      docRef,
      {
        acordos: safeAcordos,
        timestamp: Date.now(),
        updatedByDeviceId: getDeviceId(),
        actionType: 'update_acordos',
      },
      { merge: true }
    );

    // Espelha também na coleção legada dados_limpanome
    try {
      const limpaNomeRef = doc(db, 'dados_limpanome', uid);
      const safeDividas = sanitizeForFirestore(convertAcordosToDividas(acordos));
      await setDoc(limpaNomeRef, { dividas: safeDividas }, { merge: true });
    } catch (e) {
      console.warn('Aviso: falha ao espelhar em dados_limpanome:', e);
    }

    return true;
  } catch (err) {
    console.warn('Erro ao salvar acordos no Firestore:', err);
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

// ==========================================
// 📦 MÓDULO CAIXINHAS & COFRINHOS (dados_caixinhas_agenda)
// ==========================================

const matchedCaixinhasAgendaDocIds = new Set<string>();

function parseNumericVal(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  let str = String(val).trim();
  // Se tiver formato brasileiro "1.250,50", remove pontos de milhar e troca vírgula por ponto
  if (str.includes(',') && str.includes('.')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }
  const n = parseFloat(str);
  return isNaN(n) ? 0 : n;
}

export function normalizeCaixinhasData(data: any): Caixinha[] {
  if (!data) return [];

  let rawList: any[] = [];
  if (Array.isArray(data)) {
    rawList = data;
  } else if (typeof data === 'object') {
    const candidates =
      data.caixas ??
      data.caixinhas ??
      data.metas ??
      data.cofrinhos ??
      data.listaCaixas ??
      data.dados_caixinhas;

    if (Array.isArray(candidates)) {
      rawList = candidates;
    } else if (candidates && typeof candidates === 'object') {
      rawList = Object.entries(candidates).map(([k, v]: [string, any]) =>
        typeof v === 'object' && v !== null ? { id: k, ...v } : { id: k, valor: v }
      );
    }
  }

  return rawList
    .filter((c) => c && typeof c === 'object')
    .map((c: any, idx: number) => {
      const id = String(c.id || c.key || `caixinha_${idx}_${Date.now()}`);
      const nome = String(c.nome || c.titulo || c.name || c.descricao || `Caixinha ${idx + 1}`).trim();
      const rawCat = String(c.categoria || c.tipo || 'emergencia').toLowerCase();
      const validCats = ['emergencia', 'sonhos', 'investimento', 'viagem', 'bens', 'geral'];
      const categoria = (validCats.includes(rawCat) ? rawCat : 'geral') as Caixinha['categoria'];

      const rawHistorico = Array.isArray(c.historico)
        ? c.historico
        : Array.isArray(c.transacoes)
        ? c.transacoes
        : Array.isArray(c.movimentacoes)
        ? c.movimentacoes
        : Array.isArray(c.lancamentos)
        ? c.lancamentos
        : Array.isArray(c.registros)
        ? c.registros
        : [];

      const historico = rawHistorico.map((tx: any, tIdx: number) => {
        const rawTipo = String(tx.tipo || tx.type || tx.operacao || 'deposito').toLowerCase();
        const isResgate =
          rawTipo.includes('resgat') ||
          rawTipo.includes('saqu') ||
          rawTipo.includes('said') ||
          rawTipo.includes('retir') ||
          rawTipo === '-';
        const isRendimento = rawTipo.includes('rend');
        return {
          id: String(tx.id || `tx_${idx}_${tIdx}_${Date.now()}`),
          tipo: (isResgate ? 'resgate' : isRendimento ? 'rendimento' : 'deposito') as
            | 'deposito'
            | 'resgate'
            | 'rendimento',
          valor: parseNumericVal(tx.valor ?? tx.quantia ?? tx.amount ?? 0),
          data: tx.data || tx.dataHora || tx.criadoEm || tx.date || new Date().toISOString(),
          descricao: tx.descricao || tx.obs || tx.motivo || tx.titulo || undefined,
        };
      });

      let saldo = parseNumericVal(
        c.saldo ?? c.valorAtual ?? c.valor ?? c.guardado ?? c.valorGuardado ?? c.total ?? c.quantia ?? 0
      );
      if (saldo === 0 && historico.length > 0) {
        saldo = historico.reduce(
          (acc: number, t: any) => (t.tipo === 'resgate' ? acc - t.valor : acc + t.valor),
          0
        );
      }

      const metaVal = parseNumericVal(c.meta ?? c.valorMeta ?? c.objetivo ?? c.valorObjetivo ?? c.alvo ?? 0);

      return {
        id,
        nome,
        categoria,
        cor: c.cor || undefined,
        icone: c.icone || c.emoji || undefined,
        saldo: Math.max(0, saldo),
        meta: metaVal > 0 ? metaVal : undefined,
        prazoMeta: c.prazoMeta || c.prazo || c.dataMeta || c.vencimento || undefined,
        rendimentoMensalPct: parseNumericVal(c.rendimentoMensalPct ?? c.cdi ?? c.rendimento ?? 1.0) || 1.0,
        historico,
        dataCriacao: c.dataCriacao || c.criadoEm || c.data || new Date().toISOString(),
        observacoes: c.observacoes || c.obs || c.notas || undefined,
      };
    });
}

export async function fetchFullCaixinhasHistoryFromFirebase(uid: string): Promise<Caixinha[]> {
  let combined: Caixinha[] = [];
  if (!db || !uid) return combined;

  const mergeCaixinhas = (incoming: Caixinha[]) => {
    if (!incoming || incoming.length === 0) return;
    const map = new Map<string, Caixinha>();
    combined.forEach((c) => map.set(c.id || c.nome.toLowerCase(), c));
    incoming.forEach((c) => {
      const key = c.id || c.nome.toLowerCase();
      const existing = map.get(key) || Array.from(map.values()).find((x) => x.nome.toLowerCase() === c.nome.toLowerCase());
      if (!existing) {
        map.set(key, c);
      } else {
        // Mantém o que tiver maior histórico ou saldo atualizado
        const existingHistLen = existing.historico?.length || 0;
        const incomingHistLen = c.historico?.length || 0;
        if (incomingHistLen > existingHistLen || (c.saldo > 0 && existing.saldo === 0)) {
          map.set(existing.id || key, { ...existing, ...c, id: existing.id || c.id });
        }
      }
    });
    combined = Array.from(map.values());
  };

  const checkDoc = async (col: string, docId: string) => {
    try {
      const snap = await getDoc(doc(db, col, docId));
      if (snap.exists()) {
        if (col === 'dados_caixinhas_agenda') matchedCaixinhasAgendaDocIds.add(snap.id);
        mergeCaixinhas(normalizeCaixinhasData(snap.data()));
      }
    } catch {}
  };

  // 1. Prioridade máxima: dados_caixinhas_agenda (doc do uid e varredura da coleção)
  await checkDoc('dados_caixinhas_agenda', uid);
  try {
    const colSnap = await getDocs(collection(db, 'dados_caixinhas_agenda'));
    colSnap.forEach((d) => {
      matchedCaixinhasAgendaDocIds.add(d.id);
      mergeCaixinhas(normalizeCaixinhasData(d.data()));
    });
  } catch {}

  // 2. Outras coleções compatíveis
  await checkDoc('dados_caixinhas', uid);
  await checkDoc('caixinhas', uid);
  await checkDoc('caixas', uid);
  await checkDoc('dados_financeiros', uid);

  const email = auth?.currentUser?.email?.toLowerCase().trim();
  if (email) {
    await checkDoc('dados_caixinhas_agenda', email);
    await checkDoc('dados_caixinhas', email);
  }

  return combined;
}

export async function reloadCaixinhasHistoryFromFirebase(uid: string): Promise<Caixinha[]> {
  const full = await fetchFullCaixinhasHistoryFromFirebase(uid);
  try {
    localStorage.setItem('sutello_caixinhas', JSON.stringify(full));
  } catch {}
  return full;
}

export function subscribeToCaixinhasData(
  uid: string,
  onData: (caixinhas: Caixinha[]) => void
) {
  if (!db || !uid) return () => {};
  try {
    let currentList: Caixinha[] = [];

    const handleIncomingSnapshot = (data: any, docId?: string) => {
      if (docId) matchedCaixinhasAgendaDocIds.add(docId);
      const parsed = normalizeCaixinhasData(data);
      if (parsed.length > 0 || currentList.length === 0) {
        currentList = parsed;
        onData(parsed);
        try {
          localStorage.setItem('sutello_caixinhas', JSON.stringify(parsed));
        } catch {}
      }
    };

    // 1. Escuta em tempo real em dados_caixinhas_agenda (local principal informado pelo usuário)
    const mainRef = doc(db, 'dados_caixinhas_agenda', uid);
    const unsubMain = onSnapshot(
      mainRef,
      { includeMetadataChanges: true },
      (snapshot) => {
        if (snapshot.exists()) {
          handleIncomingSnapshot(snapshot.data(), snapshot.id);
        }
      },
      (err) => {
        console.warn('Erro ao escutar dados_caixinhas_agenda:', err);
      }
    );

    // 2. Escuta também a coleção dados_caixinhas_agenda inteira (caso o doc tenha ID diferente do uid)
    let unsubCol = () => {};
    try {
      unsubCol = onSnapshot(
        collection(db, 'dados_caixinhas_agenda'),
        (colSnap) => {
          if (!colSnap.empty) {
            let allFromCol: Caixinha[] = [];
            colSnap.forEach((d) => {
              matchedCaixinhasAgendaDocIds.add(d.id);
              const list = normalizeCaixinhasData(d.data());
              if (list.length > 0) {
                allFromCol = [...allFromCol, ...list];
              }
            });
            if (allFromCol.length > 0) {
              // Remove duplicatas por id
              const unique = Array.from(new Map(allFromCol.map((item) => [item.id, item])).values());
              currentList = unique;
              onData(unique);
              try {
                localStorage.setItem('sutello_caixinhas', JSON.stringify(unique));
              } catch {}
            }
          }
        },
        () => {}
      );
    } catch {}

    // 3. Reconciliação completa em background
    setTimeout(async () => {
      try {
        const full = await fetchFullCaixinhasHistoryFromFirebase(uid);
        if (full.length > currentList.length) {
          currentList = full;
          onData(full);
          try {
            localStorage.setItem('sutello_caixinhas', JSON.stringify(full));
          } catch {}
        }
      } catch {}
    }, 350);

    return () => {
      unsubMain();
      unsubCol();
    };
  } catch (err) {
    console.warn('Falha no snapshot de dados_caixinhas_agenda:', err);
    return () => {};
  }
}

export async function saveCaixinhasToCloud(
  uid: string,
  caixinhas: Caixinha[]
): Promise<boolean> {
  const safeData = sanitizeForFirestore(caixinhas || []);
  // Formato híbrido 100% compatível com 'caixas' e 'caixinhas'
  const compatibleCaixas = (safeData || []).map((c: any) => ({
    ...c,
    id: c.id,
    nome: c.nome,
    titulo: c.nome,
    saldo: c.saldo || 0,
    valor: c.saldo || 0,
    valorAtual: c.saldo || 0,
    guardado: c.saldo || 0,
    meta: c.meta || 0,
    valorMeta: c.meta || 0,
    historico: c.historico || [],
    transacoes: c.historico || [],
  }));

  try {
    localStorage.setItem('sutello_caixinhas', JSON.stringify(safeData));
  } catch {}

  if (!db || !uid) return true;
  try {
    const payload = {
      caixas: compatibleCaixas,
      caixinhas: compatibleCaixas,
      ultimaAtualizacao: new Date().toISOString(),
    };

    // 1. Grava no local principal: dados_caixinhas_agenda/{uid}
    const caixinhasAgendaRef = doc(db, 'dados_caixinhas_agenda', uid);
    await setDoc(caixinhasAgendaRef, payload, { merge: true });

    // Se havia outro doc pré-existente em dados_caixinhas_agenda, atualiza também mantendo merge
    for (const docId of Array.from(matchedCaixinhasAgendaDocIds)) {
      if (docId && docId !== uid) {
        try {
          await setDoc(doc(db, 'dados_caixinhas_agenda', docId), payload, { merge: true });
        } catch {}
      }
    }

    // 2. Espelha em dados_caixinhas e dados_financeiros para segurança extra
    try {
      const caixinhaRef = doc(db, 'dados_caixinhas', uid);
      await setDoc(caixinhaRef, payload, { merge: true });
    } catch {}

    try {
      const financeiroRef = doc(db, 'dados_financeiros', uid);
      await setDoc(financeiroRef, { caixinhas: compatibleCaixas, caixas: compatibleCaixas }, { merge: true });
    } catch {}

    return true;
  } catch (err) {
    console.warn('Erro ao salvar caixinhas em dados_caixinhas_agenda:', err);
    return false;
  }
}

// ==========================================
// ❤️ MÓDULO SAÚDE & BEM-ESTAR
// ==========================================

export function normalizeSaudeData(data: any): DadosSaude {
  if (!data || typeof data !== 'object') {
    return { medicamentos: [], consultas: [], metricas: [], historicoPesoAltura: [] };
  }

  // Se houver sub-objeto saude dentro do documento (ex: em dados_caixinhas_agenda)
  const source = data.saude && typeof data.saude === 'object' && !Array.isArray(data.saude)
    ? { ...data, ...data.saude }
    : data;

  // 1. Extração robusta de histórico Peso x Altura (suporta múltiplos formatos e nomes de chave)
  const rawPesos = Array.isArray(source.historicoPesoAltura)
    ? source.historicoPesoAltura
    : Array.isArray(source.pesoxaltura)
    ? source.pesoxaltura
    : Array.isArray(source.pesoAltura)
    ? source.pesoAltura
    : Array.isArray(source.historicoPeso)
    ? source.historicoPeso
    : Array.isArray(source.pesos)
    ? source.pesos
    : Array.isArray(source.registrosPeso)
    ? source.registrosPeso
    : Array.isArray(source.registros)
    ? source.registros
    : [];

  const historicoPesoAltura: RegistroPesoAltura[] = rawPesos.map((p: any, idx: number) => {
    const id = String(p.id || `peso_${idx}_${Date.now()}`);
    const pessoa = p.pessoa || p.nomePessoa || p.paciente || p.nome || p.usuario || p.pagador || undefined;
    const peso = parseFloat(String(p.peso || p.valor || p.pesoKg || 0).replace(',', '.')) || 0;
    let altura = parseFloat(String(p.altura || p.alt || p.alturaM || 0).replace(',', '.')) || 0;
    if (altura > 3) altura = altura / 100; // Converte cm para metros (ex: 175 -> 1.75)
    let imc = parseFloat(String(p.imc || 0).replace(',', '.')) || 0;
    if (imc <= 0 && peso > 0 && altura > 0) {
      imc = Number((peso / (altura * altura)).toFixed(1));
    }
    let classificacao = p.classificacao || p.status || '';
    if (!classificacao && imc > 0) {
      if (imc < 18.5) classificacao = 'Abaixo do peso';
      else if (imc < 25) classificacao = 'Peso normal';
      else if (imc < 30) classificacao = 'Sobrepeso';
      else if (imc < 35) classificacao = 'Obesidade Grau I';
      else if (imc < 40) classificacao = 'Obesidade Grau II';
      else classificacao = 'Obesidade Grau III';
    }
    return {
      id,
      pessoa: pessoa ? String(pessoa).trim() : undefined,
      peso,
      altura,
      imc,
      classificacao: classificacao || 'Peso normal',
      data: p.data || p.dataHora || p.dataCriacao || new Date().toISOString().split('T')[0],
      hora: p.hora || undefined,
      observacoes: p.observacoes || p.obs || p.nota || undefined,
      metaPeso: p.metaPeso !== undefined ? parseFloat(String(p.metaPeso).replace(',', '.')) : undefined,
    };
  });

  // Se tiver peso e altura no nível raiz e ainda não estiver no histórico
  if ((source.peso || source.pesoAtual) && historicoPesoAltura.length === 0) {
    const peso = parseFloat(String(source.peso || source.pesoAtual || 0).replace(',', '.')) || 0;
    let altura = parseFloat(String(source.altura || source.alturaAtual || 0).replace(',', '.')) || 0;
    if (altura > 3) altura = altura / 100;
    if (peso > 0) {
      const imc = altura > 0 ? Number((peso / (altura * altura)).toFixed(1)) : 0;
      historicoPesoAltura.push({
        id: 'peso_root_' + Date.now(),
        pessoa: source.pessoa || source.nomePessoa || undefined,
        peso,
        altura,
        imc,
        classificacao: imc > 0 && imc < 25 ? 'Peso normal' : imc >= 25 ? 'Sobrepeso' : 'Abaixo do peso',
        data: source.dataPeso || source.data || new Date().toISOString().split('T')[0],
      });
    }
  }

  // 2. Extração de Medicamentos
  const rawMeds = Array.isArray(source.medicamentos)
    ? source.medicamentos
    : Array.isArray(source.remedios)
    ? source.remedios
    : [];
  const medicamentos: MedicamentoSaude[] = rawMeds.map((m: any, idx: number) => ({
    id: String(m.id || `med_${idx}_${Date.now()}`),
    nome: String(m.nome || m.medicamento || 'Medicamento').trim(),
    dosagem: String(m.dosagem || m.dose || '1 dose').trim(),
    horarios: Array.isArray(m.horarios) ? m.horarios : (m.horario ? [String(m.horario)] : ['08:00']),
    frequencia: String(m.frequencia || 'Diário').trim(),
    lembreteAtivo: m.lembreteAtivo !== false,
    tomadoHoje: m.tomadoHoje || {},
    instrucoes: m.instrucoes || m.obs || undefined,
    estoqueAtual: m.estoqueAtual !== undefined ? Number(m.estoqueAtual) : undefined,
  }));

  // 3. Extração de Consultas e Exames
  const rawCons = Array.isArray(source.consultas)
    ? source.consultas
    : Array.isArray(source.exames)
    ? source.exames
    : Array.isArray(source.agendamentos)
    ? source.agendamentos
    : [];
  const consultas: ConsultaExameSaude[] = rawCons.map((c: any, idx: number) => ({
    id: String(c.id || `cons_${idx}_${Date.now()}`),
    tipo: (c.tipo === 'exame' || c.tipo === 'retorno' || c.tipo === 'procedimento') ? c.tipo : 'consulta',
    titulo: String(c.titulo || c.especialidade || c.nome || 'Consulta').trim(),
    medicoOuLocal: String(c.medicoOuLocal || c.medico || c.local || c.clinica || 'Consultório').trim(),
    data: c.data || c.dataConsulta || new Date().toISOString().split('T')[0],
    hora: c.hora || c.horario || undefined,
    status: c.status || (c.realizada ? 'realizado' : 'agendado'),
    valor: c.valor ? parseFloat(String(c.valor).replace(',', '.')) : undefined,
    anotacoes: c.anotacoes || c.obs || undefined,
  }));

  // 4. Extração de Métricas (Pressão, Glicose, etc.)
  const rawMet = Array.isArray(source.metricas) ? source.metricas : [];
  const metricas: MetricaSaude[] = rawMet.map((met: any, idx: number) => ({
    id: String(met.id || `met_${idx}_${Date.now()}`),
    tipo: met.tipo || 'pressao',
    rotulo: met.rotulo || met.nome || 'Métrica',
    valor: String(met.valor || '0'),
    unidade: met.unidade || '',
    data: met.data || new Date().toISOString().split('T')[0],
    hora: met.hora || undefined,
    observacoes: met.observacoes || met.obs || undefined,
  }));

  // 5. Perfil de Saúde & Emergência & Metas
  const perfil = source.perfilSaude || {};
  const metaPeso = source.metaPeso !== undefined
    ? parseFloat(String(source.metaPeso).replace(',', '.'))
    : perfil.metaPeso !== undefined
    ? parseFloat(String(perfil.metaPeso).replace(',', '.'))
    : undefined;

  const perfilSaude = {
    tipoSanguineo: perfil.tipoSanguineo || source.tipoSanguineo || '',
    convenio: perfil.convenio || source.convenio || '',
    numeroConvenio: perfil.numeroConvenio || source.numeroConvenio || '',
    alergias: perfil.alergias || source.alergias || '',
    contatoEmergenciaNome: perfil.contatoEmergenciaNome || source.contatoEmergenciaNome || '',
    contatoEmergenciaTelefone: perfil.contatoEmergenciaTelefone || source.contatoEmergenciaTelefone || '',
    metaPeso,
    alturaPadrao: perfil.alturaPadrao || source.alturaPadrao || (historicoPesoAltura[0]?.altura) || undefined,
    sexo: perfil.sexo || source.sexo || undefined,
    idade: perfil.idade || source.idade || undefined,
  };

  return {
    medicamentos,
    consultas,
    metricas,
    historicoPesoAltura,
    metaPeso,
    perfilSaude,
  };
}

/**
 * Busca profunda e reconciliação de todo o histórico de saúde já salvo no Firebase
 * (busca em dados_saude, dados_caixinhas_agenda, saude, pesoxaltura, dados_pesoxaltura, historico_peso, usuarios e subcoleções)
 */
export async function fetchFullSaudeHistoryFromFirebase(uid: string): Promise<DadosSaude> {
  let combined: DadosSaude = { medicamentos: [], consultas: [], metricas: [], historicoPesoAltura: [] };
  if (!db || !uid) return combined;

  const checkDoc = async (col: string, docId: string) => {
    try {
      const snap = await getDoc(doc(db, col, docId));
      if (snap.exists()) {
        const parsed = normalizeSaudeData(snap.data());
        mergeSaude(parsed);
      }
    } catch {}
  };

  const checkCollectionDocs = async (col: string) => {
    try {
      const colSnap = await getDocs(collection(db, col));
      colSnap.forEach((d) => {
        mergeSaude(normalizeSaudeData(d.data()));
      });
    } catch {}
  };

  const checkSubcollection = async (parentCol: string, parentId: string, subCol: string) => {
    try {
      const snap = await getDocs(collection(db, parentCol, parentId, subCol));
      if (!snap.empty) {
        const items: any[] = [];
        snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
        if (subCol.includes('peso') || subCol.includes('altura')) {
          mergeSaude(normalizeSaudeData({ pesoxaltura: items }));
        } else if (subCol.includes('med')) {
          mergeSaude(normalizeSaudeData({ medicamentos: items }));
        } else if (subCol.includes('cons') || subCol.includes('exame')) {
          mergeSaude(normalizeSaudeData({ consultas: items }));
        }
      }
    } catch {}
  };

  const mergeSaude = (incoming: DadosSaude) => {
    // Mescla histórico de pesos sem duplicatas
    const existingPesos = combined.historicoPesoAltura || [];
    const existingPesoKeys = new Set(
      existingPesos.map((p) => `${p.id}_${p.data}_${p.peso}_${p.pessoa || ''}`)
    );
    const newPesos = (incoming.historicoPesoAltura || []).filter(
      (p) => !existingPesoKeys.has(`${p.id}_${p.data}_${p.peso}_${p.pessoa || ''}`) && !existingPesos.some((x) => x.id === p.id)
    );

    // Mescla medicamentos
    const existingMeds = combined.medicamentos || [];
    const existingMedKeys = new Set(existingMeds.map((m) => m.id || m.nome.toLowerCase()));
    const newMeds = (incoming.medicamentos || []).filter(
      (m) => !existingMedKeys.has(m.id) && !existingMedKeys.has(m.nome.toLowerCase())
    );

    // Mescla consultas
    const existingCons = combined.consultas || [];
    const existingConsKeys = new Set(existingCons.map((c) => c.id || `${c.titulo}_${c.data}`));
    const newCons = (incoming.consultas || []).filter(
      (c) => !existingConsKeys.has(c.id) && !existingConsKeys.has(`${c.titulo}_${c.data}`)
    );

    // Mescla métricas
    const existingMet = combined.metricas || [];
    const existingMetKeys = new Set(existingMet.map((m) => m.id));
    const newMet = (incoming.metricas || []).filter((m) => !existingMetKeys.has(m.id));

    combined = {
      medicamentos: [...existingMeds, ...newMeds],
      consultas: [...existingCons, ...newCons],
      metricas: [...existingMet, ...newMet],
      historicoPesoAltura: [...existingPesos, ...newPesos],
      metaPeso: combined.metaPeso || incoming.metaPeso,
      perfilSaude: {
        ...(incoming.perfilSaude || {}),
        ...(combined.perfilSaude || {}),
      },
    };
  };

  // 1. Coleções principais e dados_caixinhas_agenda
  await checkDoc('dados_saude', uid);
  await checkDoc('dados_caixinhas_agenda', uid);
  await checkDoc('saude', uid);
  await checkDoc('pesoxaltura', uid);
  await checkDoc('dados_pesoxaltura', uid);
  await checkDoc('historico_peso', uid);
  await checkDoc('peso_altura', uid);
  await checkDoc('usuarios', uid);

  await checkCollectionDocs('dados_caixinhas_agenda');
  await checkCollectionDocs('dados_saude');
  await checkCollectionDocs('pesoxaltura');

  // 2. Doc financeiro com campo saude/pesoxaltura
  try {
    const finSnap = await getDoc(doc(db, 'dados_financeiros', uid));
    if (finSnap.exists()) {
      const finData = finSnap.data();
      if (finData.saude) mergeSaude(normalizeSaudeData(finData.saude));
      if (finData.pesoxaltura) mergeSaude(normalizeSaudeData({ pesoxaltura: finData.pesoxaltura }));
      if (finData.historicoPesoAltura) mergeSaude(normalizeSaudeData({ historicoPesoAltura: finData.historicoPesoAltura }));
    }
  } catch {}

  // 3. Documentos por e-mail caso usuário esteja logado
  const email = auth?.currentUser?.email?.toLowerCase().trim();
  if (email) {
    await checkDoc('dados_saude', email);
    await checkDoc('saude', email);
    await checkDoc('pesoxaltura', email);
  }

  // 4. Subcoleções
  await checkSubcollection('dados_saude', uid, 'pesoxaltura');
  await checkSubcollection('saude', uid, 'pesoxaltura');
  await checkSubcollection('usuarios', uid, 'pesoxaltura');
  await checkSubcollection('usuarios', uid, 'historico_peso');
  await checkSubcollection('usuarios', uid, 'medicamentos');
  await checkSubcollection('usuarios', uid, 'consultas');

  return combined;
}

export function subscribeToSaudeData(
  uid: string,
  onData: (dados: DadosSaude) => void
) {
  if (!db || !uid) return () => {};
  try {
    let currentData: DadosSaude = { medicamentos: [], consultas: [], metricas: [], historicoPesoAltura: [] };

    // 1. Escuta em tempo real em 'dados_saude'
    const docRef = doc(db, 'dados_saude', uid);
    const unsub = onSnapshot(
      docRef,
      { includeMetadataChanges: true },
      (snapshot) => {
        if (snapshot.exists()) {
          const parsed = normalizeSaudeData(snapshot.data());
          currentData = parsed;
          onData(parsed);
          try {
            localStorage.setItem('sutello_saude', JSON.stringify(parsed));
          } catch {}
        }
      },
      (err) => {
        console.warn('Aviso: dados_saude snapshot:', err);
      }
    );

    // 2. Reconciliação imediata com todo histórico pregresso do Firebase
    setTimeout(async () => {
      try {
        const fullHistory = await fetchFullSaudeHistoryFromFirebase(uid);
        const hasExtraPesos = (fullHistory.historicoPesoAltura?.length || 0) > (currentData.historicoPesoAltura?.length || 0);
        const hasExtraMeds = (fullHistory.medicamentos?.length || 0) > (currentData.medicamentos?.length || 0);
        const hasExtraCons = (fullHistory.consultas?.length || 0) > (currentData.consultas?.length || 0);

        if (hasExtraPesos || hasExtraMeds || hasExtraCons) {
          // Ordena pesos pelo mais recente primeiro
          const ordenados = (fullHistory.historicoPesoAltura || []).slice().sort((a, b) => {
            const dataA = a.data + (a.hora ? 'T' + a.hora : 'T00:00:00');
            const dataB = b.data + (b.hora ? 'T' + b.hora : 'T00:00:00');
            return dataB.localeCompare(dataA);
          });
          fullHistory.historicoPesoAltura = ordenados;
          currentData = fullHistory;
          onData(fullHistory);
          try {
            localStorage.setItem('sutello_saude', JSON.stringify(fullHistory));
          } catch {}
        }
      } catch (e) {
        console.warn('Aviso ao sincronizar histórico completo de saúde:', e);
      }
    }, 400);

    return unsub;
  } catch (err) {
    console.warn('Falha no snapshot de dados_saude:', err);
    return () => {};
  }
}

export async function reloadSaudeHistoryFromFirebase(uid: string): Promise<DadosSaude> {
  const full = await fetchFullSaudeHistoryFromFirebase(uid);
  try {
    localStorage.setItem('sutello_saude', JSON.stringify(full));
  } catch {}
  return full;
}

export async function saveSaudeToCloud(
  uid: string,
  dados: DadosSaude
): Promise<boolean> {
  const safeData = sanitizeForFirestore(dados || { medicamentos: [], consultas: [], metricas: [], historicoPesoAltura: [] });
  try {
    localStorage.setItem('sutello_saude', JSON.stringify(safeData));
  } catch {}

  if (!db || !uid) return true;
  try {
    // 1. Grava na coleção dedicada dados_saude
    const saudeRef = doc(db, 'dados_saude', uid);
    await setDoc(saudeRef, { ...safeData, ultimaAtualizacao: new Date().toISOString() }, { merge: true });

    // 2. Grava também em dados_caixinhas_agenda para manter unificado
    try {
      const caixinhasAgendaRef = doc(db, 'dados_caixinhas_agenda', uid);
      await setDoc(
        caixinhasAgendaRef,
        {
          saude: safeData,
          pesoxaltura: safeData.historicoPesoAltura || [],
        },
        { merge: true }
      );
    } catch {}

    // 3. Grava também na coleção legada 'saude' para compatibilidade bilateral
    try {
      const saudeLegadoRef = doc(db, 'saude', uid);
      await setDoc(saudeLegadoRef, safeData, { merge: true });
    } catch {}

    // 4. Grava também em 'pesoxaltura' caso haja histórico de peso
    if (safeData.historicoPesoAltura && safeData.historicoPesoAltura.length > 0) {
      try {
        const pesoRef = doc(db, 'pesoxaltura', uid);
        await setDoc(pesoRef, {
          pesoxaltura: safeData.historicoPesoAltura,
          pesoAtual: safeData.historicoPesoAltura[0]?.peso,
          alturaAtual: safeData.historicoPesoAltura[0]?.altura,
          imc: safeData.historicoPesoAltura[0]?.imc,
          metaPeso: safeData.metaPeso,
          ultimaAtualizacao: new Date().toISOString(),
        }, { merge: true });
      } catch {}
    }

    // 5. Espelha em dados_financeiros
    try {
      const financeiroRef = doc(db, 'dados_financeiros', uid);
      await setDoc(financeiroRef, { saude: safeData }, { merge: true });
    } catch {}

    return true;
  } catch (err) {
    console.warn('Erro ao salvar dados de saúde no Firestore:', err);
    return false;
  }
}

// ==========================================
// 📝 MÓDULO NOTAS & LEMBRETES (AGENDA - dados_caixinhas_agenda)
// ==========================================

export function normalizeAgendaData(data: any): DadosAgenda {
  if (!data || typeof data !== 'object') {
    return { itens: [], notas: [] };
  }

  // Suporta caso data.agenda seja um objeto aninhado (ex: { itens: [...], notas: [...] }) ou um array direto
  const nestedAgendaObj =
    data.agenda && typeof data.agenda === 'object' && !Array.isArray(data.agenda)
      ? data.agenda
      : data.dadosAgenda && typeof data.dadosAgenda === 'object' && !Array.isArray(data.dadosAgenda)
      ? data.dadosAgenda
      : null;

  // 1. Extração robusta de Itens / Compromissos / Lembretes / Tarefas
  let rawItens: any[] = [];
  if (Array.isArray(data.agenda)) {
    rawItens = data.agenda;
  } else if (Array.isArray(data.itens)) {
    rawItens = data.itens;
  } else if (nestedAgendaObj) {
    rawItens =
      nestedAgendaObj.itens ||
      nestedAgendaObj.agenda ||
      nestedAgendaObj.compromissos ||
      nestedAgendaObj.lembretes ||
      nestedAgendaObj.tarefas ||
      [];
  } else if (Array.isArray(data.lembretes)) {
    rawItens = data.lembretes;
  } else if (Array.isArray(data.compromissos)) {
    rawItens = data.compromissos;
  } else if (Array.isArray(data.tarefas)) {
    rawItens = data.tarefas;
  } else if (data.agenda && typeof data.agenda === 'object') {
    rawItens = Object.entries(data.agenda).map(([k, v]: [string, any]) =>
      typeof v === 'object' && v !== null ? { id: k, ...v } : { id: k, titulo: String(v) }
    );
  }

  // Se houver tanto data.agenda (array) quanto data.itens (array), combina ambos
  if (Array.isArray(data.agenda) && Array.isArray(data.itens) && data.agenda !== data.itens) {
    rawItens = [...data.agenda, ...data.itens];
  }

  const notasExtraidasDeAgenda: NotaRapida[] = [];

  const itens: ItemAgenda[] = rawItens
    .filter((it) => it && (typeof it === 'object' || typeof it === 'string'))
    .map((it: any, idx: number) => {
      if (typeof it === 'string') {
        return {
          id: `agenda_${idx}_${Date.now()}`,
          tipo: 'lembrete' as const,
          titulo: it,
          data: new Date().toISOString().split('T')[0],
          prioridade: 'media' as const,
          concluido: false,
          categoria: 'geral' as const,
        };
      }

      // Se um item dentro do array agenda for explicitamente uma nota rápida sem data
      if (
        (it.tipo === 'nota' || it.tipo === 'anotacao') &&
        !it.data &&
        !it.vencimento &&
        (it.conteudo || it.texto)
      ) {
        notasExtraidasDeAgenda.push({
          id: String(it.id || `nota_ag_${idx}_${Date.now()}`),
          titulo: String(it.titulo || it.nome || 'Anotação').trim(),
          conteudo: String(it.conteudo || it.texto || it.descricao || '').trim(),
          cor: it.cor || 'roxo',
          fixada: Boolean(it.fixada),
          dataAtualizacao: it.dataAtualizacao || new Date().toISOString(),
        });
      }

      const id = String(it.id || `agenda_${idx}_${Date.now()}`);
      const titulo = String(
        it.titulo || it.compromisso || it.nome || it.texto || it.assunto || it.descricao || 'Compromisso'
      ).trim();

      let dataComp = String(
        it.data || it.vencimento || it.dataVencimento || it.dataCompromisso || it.dia || ''
      ).trim();
      if (!dataComp) {
        dataComp = new Date().toISOString().split('T')[0];
      } else if (dataComp.includes('/')) {
        const parts = dataComp.split('/');
        if (parts.length === 3) {
          dataComp = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      } else if (dataComp.includes('T')) {
        dataComp = dataComp.split('T')[0];
      }

      const hora = it.hora || it.horario || undefined;
      const prioRaw = String(it.prioridade || 'media').toLowerCase();
      const prioridade: ItemAgenda['prioridade'] =
        prioRaw === 'baixa' || prioRaw === 'alta' || prioRaw === 'urgente' ? prioRaw : 'media';
      const concluido = Boolean(it.concluido || it.feito || it.pago || it.finalizado || it.status === 'concluido');
      const categoria = it.categoria || 'geral';
      const descricao = it.descricao || it.obs || it.detalhes || it.observacoes || undefined;
      const pessoa =
        it.pessoa || it.responsavel || it.pagador || it.quem || it.nomePessoa || it.usuario || undefined;

      return {
        id,
        tipo: 'lembrete',
        titulo,
        data: dataComp,
        hora,
        prioridade,
        concluido,
        categoria,
        descricao,
        pessoa: pessoa ? String(pessoa).trim() : undefined,
      };
    });

  // 2. Extração robusta de Notas / Anotações
  const rawNotas = Array.isArray(data.notas)
    ? data.notas
    : nestedAgendaObj && Array.isArray(nestedAgendaObj.notas)
    ? nestedAgendaObj.notas
    : Array.isArray(data.anotacoes)
    ? data.anotacoes
    : Array.isArray(data.blocoNotas)
    ? data.blocoNotas
    : Array.isArray(data.recados)
    ? data.recados
    : [];

  const notas: NotaRapida[] = [
    ...notasExtraidasDeAgenda,
    ...rawNotas.map((n: any, idx: number) => {
      if (typeof n === 'string') {
        return {
          id: `nota_${idx}_${Date.now()}`,
          titulo: `Anotação ${idx + 1}`,
          conteudo: n,
          cor: 'roxo',
          fixada: false,
          dataAtualizacao: new Date().toISOString(),
        };
      }
      return {
        id: String(n.id || `nota_${idx}_${Date.now()}`),
        titulo: String(n.titulo || n.nome || 'Sem título').trim(),
        conteudo: String(n.conteudo || n.texto || n.nota || n.descricao || '').trim(),
        cor: n.cor || 'roxo',
        fixada: Boolean(n.fixada),
        dataAtualizacao: n.dataAtualizacao || n.data || new Date().toISOString(),
      };
    }),
  ];

  // Desduplica itens por id ou titulo+data
  const uniqueItensMap = new Map<string, ItemAgenda>();
  itens.forEach((i) => {
    const k = i.id || `${i.titulo}_${i.data}`;
    if (!uniqueItensMap.has(k)) uniqueItensMap.set(k, i);
  });

  return { itens: Array.from(uniqueItensMap.values()), notas };
}

/**
 * Busca profunda e reconciliação de todo o histórico de notas e agenda já salvo no Firebase
 * Priorizando dados_caixinhas_agenda onde ficam salvos agenda e caixas
 */
export async function fetchFullAgendaHistoryFromFirebase(uid: string): Promise<DadosAgenda> {
  let combined: DadosAgenda = { itens: [], notas: [] };
  if (!db || !uid) return combined;

  const checkDoc = async (col: string, docId: string) => {
    try {
      const snap = await getDoc(doc(db, col, docId));
      if (snap.exists()) {
        if (col === 'dados_caixinhas_agenda') matchedCaixinhasAgendaDocIds.add(snap.id);
        const parsed = normalizeAgendaData(snap.data());
        mergeAgenda(parsed);
      }
    } catch {}
  };

  const checkSubcollection = async (parentCol: string, parentId: string, subCol: string) => {
    try {
      const snap = await getDocs(collection(db, parentCol, parentId, subCol));
      if (!snap.empty) {
        const items: any[] = [];
        snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
        if (subCol.includes('nota') || subCol.includes('anotacao')) {
          mergeAgenda(normalizeAgendaData({ notas: items }));
        } else {
          mergeAgenda(normalizeAgendaData({ itens: items }));
        }
      }
    } catch {}
  };

  const mergeAgenda = (incoming: DadosAgenda) => {
    // Mescla itens de agenda sem duplicatas
    const existingItens = combined.itens || [];
    const existingItemKeys = new Set(existingItens.map((i) => i.id || `${i.titulo}_${i.data}`));
    const newItens = (incoming.itens || []).filter(
      (i) => !existingItemKeys.has(i.id) && !existingItemKeys.has(`${i.titulo}_${i.data}`)
    );

    // Mescla notas sem duplicatas
    const existingNotas = combined.notas || [];
    const existingNotaKeys = new Set(existingNotas.map((n) => n.id || n.titulo.toLowerCase()));
    const newNotas = (incoming.notas || []).filter(
      (n) => !existingNotaKeys.has(n.id) && !existingNotaKeys.has(n.titulo.toLowerCase())
    );

    combined = {
      itens: [...existingItens, ...newItens],
      notas: [...existingNotas, ...newNotas],
    };
  };

  // 1. Prioridade Máxima: dados_caixinhas_agenda (doc do uid e toda a coleção)
  await checkDoc('dados_caixinhas_agenda', uid);
  try {
    const colSnap = await getDocs(collection(db, 'dados_caixinhas_agenda'));
    colSnap.forEach((d) => {
      matchedCaixinhasAgendaDocIds.add(d.id);
      mergeAgenda(normalizeAgendaData(d.data()));
    });
  } catch {}

  // 2. Coleções complementares
  await checkDoc('dados_agenda', uid);
  await checkDoc('agenda', uid);
  await checkDoc('dados_notas', uid);
  await checkDoc('notas', uid);
  await checkDoc('lembretes', uid);
  await checkDoc('dados_lembretes', uid);
  await checkDoc('anotacoes', uid);
  await checkDoc('bloco_notas', uid);
  await checkDoc('tarefas', uid);
  await checkDoc('usuarios', uid);

  // 3. Doc financeiro
  try {
    const finSnap = await getDoc(doc(db, 'dados_financeiros', uid));
    if (finSnap.exists()) {
      const finData = finSnap.data();
      if (finData.agenda) mergeAgenda(normalizeAgendaData(finData.agenda));
      if (finData.notas) mergeAgenda(normalizeAgendaData({ notas: finData.notas }));
      if (finData.lembretes) mergeAgenda(normalizeAgendaData({ lembretes: finData.lembretes }));
    }
  } catch {}

  // 4. Documentos por e-mail
  const email = auth?.currentUser?.email?.toLowerCase().trim();
  if (email) {
    await checkDoc('dados_caixinhas_agenda', email);
    await checkDoc('dados_agenda', email);
    await checkDoc('agenda', email);
    await checkDoc('notas', email);
    await checkDoc('lembretes', email);
  }

  // 5. Subcoleções
  await checkSubcollection('dados_caixinhas_agenda', uid, 'agenda');
  await checkSubcollection('dados_caixinhas_agenda', uid, 'itens');
  await checkSubcollection('dados_agenda', uid, 'itens');
  await checkSubcollection('dados_agenda', uid, 'notas');
  await checkSubcollection('agenda', uid, 'itens');
  await checkSubcollection('agenda', uid, 'compromissos');
  await checkSubcollection('notas', uid, 'itens');
  await checkSubcollection('usuarios', uid, 'agenda');
  await checkSubcollection('usuarios', uid, 'notas');

  return combined;
}

export function subscribeToAgendaData(
  uid: string,
  onData: (dados: DadosAgenda) => void
) {
  if (!db || !uid) return () => {};
  try {
    let currentData: DadosAgenda = { itens: [], notas: [] };

    const handleSnapshotData = (raw: any, docId?: string) => {
      if (docId) matchedCaixinhasAgendaDocIds.add(docId);
      const parsed = normalizeAgendaData(raw);
      if (
        (parsed.itens?.length || 0) > 0 ||
        (parsed.notas?.length || 0) > 0 ||
        ((currentData.itens?.length || 0) === 0 && (currentData.notas?.length || 0) === 0)
      ) {
        currentData = parsed;
        onData(parsed);
        try {
          localStorage.setItem('sutello_agenda', JSON.stringify(parsed));
        } catch {}
      }
    };

    // 1. Escuta em tempo real em 'dados_caixinhas_agenda' (local principal)
    const mainRef = doc(db, 'dados_caixinhas_agenda', uid);
    const unsubMain = onSnapshot(
      mainRef,
      { includeMetadataChanges: true },
      (snapshot) => {
        if (snapshot.exists()) {
          handleSnapshotData(snapshot.data(), snapshot.id);
        }
      },
      (err) => {
        console.warn('Aviso: dados_caixinhas_agenda agenda snapshot:', err);
      }
    );

    // 2. Escuta a coleção 'dados_caixinhas_agenda' inteira caso o doc tenha outro ID
    let unsubCol = () => {};
    try {
      unsubCol = onSnapshot(
        collection(db, 'dados_caixinhas_agenda'),
        (colSnap) => {
          if (!colSnap.empty) {
            let mergedItens: ItemAgenda[] = [];
            let mergedNotas: NotaRapida[] = [];
            colSnap.forEach((d) => {
              matchedCaixinhasAgendaDocIds.add(d.id);
              const parsed = normalizeAgendaData(d.data());
              if (parsed.itens.length > 0) mergedItens = [...mergedItens, ...parsed.itens];
              if (parsed.notas.length > 0) mergedNotas = [...mergedNotas, ...parsed.notas];
            });
            if (mergedItens.length > 0 || mergedNotas.length > 0) {
              const uniqueItens = Array.from(
                new Map(mergedItens.map((i) => [i.id || `${i.titulo}_${i.data}`, i])).values()
              );
              const uniqueNotas = Array.from(
                new Map(mergedNotas.map((n) => [n.id || n.titulo, n])).values()
              );
              const result = { itens: uniqueItens, notas: uniqueNotas };
              currentData = result;
              onData(result);
              try {
                localStorage.setItem('sutello_agenda', JSON.stringify(result));
              } catch {}
            }
          }
        },
        () => {}
      );
    } catch {}

    // 3. Reconciliação imediata com todo histórico pregresso de notas e agenda no Firebase
    setTimeout(async () => {
      try {
        const fullHistory = await fetchFullAgendaHistoryFromFirebase(uid);
        const hasExtraItens = (fullHistory.itens?.length || 0) > (currentData.itens?.length || 0);
        const hasExtraNotas = (fullHistory.notas?.length || 0) > (currentData.notas?.length || 0);

        if (hasExtraItens || hasExtraNotas) {
          currentData = fullHistory;
          onData(fullHistory);
          try {
            localStorage.setItem('sutello_agenda', JSON.stringify(fullHistory));
          } catch {}
        }
      } catch (e) {
        console.warn('Aviso ao sincronizar histórico completo de agenda:', e);
      }
    }, 450);

    return () => {
      unsubMain();
      unsubCol();
    };
  } catch (err) {
    console.warn('Falha no snapshot de dados_caixinhas_agenda (agenda):', err);
    return () => {};
  }
}

export async function reloadAgendaHistoryFromFirebase(uid: string): Promise<DadosAgenda> {
  const full = await fetchFullAgendaHistoryFromFirebase(uid);
  try {
    localStorage.setItem('sutello_agenda', JSON.stringify(full));
  } catch {}
  return full;
}

export async function saveAgendaToCloud(
  uid: string,
  dados: DadosAgenda
): Promise<boolean> {
  const safeData = sanitizeForFirestore(dados || { itens: [], notas: [] });
  const compatibleAgendaItens = (safeData.itens || []).map((it: any) => ({
    ...it,
    id: it.id,
    titulo: it.titulo,
    texto: it.titulo,
    nome: it.titulo,
    data: it.data,
    vencimento: it.data,
    hora: it.hora || '',
    horario: it.hora || '',
    concluido: Boolean(it.concluido),
    feito: Boolean(it.concluido),
    pessoa: it.pessoa || 'Leonardo',
    responsavel: it.pessoa || 'Leonardo',
  }));

  try {
    localStorage.setItem('sutello_agenda', JSON.stringify(safeData));
  } catch {}

  if (!db || !uid) return true;
  try {
    const payload = {
      agenda: compatibleAgendaItens,
      itens: compatibleAgendaItens,
      notas: safeData.notas || [],
      dadosAgenda: safeData,
      ultimaAtualizacao: new Date().toISOString(),
    };

    // 1. Grava no local principal: dados_caixinhas_agenda/{uid} (com merge para preservar caixas!)
    const caixinhasAgendaRef = doc(db, 'dados_caixinhas_agenda', uid);
    await setDoc(caixinhasAgendaRef, payload, { merge: true });

    // Atualiza outros docs existentes em dados_caixinhas_agenda mantendo merge
    for (const docId of Array.from(matchedCaixinhasAgendaDocIds)) {
      if (docId && docId !== uid) {
        try {
          await setDoc(doc(db, 'dados_caixinhas_agenda', docId), payload, { merge: true });
        } catch {}
      }
    }

    // 2. Grava também em dados_agenda e agenda para compatibilidade total
    try {
      const agendaRef = doc(db, 'dados_agenda', uid);
      await setDoc(agendaRef, { ...safeData, ultimaAtualizacao: new Date().toISOString() }, { merge: true });
    } catch {}

    try {
      const agendaLegadoRef = doc(db, 'agenda', uid);
      await setDoc(agendaLegadoRef, safeData, { merge: true });
    } catch {}

    // 3. Espelha em dados_financeiros
    try {
      const financeiroRef = doc(db, 'dados_financeiros', uid);
      await setDoc(financeiroRef, { agenda: safeData }, { merge: true });
    } catch {}

    return true;
  } catch (err) {
    console.warn('Erro ao salvar dados de agenda em dados_caixinhas_agenda:', err);
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
