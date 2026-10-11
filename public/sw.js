const CACHE_NAME = "sutello-financeiro-offline-v21";
const BG_DB_NAME = "sutello_bg_notifications_db";
const BG_STORE_NAME = "alerts_state";

// Timer de agendamento em memória do Service Worker para disparos com horário exato
const scheduledTimeouts = new Map();

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-hh512.png",
  "./apple-touch-icon.png"
];

// Utilitários IndexedDB para o Service Worker ler Contas e Lembretes da Agenda em 2º plano (mesmo com o app fechado!)
function openBgDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BG_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(BG_STORE_NAME)) {
        db.createObjectStore(BG_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveBgPayload(payload) {
  try {
    const db = await openBgDB();
    return new Promise((resolve) => {
      const tx = db.transaction(BG_STORE_NAME, "readwrite");
      const store = tx.objectStore(BG_STORE_NAME);
      store.put(payload, "latest_payload");
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

async function loadBgPayload() {
  try {
    const db = await openBgDB();
    return new Promise((resolve) => {
      const tx = db.transaction(BG_STORE_NAME, "readonly");
      const store = tx.objectStore(BG_STORE_NAME);
      const req = store.get("latest_payload");
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function getNotifiedKeysSW() {
  try {
    const db = await openBgDB();
    return new Promise((resolve) => {
      const tx = db.transaction(BG_STORE_NAME, "readonly");
      const store = tx.objectStore(BG_STORE_NAME);
      const req = store.get("notified_keys");
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

async function markNotifiedKeySW(key) {
  try {
    const current = await getNotifiedKeysSW();
    if (!current.includes(key)) {
      const updated = [...current, key].slice(-300);
      const db = await openBgDB();
      await new Promise((resolve) => {
        const tx = db.transaction(BG_STORE_NAME, "readwrite");
        tx.objectStore(BG_STORE_NAME).put(updated, "notified_keys");
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    }
  } catch {}
}

function isoParaBR_SW(iso) {
  if (!iso) return "";
  const parts = String(iso).split("T")[0].split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return iso;
}

// Converte valor do formato REST do Firestore para objeto JS simples
function parseFirestoreValue(val) {
  if (!val || typeof val !== "object") return val;
  if ("stringValue" in val) return val.stringValue;
  if ("integerValue" in val) return Number(val.integerValue);
  if ("doubleValue" in val) return Number(val.doubleValue);
  if ("booleanValue" in val) return Boolean(val.booleanValue);
  if ("nullValue" in val) return null;
  if ("arrayValue" in val) {
    return (val.arrayValue.values || []).map(parseFirestoreValue);
  }
  if ("mapValue" in val) {
    const obj = {};
    const fields = (val.mapValue && val.mapValue.fields) || {};
    for (const k of Object.keys(fields)) {
      obj[k] = parseFirestoreValue(fields[k]);
    }
    return obj;
  }
  return null;
}

// Renova o idToken do Firebase Auth usando o refreshToken quando o app está fechado
async function refreshIdTokenInSW(apiKey, refreshToken) {
  if (!apiKey || !refreshToken) return null;
  try {
    const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`
    });
    if (res.ok) {
      const data = await res.json();
      return data.id_token || null;
    }
  } catch {}
  return null;
}

async function fetchWithFirebaseAuthSW(url, payload) {
  const headers = {};
  if (payload.idToken) {
    headers["Authorization"] = `Bearer ${payload.idToken}`;
  }
  let res = await fetch(url, { headers });
  if ((res.status === 401 || res.status === 403) && payload.refreshToken && payload.apiKey) {
    const newIdToken = await refreshIdTokenInSW(payload.apiKey, payload.refreshToken);
    if (newIdToken) {
      payload.idToken = newIdToken;
      await saveBgPayload(payload);
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${newIdToken}` }
      });
    }
  }
  return res;
}

// Busca diretamente na nuvem Firebase via REST em 2º plano (mesmo com o app fechado!) para usuários logados com e-mail
async function fetchCloudUpdatesInSW(payload) {
  if (!payload || !payload.uid) return payload;
  const projectId = payload.projectId || "sutello-financeiro";
  const apiKey = payload.apiKey || "";
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  const keyParam = apiKey ? `?key=${apiKey}` : "";

  try {
    // 1. Busca transmissões globais (para todos os usuários logados com e-mail no app)
    const globalRes = await fetchWithFirebaseAuthSW(`${baseUrl}/dados_caixinhas_agenda/transmissoes_globais${keyParam}`, payload);
    if (globalRes.ok) {
      const globalJson = await globalRes.json();
      if (globalJson && globalJson.fields && globalJson.fields.transmissoes) {
        const globalTransmissoes = parseFirestoreValue(globalJson.fields.transmissoes) || [];
        if (Array.isArray(globalTransmissoes) && globalTransmissoes.length > 0) {
          const map = new Map();
          globalTransmissoes.forEach((t) => { if (t && t.id) map.set(t.id, t); });
          (payload.transmissoes || []).forEach((t) => { if (t && t.id && !map.has(t.id)) map.set(t.id, t); });
          payload.transmissoes = Array.from(map.values());
        }
      }
    }

    // 1.1 Verifica se há nova Atualização do Aplicativo (OTA Sem Precisar Baixar APK) em dados_caixinhas_agenda/versao_app
    const verRes = await fetchWithFirebaseAuthSW(`${baseUrl}/dados_caixinhas_agenda/versao_app${keyParam}`, payload);
    if (verRes.ok) {
      const verJson = await verRes.json();
      if (verJson && verJson.fields) {
        const remoteVer = parseFirestoreValue(verJson.fields.version) || "";
        const remoteBuild = parseFirestoreValue(verJson.fields.buildId) || "";
        const remoteTitle = parseFirestoreValue(verJson.fields.title) || `🚀 Atualização Disponível (v${remoteVer})!`;
        const remoteNotes = parseFirestoreValue(verJson.fields.notes) || "Nova versão pronta! Toque aqui ou abra as Configurações (⚙️) para atualizar sem baixar APK.";
        if (remoteVer && self.registration && self.registration.showNotification) {
          const notifiedKeys = await getNotifiedKeysSW();
          const keyOta = `sw_ota_update_${remoteVer}_${remoteBuild}`;
          const lastKnownBuild = payload.installedBuildId || "20261010-ota-v380";
          if (remoteBuild && remoteBuild !== lastKnownBuild && !notifiedKeys.includes(keyOta)) {
            await self.registration.showNotification(remoteTitle, {
              body: remoteNotes,
              icon: "./icon-192.png",
              badge: "./icon-192.png",
              tag: `ota_update_${remoteVer}`,
              vibrate: [300, 100, 300],
              requireInteraction: true,
              data: { url: "./?openModal=settings", targetModal: "settings" }
            });
            await markNotifiedKeySW(keyOta);
          }
        }
      }
    }

    // 2. Busca dados financeiros e transmissões da conta logada (dados_financeiros/{uid})
    const finRes = await fetchWithFirebaseAuthSW(`${baseUrl}/dados_financeiros/${payload.uid}${keyParam}`, payload);
    if (finRes.ok) {
      const finJson = await finRes.json();
      if (finJson && finJson.fields) {
        if (finJson.fields.contas) {
          const cloudContas = parseFirestoreValue(finJson.fields.contas);
          if (Array.isArray(cloudContas)) {
            const notifiedKeys = await getNotifiedKeysSW();
            const prevIds = new Set((payload.allContaIds || (payload.contas || []).map((x) => String(x.id))).map(String));
            const prevPaidIds = new Set((payload.paidContaIds || []).map(String));

            if (prevIds.size > 0 && self.registration && self.registration.showNotification) {
              for (const c of cloudContas) {
                if (!c || !c.id || c.oculta) continue;
                const cid = String(c.id);
                const keyNova = `sw_nova_${cid}`;
                if (!prevIds.has(cid) && !notifiedKeys.includes(keyNova)) {
                  await self.registration.showNotification(`🔔 NOVA CONTA: ${c.nome}`, {
                    body: `Vencimento: ${isoParaBR_SW(c.vencimento)} • R$ ${Number(c.valor || 0).toFixed(2).replace(".", ",")}`,
                    icon: "./icon-192.png",
                    badge: "./icon-192.png",
                    tag: `nova_${cid}`,
                    vibrate: [250, 100, 250],
                    data: { url: "./", contaId: c.id }
                  });
                  await markNotifiedKeySW(keyNova);
                } else if (c.paga && !prevPaidIds.has(cid)) {
                  const keyPaga = `sw_paga_${cid}_${c.parcelaAtual || 1}`;
                  if (!notifiedKeys.includes(keyPaga)) {
                    await self.registration.showNotification(`✅ PAGA: ${c.nome}`, {
                      body: `Conta marcada como paga${c.pagador ? ` por ${c.pagador}` : ""}!`,
                      icon: "./icon-192.png",
                      badge: "./icon-192.png",
                      tag: `paga_${cid}`,
                      vibrate: [250, 100, 250],
                      data: { url: "./", contaId: c.id }
                    });
                    await markNotifiedKeySW(keyPaga);
                  }
                }
              }
            }

            payload.allContaIds = cloudContas.filter((c) => c && c.id).map((c) => String(c.id));
            payload.paidContaIds = cloudContas.filter((c) => c && c.id && c.paga).map((c) => String(c.id));
            payload.contas = cloudContas.filter((c) => c && !c.paga && !c.oculta);
          }
        }
        if (finJson.fields.transmissoes) {
          const userTransmissoes = parseFirestoreValue(finJson.fields.transmissoes) || [];
          if (Array.isArray(userTransmissoes)) {
            const map = new Map();
            (payload.transmissoes || []).forEach((t) => { if (t && t.id) map.set(t.id, t); });
            userTransmissoes.forEach((t) => { if (t && t.id && !map.has(t.id)) map.set(t.id, t); });
            payload.transmissoes = Array.from(map.values());
          }
        }
      }
    }

    // 3. Busca caixinhas, agenda e saúde do usuário logado (dados_caixinhas_agenda/{uid})
    const agRes = await fetchWithFirebaseAuthSW(`${baseUrl}/dados_caixinhas_agenda/${payload.uid}${keyParam}`, payload);
    if (agRes.ok) {
      const agJson = await agRes.json();
      if (agJson && agJson.fields) {
        const rawAg = agJson.fields.agenda || agJson.fields.itens;
        if (rawAg) {
          const cloudAgenda = parseFirestoreValue(rawAg);
          if (Array.isArray(cloudAgenda)) {
            payload.agendaItens = cloudAgenda.filter((i) => i && !i.concluido);
          }
        } else if (agJson.fields.agenda_json) {
          try {
            const parsedAg = JSON.parse(parseFirestoreValue(agJson.fields.agenda_json) || "{}");
            if (Array.isArray(parsedAg.itens)) {
              payload.agendaItens = parsedAg.itens.filter((i) => i && !i.concluido);
            }
          } catch {}
        }

        // Caixinhas: verifica se alguma caixinha bateu 100% da meta
        let cloudCaixinhas = null;
        if (agJson.fields.caixinhas) {
          cloudCaixinhas = parseFirestoreValue(agJson.fields.caixinhas);
        } else if (agJson.fields.caixinhas_json) {
          try {
            cloudCaixinhas = JSON.parse(parseFirestoreValue(agJson.fields.caixinhas_json) || "[]");
          } catch {}
        }
        if (Array.isArray(cloudCaixinhas)) {
          payload.caixinhas = cloudCaixinhas;
        }

        // Saúde: busca registros de peso, metas e remédios
        let cloudSaude = null;
        if (agJson.fields.saude) {
          cloudSaude = parseFirestoreValue(agJson.fields.saude);
        } else if (agJson.fields.saude_json) {
          try {
            cloudSaude = JSON.parse(parseFirestoreValue(agJson.fields.saude_json) || "{}");
          } catch {}
        }
        if (cloudSaude && typeof cloudSaude === "object") {
          payload.dadosSaude = cloudSaude;
        }
      }
    }

    await saveBgPayload(payload);
  } catch {
    // Se estiver offline, usa o payload já salvo no IndexedDB
  }
  return payload;
}

// Agenda notificações com TimestampTrigger (quando suportado pelo Android/Chrome) e verifica alertas do dia/véspera/personalizadas em 2º plano
async function checkAndScheduleBackgroundNotifications() {
  if (!self.registration || !self.registration.showNotification) return;

  let payload = await loadBgPayload();
  if (!payload || payload.enabled === false) return;

  // Atualiza dados direto do Firebase para o usuário logado com e-mail mesmo com o app fechado
  payload = await fetchCloudUpdatesInSW(payload);

  const notifiedKeys = await getNotifiedKeysSW();
  const now = new Date();
  const nowMs = now.getTime();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hojeStr = `${yyyy}-${mm}-${dd}`;
  const hojeDate = new Date(hojeStr + "T00:00:00");

  const supportsTrigger = "showTrigger" in Notification.prototype && typeof TimestampTrigger !== "undefined";

  // 0. Verificar e agendar Notificações Personalizadas (Transmissões ADM com ou sem horário programado)
  const transmissoes = Array.isArray(payload.transmissoes) ? payload.transmissoes : [];
  for (const msg of transmissoes) {
    if (!msg || !msg.id || !msg.titulo) continue;
    const keyBroadcast = `sw_broadcast_${msg.id}`;
    if (notifiedKeys.includes(keyBroadcast)) continue;

    const targetTime = typeof msg.timestampAgendado === "number" ? msg.timestampAgendado : (msg.timestamp || nowMs);
    const ageMs = nowMs - targetTime;

    // Ignora mensagens antigas de mais de 48h
    if (ageMs > 1000 * 60 * 60 * 48) continue;

    const prefix = msg.urgencia === "alta" ? "🚨 " : msg.urgencia === "media" ? "📢 " : "💬 ";
    const notifTitle = `${prefix}${msg.titulo}`;
    const actionsList = [];
    if (msg.linkUrl) {
      actionsList.push({ action: "open_link", title: msg.botaoTexto || "Acessar Link" });
    }
    actionsList.push({ action: "open", title: msg.botaoTexto && !msg.linkUrl ? msg.botaoTexto : "Abrir no App" });

    const notifOptions = {
      body: msg.mensagem || "",
      icon: "./icon-192.png",
      badge: "./icon-192.png",
      ...(msg.imagemUrl ? { image: msg.imagemUrl } : {}),
      tag: `adm_broadcast_${msg.id}`,
      vibrate: [300, 120, 300, 120, 400],
      requireInteraction: msg.urgencia === "alta",
      actions: actionsList,
      data: {
        url: msg.linkUrl || (msg.targetModal ? `./?openModal=${msg.targetModal}` : "./"),
        linkUrl: msg.linkUrl,
        botaoTexto: msg.botaoTexto,
        imagemUrl: msg.imagemUrl,
        targetModal: msg.targetModal,
        targetSaudeTab: msg.targetSaudeTab,
        broadcastId: msg.id
      }
    };

    if (targetTime <= nowMs + 1500) {
      // Horário já chegou ou é envio imediato: dispara agora!
      await self.registration.showNotification(notifTitle, notifOptions);
      await markNotifiedKeySW(keyBroadcast);
    } else {
      const delayMs = targetTime - nowMs;
      // 1) Se suportar TimestampTrigger nativo do sistema operacional, agenda no SO
      if (supportsTrigger) {
        try {
          await self.registration.showNotification(notifTitle, {
            ...notifOptions,
            showTrigger: new TimestampTrigger(targetTime)
          });
          await markNotifiedKeySW(keyBroadcast);
        } catch {}
      }
      // 2) Também agenda timer preciso no Service Worker para disparar exatamente no horário escolhido (ótimo para testes e uso em 2º plano)
      if (!scheduledTimeouts.has(keyBroadcast) && delayMs <= 1000 * 60 * 60 * 12) {
        const timerId = setTimeout(async () => {
          scheduledTimeouts.delete(keyBroadcast);
          const currentKeys = await getNotifiedKeysSW();
          if (!currentKeys.includes(keyBroadcast)) {
            await self.registration.showNotification(notifTitle, notifOptions);
            await markNotifiedKeySW(keyBroadcast);
          }
        }, delayMs);
        scheduledTimeouts.set(keyBroadcast, timerId);
      }
    }
  }

  // 1. Verificar e agendar Compromissos / Lembretes da Agenda (1 dia antes e no próprio dia de manhã cedo)
  const agendaItens = Array.isArray(payload.agendaItens) ? payload.agendaItens : [];
  for (const item of agendaItens) {
    if (!item || item.concluido || !item.data) continue;
    let dataStr = String(item.data).trim();
    if (dataStr.includes("/")) {
      const p = dataStr.split("/");
      if (p.length === 3) dataStr = `${p[2]}-${p[1].padStart(2, "0")}-${p[0].padStart(2, "0")}`;
    } else if (dataStr.includes("T")) {
      dataStr = dataStr.split("T")[0];
    }

    const compDate = new Date(dataStr + "T00:00:00");
    if (isNaN(compDate.getTime())) continue;

    const diffDays = Math.round((compDate.getTime() - hojeDate.getTime()) / (1000 * 60 * 60 * 24));
    const nomePessoa = item.pessoa || "Leonardo";
    const horaInfo = item.hora ? ` às ${item.hora}` : "";
    const dataBR = isoParaBR_SW(dataStr);

    // Se for HOJE (no dia de manhã cedo)
    if (diffDays === 0) {
      const keyHoje = `sw_agenda_hoje_${item.id}_${hojeStr}`;
      if (!notifiedKeys.includes(keyHoje)) {
        await self.registration.showNotification(`☀️ BOM DIA! Compromisso Hoje (${nomePessoa}): ${item.titulo}`, {
          body: `Hoje (${dataBR})${horaInfo} • Toque para abrir os Lembretes.`,
          icon: "./icon-192.png",
          badge: "./icon-192.png",
          tag: `agenda_hoje_${item.id}`,
          vibrate: [250, 100, 250, 100, 250],
          requireInteraction: true,
          data: { url: "./?openModal=agenda", targetModal: "agenda", agendaId: item.id }
        });
        await markNotifiedKeySW(keyHoje);
      }
    }

    // Se for AMANHÃ (1 dia antes)
    if (diffDays === 1) {
      const keyVespera = `sw_agenda_vespera_${item.id}_${hojeStr}`;
      if (!notifiedKeys.includes(keyVespera)) {
        await self.registration.showNotification(`🔔 AMANHÃ (${nomePessoa}): ${item.titulo}`, {
          body: `Lembrete de véspera: Compromisso de ${nomePessoa} amanhã (${dataBR})${horaInfo}.`,
          icon: "./icon-192.png",
          badge: "./icon-192.png",
          tag: `agenda_vespera_${item.id}`,
          vibrate: [250, 100, 250],
          data: { url: "./?openModal=agenda", targetModal: "agenda", agendaId: item.id }
        });
        await markNotifiedKeySW(keyVespera);
      }
    }

    // Agendamento nativo futuro via TimestampTrigger ou Timer (dispara mesmo se o celular ficar sem abrir o app)
    if (diffDays >= 0 && diffDays <= 30) {
      try {
        const [anoC, mesC, diaC] = dataStr.split("-").map(Number);

        // Gatilho para 1 dia antes às 09:00
        const dtVespera = new Date(anoC, mesC - 1, diaC - 1, 9, 0, 0).getTime();
        if (supportsTrigger && dtVespera > Date.now()) {
          await self.registration.showNotification(`🔔 AMANHÃ (${nomePessoa}): ${item.titulo}`, {
            body: `Lembrete: Compromisso de ${nomePessoa} amanhã (${dataBR})${horaInfo}.`,
            icon: "./icon-192.png",
            badge: "./icon-192.png",
            tag: `trig_vespera_${item.id}`,
            showTrigger: new TimestampTrigger(dtVespera),
            data: { url: "./?openModal=agenda", targetModal: "agenda", agendaId: item.id }
          });
        }

        // Gatilho para o próprio dia de manhã cedo (07:30)
        const dtManhaCedo = new Date(anoC, mesC - 1, diaC, 7, 30, 0).getTime();
        if (dtManhaCedo > Date.now()) {
          if (supportsTrigger) {
            await self.registration.showNotification(`☀️ BOM DIA! Compromisso Hoje (${nomePessoa}): ${item.titulo}`, {
              body: `Compromisso de ${nomePessoa} hoje (${dataBR})${horaInfo}.`,
              icon: "./icon-192.png",
              badge: "./icon-192.png",
              tag: `trig_manha_${item.id}`,
              showTrigger: new TimestampTrigger(dtManhaCedo),
              data: { url: "./?openModal=agenda", targetModal: "agenda", agendaId: item.id }
            });
          }
          const delayManha = dtManhaCedo - Date.now();
          const keyTimerManha = `timer_agenda_manha_${item.id}_${dataStr}`;
          if (!scheduledTimeouts.has(keyTimerManha) && delayManha > 0 && delayManha <= 1000 * 60 * 60 * 12) {
            const tId = setTimeout(async () => {
              scheduledTimeouts.delete(keyTimerManha);
              await self.registration.showNotification(`☀️ BOM DIA! Compromisso Hoje (${nomePessoa}): ${item.titulo}`, {
                body: `Compromisso de ${nomePessoa} hoje (${dataBR})${horaInfo}.`,
                icon: "./icon-192.png",
                badge: "./icon-192.png",
                tag: `agenda_manha_${item.id}`,
                vibrate: [300, 100, 300],
                requireInteraction: true,
                data: { url: "./?openModal=agenda", targetModal: "agenda", agendaId: item.id }
              });
            }, delayManha);
            scheduledTimeouts.set(keyTimerManha, tId);
          }
        }
      } catch {}
    }
  }

  // 1.5 Verificar Saúde (Pesagem mensal, Novo Peso, Meta de Peso e Horário dos Remédios)
  const dadosSaude = payload.dadosSaude;
  if (dadosSaude && typeof dadosSaude === "object") {
    const registros = Array.isArray(dadosSaude.historicoPesoAltura)
      ? dadosSaude.historicoPesoAltura
      : Array.isArray(dadosSaude.registrosPesoAltura)
      ? dadosSaude.registrosPesoAltura
      : [];

    // A) Lembrete mensal de pesagem (30 dias desde a última pesagem de Vitórya ou Leonardo)
    for (const pessoa of ["Vitórya", "Leonardo"]) {
      const normTarget = pessoa === "Vitórya" ? "vit" : "leo";
      const regsPessoa = registros
        .filter((r) => r && r.data && String(r.pessoa || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(normTarget))
        .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

      if (regsPessoa.length > 0) {
        const ultimo = regsPessoa[0];
        let dStr = String(ultimo.data).trim();
        if (dStr.includes("/")) {
          const p = dStr.split("/");
          if (p.length === 3) dStr = `${p[2]}-${p[1].padStart(2, "0")}-${p[0].padStart(2, "0")}`;
        }
        const dtUltima = new Date(dStr + "T12:00:00");
        if (!isNaN(dtUltima.getTime())) {
          const diasSemPesar = Math.floor((nowMs - dtUltima.getTime()) / (1000 * 60 * 60 * 24));
          if (diasSemPesar >= 30) {
            const keyMesPeso = `sw_saude_peso_mensal_${pessoa}_${yyyy}-${mm}`;
            if (!notifiedKeys.includes(keyMesPeso)) {
              await self.registration.showNotification(`⚖️ Hora de se pesar, ${pessoa}!`, {
                body: `${pessoa}, sua última pesagem faz um mês (${diasSemPesar} dias). Atualize seu peso na aba Saúde!`,
                icon: "./icon-192.png",
                badge: "./icon-192.png",
                tag: `saude_peso_mensal_${pessoa}`,
                vibrate: [250, 100, 250],
                data: { url: "./?openModal=saude&saudeTab=pesoxaltura", targetModal: "saude", targetSaudeTab: "pesoxaltura" }
              });
              await markNotifiedKeySW(keyMesPeso);
            }
          }
        }
      }
    }

    // B) Remédios ativos no horário cadastrado (suporta tanto array med.horarios quanto string med.horario)
    const medicamentos = Array.isArray(dadosSaude.medicamentos) ? dadosSaude.medicamentos : [];
    const horaAtualMin = now.getHours() * 60 + now.getMinutes();
    for (const med of medicamentos) {
      if (!med || med.ativo === false || med.lembreteAtivo === false || !med.nome) continue;
      if (med.tipoTratamento === "dias" && med.dataFim && String(med.dataFim) < hojeStr) continue;
      if (med.dataFim && String(med.dataFim) < hojeStr) continue;
      const rawHorarios = Array.isArray(med.horarios)
        ? med.horarios.join(", ")
        : String(med.horario || "");
      const horarios = rawHorarios
        .split(/[,;/\s]+/)
        .map((h) => h.trim())
        .filter((h) => /^\d{1,2}:\d{2}$/.test(h));
      for (const hStr of horarios) {
        const [hh, mmin] = hStr.split(":").map(Number);
        if (isNaN(hh) || isNaN(mmin)) continue;
        const hNorm = `${String(hh).padStart(2, "0")}:${String(mmin).padStart(2, "0")}`;

        const keyRemedioHoje = `sw_remedio_${med.id}_${hojeStr}_${hNorm}`;
        const medMin = hh * 60 + mmin;

        if (horaAtualMin >= medMin && horaAtualMin <= medMin + 30 && !notifiedKeys.includes(keyRemedioHoje)) {
          await self.registration.showNotification(`💊 Hora do Remédio: ${med.nome}`, {
            body: `Lembrete das ${hNorm}: Tomar ${med.nome}${med.dosagem ? ` (${med.dosagem})` : ""}. Toque para abrir a aba Saúde.`,
            icon: "./icon-192.png",
            badge: "./icon-192.png",
            tag: `remedio_${med.id}_${hNorm}`,
            vibrate: [300, 120, 300, 120, 400],
            requireInteraction: true,
            actions: [{ action: "open", title: "Ver Remédios" }],
            data: { url: "./?openModal=saude&saudeTab=remedios", targetModal: "saude", targetSaudeTab: "remedios" }
          });
          await markNotifiedKeySW(keyRemedioHoje);
        } else if (medMin > horaAtualMin) {
          const dtRemedio = new Date(yyyy, now.getMonth(), now.getDate(), hh, mmin, 0).getTime();
          const delayRemedio = dtRemedio - Date.now();
          if (supportsTrigger && delayRemedio > 0) {
            try {
              await self.registration.showNotification(`💊 Hora do Remédio: ${med.nome}`, {
                body: `Lembrete das ${hNorm}: Tomar ${med.nome}${med.dosagem ? ` (${med.dosagem})` : ""}.`,
                icon: "./icon-192.png",
                badge: "./icon-192.png",
                tag: `trig_remedio_${med.id}_${hNorm}`,
                showTrigger: new TimestampTrigger(dtRemedio),
                data: { url: "./?openModal=saude&saudeTab=remedios", targetModal: "saude", targetSaudeTab: "remedios" }
              });
            } catch {}
          }
          if (!scheduledTimeouts.has(keyRemedioHoje) && delayRemedio > 0 && delayRemedio <= 1000 * 60 * 60 * 12) {
            const tId = setTimeout(async () => {
              scheduledTimeouts.delete(keyRemedioHoje);
              const currKeys = await getNotifiedKeysSW();
              if (!currKeys.includes(keyRemedioHoje)) {
                await self.registration.showNotification(`💊 Hora do Remédio: ${med.nome}`, {
                  body: `Lembrete das ${hNorm}: Tomar ${med.nome}${med.dosagem ? ` (${med.dosagem})` : ""}. Toque para abrir a aba Saúde.`,
                  icon: "./icon-192.png",
                  badge: "./icon-192.png",
                  tag: `remedio_${med.id}_${hNorm}`,
                  vibrate: [300, 120, 300, 120, 400],
                  requireInteraction: true,
                  actions: [{ action: "open", title: "Ver Remédios" }],
                  data: { url: "./?openModal=saude&saudeTab=remedios", targetModal: "saude", targetSaudeTab: "remedios" }
                });
                await markNotifiedKeySW(keyRemedioHoje);
              }
            }, delayRemedio);
            scheduledTimeouts.set(keyRemedioHoje, tId);
          }
        }
      }
    }
  }

  // 1.6 Verificar Caixinhas de Meta Concluídas (100%)
  const caixinhas = Array.isArray(payload.caixinhas) ? payload.caixinhas : [];
  for (const cx of caixinhas) {
    if (!cx || !cx.id || !cx.meta || cx.meta <= 0) continue;
    const saldoCx = Number(cx.saldo !== undefined ? cx.saldo : cx.saldoAtual) || 0;
    if (saldoCx >= cx.meta) {
      const keyCxMeta = `sw_caixinha_meta_${cx.id}_${cx.meta}`;
      if (!notifiedKeys.includes(keyCxMeta)) {
        await self.registration.showNotification(`🏆 Meta da Caixinha Concluída: ${cx.nome}!`, {
          body: `Parabéns! A caixinha "${cx.nome}" atingiu 100% da meta! Toque para abrir as Caixinhas.`,
          icon: "./icon-192.png",
          badge: "./icon-192.png",
          tag: `caixinha_meta_${cx.id}`,
          vibrate: [300, 100, 300, 100, 400],
          requireInteraction: true,
          actions: [{ action: "open", title: "Abrir Caixinhas" }],
          data: { url: "./?openModal=caixinhas", targetModal: "caixinhas" }
        });
        await markNotifiedKeySW(keyCxMeta);
      }
    }
  }

  // 2. Verificar Contas que Vencem Hoje ou Atrasadas em 2º plano
  const contas = Array.isArray(payload.contas) ? payload.contas : [];
  const vencemHoje = [];
  const atrasadas = [];

  for (const c of contas) {
    if (!c || c.paga || c.oculta || !c.vencimento) continue;
    const vencDate = new Date(c.vencimento + "T00:00:00");
    if (isNaN(vencDate.getTime())) continue;
    const diffDays = Math.round((vencDate.getTime() - hojeDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) vencemHoje.push(c);
    else if (diffDays < 0) atrasadas.push(c);

    // Agendamento nativo futuro via TimestampTrigger para Contas no dia do vencimento às 09:00
    if (supportsTrigger && diffDays >= 1 && diffDays <= 30) {
      try {
        const [anoV, mesV, diaV] = String(c.vencimento).split("-").map(Number);
        const dtVenc = new Date(anoV, mesV - 1, diaV, 9, 0, 0).getTime();
        if (dtVenc > Date.now()) {
          await self.registration.showNotification(`⏰ VENCE HOJE: ${c.nome}`, {
            body: `Vencimento hoje (${isoParaBR_SW(c.vencimento)}) • Toque para abrir o app`,
            icon: "./icon-192.png",
            badge: "./icon-192.png",
            tag: `trig_conta_${c.id}_${c.vencimento}`,
            showTrigger: new TimestampTrigger(dtVenc),
            data: { url: "./", contaId: c.id }
          });
        }
      } catch {}
    }
  }

  if (vencemHoje.length > 0) {
    const keyContasHoje = `sw_contas_hoje_${hojeStr}_qtd${vencemHoje.length}`;
    if (!notifiedKeys.includes(keyContasHoje)) {
      const primeira = vencemHoje[0];
      const titulo = vencemHoje.length === 1
        ? `⏰ VENCE HOJE: ${primeira.nome}`
        : `⏰ ${vencemHoje.length} CONTAS VENCEM HOJE`;
      const corpo = vencemHoje.length === 1
        ? `Vencimento hoje (${isoParaBR_SW(primeira.vencimento)}) • Toque para ver`
        : `${primeira.nome} e mais ${vencemHoje.length - 1} conta(s) vencem hoje!`;

      await self.registration.showNotification(titulo, {
        body: corpo,
        icon: "./icon-192.png",
        badge: "./icon-192.png",
        tag: `sw_hoje_${hojeStr}`,
        vibrate: [250, 100, 250],
        data: { url: "./" }
      });
      await markNotifiedKeySW(keyContasHoje);
    }
  }
}

// Instalação do Service Worker com pré-carregamento dos assets essenciais
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        await cache.addAll(CORE_ASSETS);
      } catch (err) {
        console.warn("Alguns assets essenciais serão cacheados dinamicamente:", err);
      }
    })
  );
  self.skipWaiting();
});

// Ativação e limpeza imediata de versões antigas do cache
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim()).then(() => checkAndScheduleBackgroundNotifications())
  );
});

// Verificação periódica enquanto o Service Worker estiver ativo em segundo plano
setInterval(() => {
  checkAndScheduleBackgroundNotifications().catch(() => {});
}, 30000);

// Estratégia de cache inteligente para navegação e assets estáticos
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Ignora métodos não-GET e requisições para extensões do navegador
  if (request.method !== "GET" || url.protocol.startsWith("chrome-extension")) {
    return;
  }

  // 2. Não intercepta downloads de arquivos .ZIP nem endpoints do Firebase / Google APIs
  if (
    url.pathname.endsWith(".zip") ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("firebaseapp.com") ||
    url.hostname.includes("firebaseio.com") ||
    url.hostname.includes("gstatic.com")
  ) {
    return;
  }

  // 3. Requisição de Navegação (Abrir o App / Carregar HTML principal)
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
              cache.put("./index.html", networkResponse.clone());
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Quando estiver sem internet (offline), serve o index.html cacheado imediatamente
          const cachedNavigate = await caches.match(request);
          if (cachedNavigate) return cachedNavigate;

          const cachedIndex = await caches.match("./index.html");
          if (cachedIndex) return cachedIndex;

          const rootIndex = await caches.match("./");
          if (rootIndex) return rootIndex;

          return new Response(
            `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sutello Financeiro Offline</title></head><body style="background:#08080f;color:#fff;font-family:sans-serif;text-align:center;padding:40px;"><h2>Sutello Financeiro</h2><p>Carregando dados salvos localmente...</p><script>location.reload();</script></body></html>`,
            { headers: { "Content-Type": "text/html" } }
          );
        })
    );
    return;
  }

  // 4. Scripts, Estilos, Fontes e Imagens (Network-First com Fallback Offline imediato para o App da Tela Inicial nunca ficar com JS antigo)
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (
          networkResponse &&
          (networkResponse.status === 200 || networkResponse.type === "opaque")
        ) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) return cachedResponse;
        throw new Error("Offline resource not available");
      })
  );
});

