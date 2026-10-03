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
// 📦 MÓDULO CAIXINHAS & COFRINHOS
// ==========================================

export function subscribeToCaixinhasData(
  uid: string,
  onData: (caixinhas: Caixinha[]) => void
) {
  if (!db || !uid) return () => {};
  try {
    const docRef = doc(db, 'dados_caixinhas', uid);
    return onSnapshot(
      docRef,
      { includeMetadataChanges: true },
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const list = Array.isArray(data.caixinhas) ? data.caixinhas : [];
          onData(list);
          try {
            localStorage.setItem('sutello_caixinhas', JSON.stringify(list));
          } catch {}
        } else {
          // Tenta ler de dados_financeiros como fallback
          try {
            const financeiroRef = doc(db, 'dados_financeiros', uid);
            getDoc(financeiroRef).then((finSnap) => {
              if (finSnap.exists()) {
                const finData = finSnap.data();
                if (Array.isArray(finData.caixinhas) && finData.caixinhas.length > 0) {
                  onData(finData.caixinhas);
                  try {
                    localStorage.setItem('sutello_caixinhas', JSON.stringify(finData.caixinhas));
                  } catch {}
                }
              }
            }).catch(() => {});
          } catch {}
        }
      },
      (err) => {
        console.warn('Erro ao escutar dados_caixinhas:', err);
      }
    );
  } catch (err) {
    console.warn('Falha no snapshot de dados_caixinhas:', err);
    return () => {};
  }
}