// 5. Suporte a Notificações Nativas no Celular (Toque / Clique na Notificação ou nos Botões da Notificação)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const notifData = event.notification.data || {};
  if (event.action === "open_link" && notifData.linkUrl) {
    event.waitUntil(
      self.clients.openWindow ? self.clients.openWindow(notifData.linkUrl) : Promise.resolve()
    );
    return;
  }

  const targetUrl = notifData.linkUrl || notifData.url || "./";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        if (notifData.linkUrl && /^https?:\/\//i.test(notifData.linkUrl)) {
          if (self.clients.openWindow) {
            return self.clients.openWindow(notifData.linkUrl);
          }
        }
        // Se já houver uma aba aberta do app, envia comando para abrir a aba/modal correspondente e foca nela
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (notifData.targetModal || notifData.contaId) {
            client.postMessage({
              type: "NOTIFICATION_CLICK_TARGET",
              targetModal: notifData.targetModal,
              targetSaudeTab: notifData.targetSaudeTab,
              contaId: notifData.contaId
            });
          }
          if ("focus" in client) {
            return client.focus();
          }
        }
        // Se não houver, abre uma nova janela com o app já na URL com parâmetros de abertura
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

// 6. Listener para mensagens enviadas pela aplicação cliente e sincronização de segundo plano
self.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (event.data.type === "SHOW_NOTIFICATION") {
    const { title, options } = event.data;
    if (self.registration && self.registration.showNotification) {
      self.registration.showNotification(title, options);
    }
  } else if (event.data.type === "SYNC_BG_ALERTS") {
    event.waitUntil(
      saveBgPayload(event.data.payload).then(() => checkAndScheduleBackgroundNotifications())
    );
  }
});

// 7. Periodic Background Sync (Acorda o Service Worker em 2º plano no celular mesmo com o app fechado)
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "sutello-daily-alerts" || event.tag === "content-sync") {
    event.waitUntil(checkAndScheduleBackgroundNotifications());
  }
});

// 8. Background Sync quando a internet do celular reconecta em 2º plano
self.addEventListener("sync", (event) => {
  if (event.tag === "sutello-sync-alerts") {
    event.waitUntil(checkAndScheduleBackgroundNotifications());
  }
});

// 9. Push Notifications diretas
self.addEventListener("push", (event) => {
  let data = {};
  try {
    if (event.data) data = event.data.json();
  } catch {
    data = { title: "Sutello Financeiro", body: event.data ? event.data.text() : "Você tem um novo alerta!" };
  }
  const title = data.title || (data.notification && data.notification.title) || "Sutello Financeiro";
  const body = data.body || (data.notification && data.notification.body) || "Verifique seus compromissos e contas.";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "./icon-192.png",
      badge: "./icon-192.png",
      vibrate: [250, 100, 250],
      data: { url: "./" }
    })
  );
});