export async function saveCaixinhasToCloud(
  uid: string,
  caixinhas: Caixinha[]
): Promise<boolean> {
  const safeData = sanitizeForFirestore(caixinhas || []);
  try {
    localStorage.setItem('sutello_caixinhas', JSON.stringify(safeData));
  } catch {}

  if (!db || !uid) return true;
  try {
    // 1. Grava na coleção dedicada dados_caixinhas
    const caixinhaRef = doc(db, 'dados_caixinhas', uid);
    await setDoc(caixinhaRef, { caixinhas: safeData, ultimaAtualizacao: new Date().toISOString() }, { merge: true });

    // 2. Espelha em dados_financeiros
    try {
      const financeiroRef = doc(db, 'dados_financeiros', uid);
      await setDoc(financeiroRef, { caixinhas: safeData }, { merge: true });
    } catch {}

    return true;
  } catch (err) {
    console.warn('Erro ao salvar caixinhas no Firestore:', err);
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

  // 1. Extração robusta de histórico Peso x Altura
  const rawPesos = Array.isArray(data.historicoPesoAltura)
    ? data.historicoPesoAltura
    : Array.isArray(data.pesoxaltura)
    ? data.pesoxaltura
    : Array.isArray(data.pesoAltura)
    ? data.pesoAltura
    : Array.isArray(data.historicoPeso)
    ? data.historicoPeso
    : Array.isArray(data.pesos)
    ? data.pesos
    : [];

  const historicoPesoAltura: RegistroPesoAltura[] = rawPesos.map((p: any, idx: number) => {
    const id = String(p.id || `peso_${idx}_${Date.now()}`);
    const peso = parseFloat(String(p.peso || p.valor || 0).replace(',', '.')) || 0;
    let altura = parseFloat(String(p.altura || p.alt || 0).replace(',', '.')) || 0;
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
      peso,
      altura,
      imc,
      classificacao: classificacao || 'Peso normal',
      data: p.data || p.dataHora || new Date().toISOString().split('T')[0],
      hora: p.hora || undefined,
      observacoes: p.observacoes || p.obs || undefined,
    };
  });

  // Se tiver peso e altura no nível raiz e ainda não estiver no histórico
  if ((data.peso || data.pesoAtual) && historicoPesoAltura.length === 0) {
    const peso = parseFloat(String(data.peso || data.pesoAtual || 0).replace(',', '.')) || 0;
    let altura = parseFloat(String(data.altura || data.alturaAtual || 0).replace(',', '.')) || 0;
    if (altura > 3) altura = altura / 100;
    if (peso > 0) {
      const imc = altura > 0 ? Number((peso / (altura * altura)).toFixed(1)) : 0;
      historicoPesoAltura.push({
        id: 'peso_root_' + Date.now(),
        peso,
        altura,
        imc,
        classificacao: imc > 0 && imc < 25 ? 'Peso normal' : imc >= 25 ? 'Sobrepeso' : 'Abaixo do peso',
        data: data.dataPeso || new Date().toISOString().split('T')[0],
      });
    }
  }

  // 2. Extração de Medicamentos
  const rawMeds = Array.isArray(data.medicamentos)
    ? data.medicamentos
    : Array.isArray(data.remedios)
    ? data.remedios
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
  const rawCons = Array.isArray(data.consultas)
    ? data.consultas
    : Array.isArray(data.exames)
    ? data.exames
    : Array.isArray(data.agendamentos)
    ? data.agendamentos
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
  const rawMet = Array.isArray(data.metricas) ? data.metricas : [];
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

  // 5. Perfil de Saúde & Emergência
  const perfil = data.perfilSaude || {};
  const perfilSaude = {
    tipoSanguineo: perfil.tipoSanguineo || data.tipoSanguineo || '',
    convenio: perfil.convenio || data.convenio || '',
    numeroConvenio: perfil.numeroConvenio || data.numeroConvenio || '',
    alergias: perfil.alergias || data.alergias || '',
    contatoEmergenciaNome: perfil.contatoEmergenciaNome || data.contatoEmergenciaNome || '',
    contatoEmergenciaTelefone: perfil.contatoEmergenciaTelefone || data.contatoEmergenciaTelefone || '',
  };

  return {
    medicamentos,
    consultas,
    metricas,
    historicoPesoAltura,
    perfilSaude,
  };
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
        console.warn('Aviso: dados_saude:', err);
      }
    );

    // 2. Busca também em 'saude' ou 'dados_financeiros.saude' para recuperar histórico antigo
    setTimeout(async () => {
      try {
        // Checa doc legado 'saude'
        const saudeLegadoRef = doc(db, 'saude', uid);
        const saudeSnap = await getDoc(saudeLegadoRef);
        if (saudeSnap.exists()) {
          const legadoParsed = normalizeSaudeData(saudeSnap.data());
          // Mescla itens que não existem
          const idsPesos = new Set((currentData.historicoPesoAltura || []).map((x) => x.id));
          const novosPesos = (legadoParsed.historicoPesoAltura || []).filter((x) => !idsPesos.has(x.id));
          
          const idsMeds = new Set((currentData.medicamentos || []).map((x) => x.id));
          const novosMeds = (legadoParsed.medicamentos || []).filter((x) => !idsMeds.has(x.id));

          const idsCons = new Set((currentData.consultas || []).map((x) => x.id));
          const novasCons = (legadoParsed.consultas || []).filter((x) => !idsCons.has(x.id));

          if (novosPesos.length > 0 || novosMeds.length > 0 || novasCons.length > 0) {
            currentData = {
              ...currentData,
              historicoPesoAltura: [...(currentData.historicoPesoAltura || []), ...novosPesos],
              medicamentos: [...(currentData.medicamentos || []), ...novosMeds],
              consultas: [...(currentData.consultas || []), ...novasCons],
            };
            onData(currentData);
            try {
              localStorage.setItem('sutello_saude', JSON.stringify(currentData));
            } catch {}
          }
        }

        // Checa se está dentro de dados_financeiros
        const finRef = doc(db, 'dados_financeiros', uid);
        const finSnap = await getDoc(finRef);
        if (finSnap.exists()) {
          const finData = finSnap.data();
          if (finData.saude || finData.pesoxaltura || finData.pesoAltura || finData.historicoSaude) {
            const extraParsed = normalizeSaudeData(finData.saude || finData);
            const idsPesos = new Set((currentData.historicoPesoAltura || []).map((x) => x.id));
            const novosPesos = (extraParsed.historicoPesoAltura || []).filter((x) => !idsPesos.has(x.id));
            if (novosPesos.length > 0) {
              currentData = {
                ...currentData,
                historicoPesoAltura: [...(currentData.historicoPesoAltura || []), ...novosPesos],
              };
              onData(currentData);
              try {
                localStorage.setItem('sutello_saude', JSON.stringify(currentData));
              } catch {}
            }
          }
        }
      } catch (e) {
        console.warn('Aviso ao consultar histórico antigo de saúde:', e);
      }
    }, 500);

    return unsub;
  } catch (err) {
    console.warn('Falha no snapshot de dados_saude:', err);
    return () => {};
  }
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

    // 2. Grava também na coleção legada 'saude' para compatibilidade bilateral
    try {
      const saudeLegadoRef = doc(db, 'saude', uid);
      await setDoc(saudeLegadoRef, safeData, { merge: true });
    } catch {}

    // 3. Espelha em dados_financeiros
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
// 📝 MÓDULO NOTAS & LEMBRETES (AGENDA)
// ==========================================

export function normalizeAgendaData(data: any): DadosAgenda {
  if (!data || typeof data !== 'object') {
    return { itens: [], notas: [] };
  }

  // 1. Extração robusta de Itens / Compromissos / Lembretes / Tarefas
  const rawItens = Array.isArray(data.itens)
    ? data.itens
    : Array.isArray(data.agenda)
    ? data.agenda
    : Array.isArray(data.lembretes)
    ? data.lembretes
    : Array.isArray(data.tarefas)
    ? data.tarefas
    : Array.isArray(data.compromissos)
    ? data.compromissos
    : [];

  const itens: ItemAgenda[] = rawItens.map((it: any, idx: number) => {
    const id = String(it.id || `agenda_${idx}_${Date.now()}`);
    const titulo = String(it.titulo || it.texto || it.nome || it.descricao || 'Lembrete').trim();
    const dataComp = it.data || it.vencimento || it.dataVencimento || new Date().toISOString().split('T')[0];
    const hora = it.hora || it.horario || undefined;
    const prioridade = (it.prioridade === 'baixa' || it.prioridade === 'alta' || it.prioridade === 'urgente') ? it.prioridade : 'media';
    const concluido = Boolean(it.concluido || it.feito || it.pago || it.finalizado);
    const categoria = it.categoria || 'geral';
    const descricao = it.descricao || it.obs || it.detalhes || undefined;

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
    };
  });

  // 2. Extração robusta de Notas / Anotações
  const rawNotas = Array.isArray(data.notas)
    ? data.notas
    : Array.isArray(data.anotacoes)
    ? data.anotacoes
    : Array.isArray(data.blocoNotas)
    ? data.blocoNotas
    : Array.isArray(data.recados)
    ? data.recados
    : [];

  const notas: NotaRapida[] = rawNotas.map((n: any, idx: number) => {
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
  });

  return { itens, notas };
}

export function subscribeToAgendaData(
  uid: string,
  onData: (dados: DadosAgenda) => void
) {
  if (!db || !uid) return () => {};
  try {
    let currentData: DadosAgenda = { itens: [], notas: [] };

    // 1. Escuta em tempo real em 'dados_agenda'
    const docRef = doc(db, 'dados_agenda', uid);
    const unsub = onSnapshot(
      docRef,
      { includeMetadataChanges: true },
      (snapshot) => {
        if (snapshot.exists()) {
          const parsed = normalizeAgendaData(snapshot.data());
          currentData = parsed;
          onData(parsed);
          try {
            localStorage.setItem('sutello_agenda', JSON.stringify(parsed));
          } catch {}
        }
      },
      (err) => {
        console.warn('Aviso: dados_agenda:', err);
      }
    );

    // 2. Busca também em 'agenda', 'dados_notas', 'notas', 'dados_financeiros.agenda' para carregar histórico completo
    setTimeout(async () => {
      try {
        const colecoesToCheck = ['agenda', 'dados_notas', 'notas', 'lembretes'];
        for (const colName of colecoesToCheck) {
          try {
            const colDocRef = doc(db, colName, uid);
            const snap = await getDoc(colDocRef);
            if (snap.exists()) {
              const extraParsed = normalizeAgendaData(snap.data());
              const idsItens = new Set((currentData.itens || []).map((x) => x.id));
              const novosItens = (extraParsed.itens || []).filter((x) => !idsItens.has(x.id));

              const idsNotas = new Set((currentData.notas || []).map((x) => x.id));
              const novasNotas = (extraParsed.notas || []).filter((x) => !idsNotas.has(x.id));

              if (novosItens.length > 0 || novasNotas.length > 0) {
                currentData = {
                  itens: [...(currentData.itens || []), ...novosItens],
                  notas: [...(currentData.notas || []), ...novasNotas],
                };
                onData(currentData);
                try {
                  localStorage.setItem('sutello_agenda', JSON.stringify(currentData));
                } catch {}
              }
            }
          } catch {}
        }

        // Checa dentro de dados_financeiros
        const finRef = doc(db, 'dados_financeiros', uid);
        const finSnap = await getDoc(finRef);
        if (finSnap.exists()) {
          const finData = finSnap.data();
          if (finData.agenda || finData.notas || finData.lembretes) {
            const extraParsed = normalizeAgendaData(finData.agenda || finData);
            const idsItens = new Set((currentData.itens || []).map((x) => x.id));
            const novosItens = (extraParsed.itens || []).filter((x) => !idsItens.has(x.id));
            const idsNotas = new Set((currentData.notas || []).map((x) => x.id));
            const novasNotas = (extraParsed.notas || []).filter((x) => !idsNotas.has(x.id));
            if (novosItens.length > 0 || novasNotas.length > 0) {
              currentData = {
                itens: [...(currentData.itens || []), ...novosItens],
                notas: [...(currentData.notas || []), ...novasNotas],
              };
              onData(currentData);
              try {
                localStorage.setItem('sutello_agenda', JSON.stringify(currentData));
              } catch {}
            }
          }
        }
      } catch (e) {
        console.warn('Aviso ao consultar histórico de agenda:', e);
      }
    }, 600);

    return unsub;
  } catch (err) {
    console.warn('Falha no snapshot de dados_agenda:', err);
    return () => {};
  }
}

export async function saveAgendaToCloud(
  uid: string,
  dados: DadosAgenda
): Promise<boolean> {
  const safeData = sanitizeForFirestore(dados || { itens: [], notas: [] });
  try {
    localStorage.setItem('sutello_agenda', JSON.stringify(safeData));
  } catch {}

  if (!db || !uid) return true;
  try {
    // 1. Grava na coleção dedicada dados_agenda
    const agendaRef = doc(db, 'dados_agenda', uid);
    await setDoc(agendaRef, { ...safeData, ultimaAtualizacao: new Date().toISOString() }, { merge: true });

    // 2. Grava na coleção legada 'agenda'
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
    console.warn('Erro ao salvar dados de agenda no Firestore:', err);
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
