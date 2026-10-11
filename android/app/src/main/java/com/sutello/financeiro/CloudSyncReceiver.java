package com.sutello.financeiro;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Executa em segundo plano no Android (mesmo com o aplicativo 100% fechado ou após reiniciar o celular)
 * para buscar transmissões ADM, novas contas, contas pagas, logs de ações entre celulares, vencimentos de hoje
 * e compromissos da Agenda diretamente no Firebase Firestore autenticando com o token (idToken / refreshToken) do usuário logado.
 */
public class CloudSyncReceiver extends BroadcastReceiver {
    public static final String CHANNEL_ID = "sutello_alertas_max";
    public static final String PREFS_NAME = "SutelloNativeBgPrefs";

    @Override
    public void onReceive(Context context, Intent intent) {
        // Remove qualquer notificação fixa antiga caso exista e reagenda o próximo ciclo silencioso
        SutelloRealtimeSyncService.clearLegacyForegroundNotification(context);
        scheduleNextSync(context);
        SutelloSyncJobService.scheduleSyncJobs(context);
        SutelloRealtimeSyncService.startRealtimeService(context);

        final PendingResult pendingResult = goAsync();
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        final PowerManager.WakeLock wakeLock = pm != null
            ? pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "SutelloFinanceiro::CloudSyncWakeLock")
            : null;
        if (wakeLock != null) {
            try {
                wakeLock.acquire(22000L);
            } catch (Exception ignored) {}
        }

        new Thread(() -> {
            try {
                // 1ª verificação imediata
                checkFirebaseAndNotify(context);
                // 2ª verificação rápida após 6 segundos na mesma janela de execução
                Thread.sleep(6000L);
                checkFirebaseAndNotify(context);
            } catch (Exception ignored) {
            } finally {
                scheduleNextSync(context);
                SutelloSyncJobService.scheduleSyncJobs(context);
                if (wakeLock != null && wakeLock.isHeld()) {
                    try {
                        wakeLock.release();
                    } catch (Exception ignored) {}
                }
                pendingResult.finish();
            }
        }).start();
    }

    public static void scheduleNextSync(Context context) {
        try {
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;

            Intent i = new Intent(context, CloudSyncReceiver.class);
            i.setAction("com.sutello.financeiro.ACTION_BG_CLOUD_SYNC");
            PendingIntent pi = PendingIntent.getBroadcast(
                context,
                7701,
                i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            // Verifica silenciosamente a cada 15 segundos (100% invisível na barra de notificações)
            long triggerAt = System.currentTimeMillis() + (15 * 1000L);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                try {
                    // AlarmClock Info garante isenção total do Doze Mode (não sofre o bloqueio de 9 minutos após fechar o app)
                    // e libera a rede em segundo plano no Xiaomi/MIUI/Samsung, sem colocar nenhuma notificação na barra!
                    Intent showIntent = new Intent(context, MainActivity.class);
                    PendingIntent showPi = PendingIntent.getActivity(
                        context,
                        7705,
                        showIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                    );
                    AlarmManager.AlarmClockInfo clockInfo = new AlarmManager.AlarmClockInfo(triggerAt, showPi);
                    am.setAlarmClock(clockInfo, pi);
                    return;
                } catch (Exception ignored) {}
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                try {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi);
                } catch (SecurityException se) {
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi);
                }
            } else {
                am.setExact(AlarmManager.RTC_WAKEUP, triggerAt, pi);
            }
        } catch (Exception ignored) {}
    }

    public static synchronized void checkFirebaseAndNotify(Context context) {
        SharedPreferences nativePrefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String uid = nativePrefs.getString("uid", null);
        String projectId = nativePrefs.getString("projectId", "sutello-financeiro");
        String apiKey = nativePrefs.getString("apiKey", "");
        String idToken = nativePrefs.getString("idToken", "");
        String refreshToken = nativePrefs.getString("refreshToken", "");

        if (uid == null || uid.isEmpty()) {
            SharedPreferences capPrefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            uid = capPrefs.getString("sutello_last_uid", null);
        }

        if (uid == null || uid.isEmpty()) return;

        // Se tivermos refreshToken e apiKey, garante um idToken fresco e válido (tokens do Firebase expiram em 1h)
        long lastTokenRefresh = nativePrefs.getLong("tokenRefreshedAt", 0L);
        if (!refreshToken.isEmpty() && !apiKey.isEmpty() && (idToken.isEmpty() || (System.currentTimeMillis() - lastTokenRefresh > 35 * 60 * 1000L))) {
            String refreshed = refreshFirebaseIdToken(apiKey, refreshToken);
            if (refreshed != null && !refreshed.isEmpty()) {
                idToken = refreshed;
                nativePrefs.edit()
                    .putString("idToken", idToken)
                    .putLong("tokenRefreshedAt", System.currentTimeMillis())
                    .apply();
            }
        }

        String baseUrl = "https://firestore.googleapis.com/v1/projects/" + projectId + "/databases/(default)/documents";
        String keyParam = (apiKey != null && !apiKey.isEmpty()) ? ("?key=" + apiKey) : "";

        ensureNotificationChannel(context);

        // 1. Verifica transmissões globais ADM (para todos os celulares logados)
        String globalUrl = baseUrl + "/dados_caixinhas_agenda/transmissoes_globais" + keyParam;
        String globalJsonStr = httpGetWithAuth(globalUrl, idToken, apiKey, refreshToken, nativePrefs);
        if (globalJsonStr != null) {
            idToken = nativePrefs.getString("idToken", idToken);
            processTransmissoesFromFirestoreDoc(context, nativePrefs, globalJsonStr);
        }

        // 1.1 Verifica se há nova Atualização OTA do Aplicativo (dados_caixinhas_agenda/versao_app) para avisar na barra do celular sem precisar baixar APK
        String verUrl = baseUrl + "/dados_caixinhas_agenda/versao_app" + keyParam;
        String verJsonStr = httpGetWithAuth(verUrl, idToken, apiKey, refreshToken, nativePrefs);
        if (verJsonStr != null) {
            processAppUpdateFromFirestoreDoc(context, nativePrefs, verJsonStr);
        }

        // 2. Verifica dados financeiros, logs de alterações entre celulares e transmissões do usuário logado (dados_financeiros/{uid})
        String finUrl = baseUrl + "/dados_financeiros/" + uid + keyParam;
        String finJsonStr = httpGetWithAuth(finUrl, idToken, apiKey, refreshToken, nativePrefs);
        if (finJsonStr != null) {
            idToken = nativePrefs.getString("idToken", idToken);
            processTransmissoesFromFirestoreDoc(context, nativePrefs, finJsonStr);
            processContasFromFirestoreDoc(context, nativePrefs, finJsonStr);
            processLogsFromFirestoreDoc(context, nativePrefs, finJsonStr);
        }

        // 3. Verifica compromissos da Agenda, Caixinhas e Saúde do usuário logado (dados_caixinhas_agenda/{uid} e dados_saude/{uid})
        String agendaUrl = baseUrl + "/dados_caixinhas_agenda/" + uid + keyParam;
        String agendaJsonStr = httpGetWithAuth(agendaUrl, idToken, apiKey, refreshToken, nativePrefs);
        if (agendaJsonStr != null) {
            processAgendaCaixinhasSaudeFromFirestoreDoc(context, nativePrefs, agendaJsonStr);
        }

        String saudeUrl = baseUrl + "/dados_saude/" + uid + keyParam;
        String saudeJsonStr = httpGetWithAuth(saudeUrl, idToken, apiKey, refreshToken, nativePrefs);
        if (saudeJsonStr != null) {
            processSaudeDirectFirestoreDoc(context, nativePrefs, saudeJsonStr);
        }

        // 4. Também verifica snapshots locais sincronizados pela ponte nativa (funciona mesmo sem internet no momento exato do remédio!)
        processLocalBridgedSnapshots(context, nativePrefs);
    }

    private static String httpGetWithAuth(String urlStr, String idToken, String apiKey, String refreshToken, SharedPreferences prefs) {
        HttpResult res = httpGetRaw(urlStr, idToken);
        if (res.code == 200) {
            return res.body;
        }
        // Se deu 401 ou 403, renova o idToken usando o refreshToken do Firebase Auth e tenta imediatamente de novo!
        if ((res.code == 401 || res.code == 403) && refreshToken != null && !refreshToken.isEmpty() && apiKey != null && !apiKey.isEmpty()) {
            String newIdToken = refreshFirebaseIdToken(apiKey, refreshToken);
            if (newIdToken != null && !newIdToken.isEmpty()) {
                prefs.edit()
                    .putString("idToken", newIdToken)
                    .putLong("tokenRefreshedAt", System.currentTimeMillis())
                    .apply();
                HttpResult retryRes = httpGetRaw(urlStr, newIdToken);
                if (retryRes.code == 200) {
                    return retryRes.body;
                }
            }
        }
        return null;
    }

    private static String refreshFirebaseIdToken(String apiKey, String refreshToken) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL("https://securetoken.googleapis.com/v1/token?key=" + apiKey);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            conn.setDoOutput(true);

            String body = "grant_type=refresh_token&refresh_token=" + refreshToken;
            try (OutputStream os = conn.getOutputStream()) {
                os.write(body.getBytes(StandardCharsets.UTF_8));
            }

            if (conn.getResponseCode() == 200) {
                BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = br.readLine()) != null) {
                    sb.append(line);
                }
                br.close();
                JSONObject json = new JSONObject(sb.toString());
                return json.optString("id_token", "");
            }
        } catch (Exception ignored) {
        } finally {
            if (conn != null) conn.disconnect();
        }
        return null;
    }

    private static class HttpResult {
        int code;
        String body;
        HttpResult(int code, String body) {
            this.code = code;
            this.body = body;
        }
    }

    private static HttpResult httpGetRaw(String urlStr, String idToken) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(urlStr);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            if (idToken != null && !idToken.isEmpty()) {
                conn.setRequestProperty("Authorization", "Bearer " + idToken);
            }
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            int code = conn.getResponseCode();
            if (code == 200) {
                BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = br.readLine()) != null) {
                    sb.append(line);
                }
                br.close();
                return new HttpResult(200, sb.toString());
            }
            return new HttpResult(code, null);
        } catch (Exception ignored) {
            return new HttpResult(0, null);
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static void processAppUpdateFromFirestoreDoc(Context context, SharedPreferences prefs, String jsonStr) {
        try {
            JSONObject root = new JSONObject(jsonStr);
            JSONObject fields = root.optJSONObject("fields");
            if (fields == null) return;

            String version = getFirestoreString(fields, "version");
            String buildId = getFirestoreString(fields, "buildId");
            String title = getFirestoreString(fields, "title");
            String notes = getFirestoreString(fields, "notes");

            if (version.isEmpty() || buildId.isEmpty()) return;

            String installedBuild = prefs.getString("installed_build_id", "20261010-ota-v380");
            String notifiedKey = "notified_ota_" + version + "_" + buildId;

            if (!buildId.equals(installedBuild) && !prefs.getBoolean(notifiedKey, false)) {
                String notifTitle = title.isEmpty() ? ("🚀 Atualização Disponível (v" + version + ")!") : title;
                String notifBody = notes.isEmpty()
                    ? "Uma nova versão do Sutello Financeiro está pronta! Toque aqui para abrir as Configurações e atualizar sem precisar baixar APK."
                    : notes;

                showRichNativeNotification(
                    context,
                    notifiedKey.hashCode(),
                    notifTitle,
                    notifBody,
                    "settings",
                    "",
                    "",
                    "Atualizar Agora",
                    ""
                );
                prefs.edit().putBoolean(notifiedKey, true).apply();
            }
        } catch (Exception ignored) {}
    }

    private static void processTransmissoesFromFirestoreDoc(Context context, SharedPreferences prefs, String jsonStr) {
        try {
            JSONObject root = new JSONObject(jsonStr);
            JSONObject fields = root.optJSONObject("fields");
            if (fields == null) return;
            JSONObject transField = fields.optJSONObject("transmissoes");
            if (transField == null) return;
            JSONObject arrayVal = transField.optJSONObject("arrayValue");
            if (arrayVal == null) return;
            JSONArray values = arrayVal.optJSONArray("values");
            if (values == null) return;

            String myDeviceId = prefs.getString("deviceId", "");
            long now = System.currentTimeMillis();
            for (int i = 0; i < values.length(); i++) {
                JSONObject itemMap = values.optJSONObject(i);
                if (itemMap == null) continue;
                JSONObject itemFields = itemMap.optJSONObject("mapValue") != null
                    ? itemMap.optJSONObject("mapValue").optJSONObject("fields")
                    : null;
                if (itemFields == null) continue;

                String id = getFirestoreString(itemFields, "id");
                String titulo = getFirestoreString(itemFields, "titulo");
                String mensagem = getFirestoreString(itemFields, "mensagem");
                String urgencia = getFirestoreString(itemFields, "urgencia");
                String senderDeviceId = getFirestoreString(itemFields, "deviceId");
                String linkUrl = getFirestoreString(itemFields, "linkUrl");
                String botaoTexto = getFirestoreString(itemFields, "botaoTexto");
                String imagemUrl = getFirestoreString(itemFields, "imagemUrl");
                String targetModal = getFirestoreString(itemFields, "targetModal");
                String targetSaudeTab = getFirestoreString(itemFields, "targetSaudeTab");
                long timestamp = getFirestoreLong(itemFields, "timestamp", now);
                long timestampAgendado = getFirestoreLong(itemFields, "timestampAgendado", timestamp);

                if (id.isEmpty() || titulo.isEmpty()) continue;

                // Se foi agendado para o futuro, só dispara quando chegar o horário
                if (timestampAgendado > now + 5000) continue;

                // Ignora mensagens com mais de 24h
                if (now - timestampAgendado > 24 * 60 * 60 * 1000L) continue;

                String notifiedKey = "notified_bcast_" + id;
                if (prefs.getBoolean(notifiedKey, false)) continue;

                // Se foi enviado deste mesmo aparelho (sem agendamento futuro), marca como visto para não duplicar
                if (!myDeviceId.isEmpty() && myDeviceId.equals(senderDeviceId) && Math.abs(timestampAgendado - timestamp) < 5000) {
                    prefs.edit().putBoolean(notifiedKey, true).apply();
                    continue;
                }

                String prefix = "alta".equals(urgencia) ? "🚨 " : ("media".equals(urgencia) ? "📢 " : "💬 ");
                showRichNativeNotification(
                    context,
                    id.hashCode(),
                    prefix + titulo,
                    mensagem,
                    targetModal.isEmpty() ? "notificacoes" : targetModal,
                    targetSaudeTab,
                    linkUrl,
                    botaoTexto,
                    imagemUrl
                );
                prefs.edit().putBoolean(notifiedKey, true).apply();
            }
        } catch (Exception ignored) {}
    }

    /**
     * Monitora também o array 'logs' de dados_financeiros/{uid} para detectar qualquer alteração
     * feita em outro celular (ex: editou conta, excluiu, adiou, pagamento parcial, estorno)
     */
    private static void processLogsFromFirestoreDoc(Context context, SharedPreferences prefs, String jsonStr) {
        try {
            JSONObject root = new JSONObject(jsonStr);
            JSONObject fields = root.optJSONObject("fields");
            if (fields == null) return;

            String updatedByDeviceId = getFirestoreString(fields, "updatedByDeviceId");
            String myDeviceId = prefs.getString("deviceId", "");

            JSONObject logsField = fields.optJSONObject("logs");
            if (logsField == null) return;
            JSONObject arrayVal = logsField.optJSONObject("arrayValue");
            if (arrayVal == null) return;
            JSONArray values = arrayVal.optJSONArray("values");
            if (values == null) return;

            boolean logsInitialized = prefs.getBoolean("logs_bg_initialized", false);
            boolean isFromOtherDevice = updatedByDeviceId.isEmpty() || myDeviceId.isEmpty() || !myDeviceId.equals(updatedByDeviceId);

            // Percorre os últimos 10 logs mais recentes
            int limit = Math.min(values.length(), 10);
            for (int i = 0; i < limit; i++) {
                JSONObject itemMap = values.optJSONObject(i);
                if (itemMap == null) continue;
                JSONObject lFields = itemMap.optJSONObject("mapValue") != null
                    ? itemMap.optJSONObject("mapValue").optJSONObject("fields")
                    : null;
                if (lFields == null) continue;

                String logId = getFirestoreString(lFields, "id");
                String acao = getFirestoreString(lFields, "acao");
                String detalhe = getFirestoreString(lFields, "detalhe");

                if (logId.isEmpty() || detalhe.isEmpty()) continue;

                String knownLogKey = "known_log_" + logId;
                if (!prefs.getBoolean(knownLogKey, false)) {
                    prefs.edit().putBoolean(knownLogKey, true).apply();

                    // Só dispara para ações que não são CRIADO/PAGO (pois CRIADO/PAGO já têm notificação detalhada em processContasFromFirestoreDoc)
                    if (logsInitialized && isFromOtherDevice) {
                        if ("EDITADO".equals(acao) || "EXCLUÍDO".equals(acao) || "ADIADO".equals(acao) || "PARCIAL".equals(acao) || "ESTORNO".equals(acao)) {
                            String icon = "EDITADO".equals(acao) ? "✏️ " : ("EXCLUÍDO".equals(acao) ? "🗑️ " : ("ADIADO".equals(acao) ? "📅 " : "🔄 "));
                            showNativeNotification(
                                context,
                                ("log_" + logId).hashCode(),
                                icon + "ATUALIZAÇÃO: " + acao,
                                detalhe
                            );
                        }
                    }
                }
            }

            if (!logsInitialized) {
                prefs.edit().putBoolean("logs_bg_initialized", true).apply();
            }
        } catch (Exception ignored) {}
    }

    private static void processContasFromFirestoreDoc(Context context, SharedPreferences prefs, String jsonStr) {
        try {
            JSONObject root = new JSONObject(jsonStr);
            JSONObject fields = root.optJSONObject("fields");
            if (fields == null) return;

            String updatedByDeviceId = getFirestoreString(fields, "updatedByDeviceId");
            String myDeviceId = prefs.getString("deviceId", "");
            boolean isSameDevice = !myDeviceId.isEmpty() && myDeviceId.equals(updatedByDeviceId);

            JSONObject contasField = fields.optJSONObject("contas");
            if (contasField == null) return;
            JSONObject arrayVal = contasField.optJSONObject("arrayValue");
            if (arrayVal == null) return;
            JSONArray values = arrayVal.optJSONArray("values");
            if (values == null) return;

            String hojeStr = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
            int vencemHojeCount = 0;
            String primeiraHojeNome = "";

            boolean initialized = prefs.getBoolean("contas_bg_initialized", false);

            for (int i = 0; i < values.length(); i++) {
                JSONObject itemMap = values.optJSONObject(i);
                if (itemMap == null) continue;
                JSONObject cFields = itemMap.optJSONObject("mapValue") != null
                    ? itemMap.optJSONObject("mapValue").optJSONObject("fields")
                    : null;
                if (cFields == null) continue;

                String id = getFirestoreString(cFields, "id");
                String nome = getFirestoreString(cFields, "nome");
                String vencimento = getFirestoreString(cFields, "vencimento");
                String pagador = getFirestoreString(cFields, "pagador");
                double valor = getFirestoreDouble(cFields, "valor", 0.0);
                boolean paga = getFirestoreBoolean(cFields, "paga", false);
                boolean oculta = getFirestoreBoolean(cFields, "oculta", false);

                if (id.isEmpty() || nome.isEmpty() || oculta) continue;

                String knownKey = "known_conta_" + id;
                String paidKey = "paid_conta_" + id;

                if (initialized && !isSameDevice) {
                    if (!prefs.getBoolean(knownKey, false)) {
                        // Nova conta adicionada em outro aparelho!
                        String valorFmt = String.format(new Locale("pt", "BR"), "%.2f", valor);
                        showRichNativeNotification(
                            context,
                            ("nova_" + id).hashCode(),
                            "🔔 NOVA CONTA: " + nome + " • R$ " + valorFmt,
                            "Vencimento: " + formatBrDate(vencimento) + (pagador.isEmpty() ? "" : " • " + pagador),
                            "",
                            "",
                            "",
                            "Ver Conta",
                            ""
                        );
                    } else if (paga && !prefs.getBoolean(paidKey, false)) {
                        // Conta marcada como paga em outro aparelho!
                        String valorFmt = String.format(new Locale("pt", "BR"), "%.2f", valor);
                        showRichNativeNotification(
                            context,
                            ("paga_" + id).hashCode(),
                            "✅ PAGA: " + nome + " • R$ " + valorFmt,
                            "Marcada como paga" + (pagador.isEmpty() ? "!" : " por " + pagador + "!"),
                            "",
                            "",
                            "",
                            "Abrir App",
                            ""
                        );
                    }
                }

                prefs.edit()
                    .putBoolean(knownKey, true)
                    .putBoolean(paidKey, paga)
                    .apply();

                if (!paga && hojeStr.equals(vencimento)) {
                    vencemHojeCount++;
                    if (primeiraHojeNome.isEmpty()) primeiraHojeNome = nome;
                }
            }

            if (!initialized) {
                prefs.edit().putBoolean("contas_bg_initialized", true).apply();
            }

            if (vencemHojeCount > 0) {
                String hojeKey = "notified_hoje_" + hojeStr + "_" + vencemHojeCount;
                if (!prefs.getBoolean(hojeKey, false)) {
                    String title = vencemHojeCount == 1
                        ? "⏰ VENCE HOJE: " + primeiraHojeNome
                        : "⏰ " + vencemHojeCount + " CONTAS VENCEM HOJE";
                    String body = vencemHojeCount == 1
                        ? "Vencimento hoje (" + formatBrDate(hojeStr) + ") • Toque para abrir o app"
                        : primeiraHojeNome + " e mais " + (vencemHojeCount - 1) + " conta(s) vencem hoje!";
                    showRichNativeNotification(context, hojeKey.hashCode(), title, body, "", "", "", "Pagar Agora", "");
                    prefs.edit().putBoolean(hojeKey, true).apply();
                }
            }
        } catch (Exception ignored) {}
    }

    /**
     * Verifica se o horário atual está dentro da janela de até 25 minutos após o horário do remédio (ex: "08:00")
     * para que o lembrete do remédio NUNCA seja perdido mesmo se o celular estava em espera!
     */
    private static boolean isMedicineTimeDueNow(String horarioStr) {
        if (horarioStr == null || horarioStr.trim().isEmpty()) return false;
        try {
            String clean = horarioStr.trim();
            String[] parts = clean.split(":");
            if (parts.length < 2) return false;
            int medHour = Integer.parseInt(parts[0].trim());
            int medMin = Integer.parseInt(parts[1].trim());
            int medTotalMin = medHour * 60 + medMin;

            java.util.Calendar cal = java.util.Calendar.getInstance();
            int nowTotalMin = cal.get(java.util.Calendar.HOUR_OF_DAY) * 60 + cal.get(java.util.Calendar.MINUTE);

            return nowTotalMin >= medTotalMin && nowTotalMin <= (medTotalMin + 25);
        } catch (Exception e) {
            return false;
        }
    }

    private static void processAgendaCaixinhasSaudeFromFirestoreDoc(Context context, SharedPreferences prefs, String jsonStr) {
        try {
            JSONObject root = new JSONObject(jsonStr);
            JSONObject fields = root.optJSONObject("fields");
            if (fields == null) return;

            String hojeStr = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
            String amanhaStr = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(System.currentTimeMillis() + 24 * 60 * 60 * 1000L));

            // 1) Processa Agenda (tanto via agenda_json quanto via array nativo 'agenda' ou 'itens' do Firestore)
            String agendaJsonRaw = getFirestoreString(fields, "agenda_json");
            if (!agendaJsonRaw.isEmpty()) {
                processAgendaJsonString(context, prefs, agendaJsonRaw, hojeStr, amanhaStr);
            } else {
                JSONObject agField = fields.optJSONObject("agenda") != null ? fields.optJSONObject("agenda") : fields.optJSONObject("itens");
                if (agField != null && agField.optJSONObject("arrayValue") != null) {
                    JSONArray values = agField.optJSONObject("arrayValue").optJSONArray("values");
                    if (values != null) {
                        for (int i = 0; i < values.length(); i++) {
                            JSONObject itemMap = values.optJSONObject(i);
                            if (itemMap == null || itemMap.optJSONObject("mapValue") == null) continue;
                            JSONObject f = itemMap.optJSONObject("mapValue").optJSONObject("fields");
                            if (f == null) continue;
                            String id = getFirestoreString(f, "id");
                            String titulo = getFirestoreString(f, "titulo");
                            String data = getFirestoreString(f, "data");
                            String hora = getFirestoreString(f, "hora");
                            String pessoa = getFirestoreString(f, "pessoa");
                            if (pessoa.isEmpty()) pessoa = "Leonardo";
                            boolean concluido = getFirestoreBoolean(f, "concluido", false);
                            checkAndNotifySingleAgendaItem(context, prefs, id, titulo, data, hora, pessoa, concluido, hojeStr, amanhaStr);
                        }
                    }
                }
            }

            // 2) Processa Caixinhas (tanto via caixinhas_json quanto via array nativo 'caixinhas' ou 'caixas' do Firestore)
            String caixinhasJsonRaw = getFirestoreString(fields, "caixinhas_json");
            if (!caixinhasJsonRaw.isEmpty()) {
                processCaixinhasJsonString(context, prefs, caixinhasJsonRaw);
            } else {
                JSONObject cxField = fields.optJSONObject("caixinhas") != null ? fields.optJSONObject("caixinhas") : fields.optJSONObject("caixas");
                if (cxField != null && cxField.optJSONObject("arrayValue") != null) {
                    JSONArray values = cxField.optJSONObject("arrayValue").optJSONArray("values");
                    if (values != null) {
                        for (int i = 0; i < values.length(); i++) {
                            JSONObject itemMap = values.optJSONObject(i);
                            if (itemMap == null || itemMap.optJSONObject("mapValue") == null) continue;
                            JSONObject f = itemMap.optJSONObject("mapValue").optJSONObject("fields");
                            if (f == null) continue;
                            String id = getFirestoreString(f, "id");
                            String nome = getFirestoreString(f, "nome");
                            double meta = getFirestoreDouble(f, "meta", 0.0);
                            double saldo = getFirestoreDouble(f, "saldo", getFirestoreDouble(f, "valorAtual", 0.0));
                            checkAndNotifySingleCaixinha(context, prefs, id, nome, meta, saldo);
                        }
                    }
                }
            }

            // 3) Processa Saúde (tanto via saude_json quanto via mapValue 'saude' em dados_caixinhas_agenda)
            String saudeJsonRaw = getFirestoreString(fields, "saude_json");
            if (!saudeJsonRaw.isEmpty()) {
                processSaudeJsonString(context, prefs, saudeJsonRaw, hojeStr);
            } else {
                JSONObject saudeField = fields.optJSONObject("saude");
                if (saudeField != null && saudeField.optJSONObject("mapValue") != null) {
                    JSONObject saudeFields = saudeField.optJSONObject("mapValue").optJSONObject("fields");
                    if (saudeFields != null) {
                        processSaudeFirestoreFields(context, prefs, saudeFields, hojeStr);
                    }
                }
            }
        } catch (Exception ignored) {}
    }

    private static void processSaudeDirectFirestoreDoc(Context context, SharedPreferences prefs, String jsonStr) {
        try {
            JSONObject root = new JSONObject(jsonStr);
            JSONObject fields = root.optJSONObject("fields");
            if (fields == null) return;
            String hojeStr = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
            processSaudeFirestoreFields(context, prefs, fields, hojeStr);
        } catch (Exception ignored) {}
    }

    private static void processLocalBridgedSnapshots(Context context, SharedPreferences prefs) {
        try {
            String hojeStr = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
            String amanhaStr = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(System.currentTimeMillis() + 24 * 60 * 60 * 1000L));

            String localSaude = prefs.getString("local_saude_json", "");
            if (localSaude != null && !localSaude.isEmpty()) {
                processSaudeJsonString(context, prefs, localSaude, hojeStr);
            }
            String localCaixinhas = prefs.getString("local_caixinhas_json", "");
            if (localCaixinhas != null && !localCaixinhas.isEmpty()) {
                processCaixinhasJsonString(context, prefs, localCaixinhas);
            }
            String localAgenda = prefs.getString("local_agenda_json", "");
            if (localAgenda != null && !localAgenda.isEmpty()) {
                processAgendaJsonString(context, prefs, localAgenda, hojeStr, amanhaStr);
            }
        } catch (Exception ignored) {}
    }

    private static void checkAndNotifySingleAgendaItem(
        Context context,
        SharedPreferences prefs,
        String id,
        String titulo,
        String data,
        String hora,
        String pessoa,
        boolean concluido,
        String hojeStr,
        String amanhaStr
    ) {
        if (id == null || id.isEmpty() || titulo == null || titulo.isEmpty() || concluido) return;
        String horaInfo = (hora == null || hora.isEmpty()) ? "" : (" às " + hora);
        if (amanhaStr.equals(data)) {
            String vespKey = "notified_ag_vesp_" + id + "_" + hojeStr;
            if (!prefs.getBoolean(vespKey, false)) {
                showRichNativeNotification(
                    context,
                    vespKey.hashCode(),
                    "🔔 AMANHÃ (" + pessoa + "): " + titulo,
                    "Lembrete de véspera: Compromisso amanhã (" + formatBrDate(data) + ")" + horaInfo,
                    "agenda",
                    "",
                    "",
                    "Abrir Agenda",
                    ""
                );
                prefs.edit().putBoolean(vespKey, true).apply();
            }
        } else if (hojeStr.equals(data)) {
            String agKey = "notified_ag_hoje_" + id + "_" + hojeStr;
            if (!prefs.getBoolean(agKey, false)) {
                showRichNativeNotification(
                    context,
                    agKey.hashCode(),
                    "☀️ Compromisso Hoje (" + pessoa + "): " + titulo,
                    "Compromisso de " + pessoa + " hoje (" + formatBrDate(data) + ")" + horaInfo,
                    "agenda",
                    "",
                    "",
                    "Abrir Agenda",
                    ""
                );
                prefs.edit().putBoolean(agKey, true).apply();
            }
            if (hora != null && !hora.isEmpty() && isMedicineTimeDueNow(hora)) {
                String horaKey = "notified_ag_hora_" + id + "_" + hojeStr + "_" + hora;
                if (!prefs.getBoolean(horaKey, false)) {
                    showRichNativeNotification(
                        context,
                        horaKey.hashCode(),
                        "⏰ AGORA (" + pessoa + "): " + titulo,
                        "Horário do compromisso de " + pessoa + " (" + hora + ")!",
                        "agenda",
                        "",
                        "",
                        "Ver na Agenda",
                        ""
                    );
                    prefs.edit().putBoolean(horaKey, true).apply();
                }
            }
        }
    }

    private static void processAgendaJsonString(Context context, SharedPreferences prefs, String agendaJsonRaw, String hojeStr, String amanhaStr) {
        try {
            JSONArray itens = null;
            if (agendaJsonRaw.trim().startsWith("[")) {
                itens = new JSONArray(agendaJsonRaw);
            } else {
                JSONObject agObj = new JSONObject(agendaJsonRaw);
                itens = agObj.optJSONArray("itens");
            }
            if (itens == null) return;
            for (int i = 0; i < itens.length(); i++) {
                JSONObject item = itens.optJSONObject(i);
                if (item == null) continue;
                String id = item.optString("id", "");
                String titulo = item.optString("titulo", "");
                String data = item.optString("data", "");
                String hora = item.optString("hora", "");
                String pessoa = item.optString("pessoa", "Leonardo");
                boolean concluido = item.optBoolean("concluido", false);
                checkAndNotifySingleAgendaItem(context, prefs, id, titulo, data, hora, pessoa, concluido, hojeStr, amanhaStr);
            }
        } catch (Exception ignored) {}
    }

    private static void checkAndNotifySingleCaixinha(
        Context context,
        SharedPreferences prefs,
        String id,
        String nome,
        double meta,
        double saldo
    ) {
        if (id == null || id.isEmpty() || nome == null || nome.isEmpty() || meta <= 0 || saldo < meta) return;
        String cxKey = "notified_cx_meta_" + id + "_" + (long) meta;
        if (!prefs.getBoolean(cxKey, false)) {
            String saldoFmt = String.format(new Locale("pt", "BR"), "%.2f", saldo);
            String metaFmt = String.format(new Locale("pt", "BR"), "%.2f", meta);
            showRichNativeNotification(
                context,
                cxKey.hashCode(),
                "🏆 Meta Concluída: Caixinha \"" + nome + "\"!",
                "Parabéns! Você atingiu R$ " + saldoFmt + " de R$ " + metaFmt + " (100% da meta)!",
                "caixinhas",
                "",
                "",
                "Abrir Caixinhas",
                ""
            );
            prefs.edit().putBoolean(cxKey, true).apply();
        }
    }

    private static void processCaixinhasJsonString(Context context, SharedPreferences prefs, String caixinhasJsonRaw) {
        try {
            JSONArray cxArr = new JSONArray(caixinhasJsonRaw);
            for (int i = 0; i < cxArr.length(); i++) {
                JSONObject cx = cxArr.optJSONObject(i);
                if (cx == null) continue;
                String id = cx.optString("id", "");
                String nome = cx.optString("nome", "");
                double meta = cx.optDouble("meta", 0.0);
                double saldo = cx.optDouble("saldoAtual", cx.optDouble("saldo", 0.0));
                checkAndNotifySingleCaixinha(context, prefs, id, nome, meta, saldo);
            }
        } catch (Exception ignored) {}
    }

    private static void processSaudeFirestoreFields(Context context, SharedPreferences prefs, JSONObject saudeFields, String hojeStr) {
        try {
            // 1. Remédios (medicamentos arrayValue no Firestore)
            JSONObject medsField = saudeFields.optJSONObject("medicamentos");
            if (medsField != null && medsField.optJSONObject("arrayValue") != null) {
                JSONArray medVals = medsField.optJSONObject("arrayValue").optJSONArray("values");
                if (medVals != null) {
                    for (int i = 0; i < medVals.length(); i++) {
                        JSONObject mItem = medVals.optJSONObject(i);
                        if (mItem == null || mItem.optJSONObject("mapValue") == null) continue;
                        JSONObject mf = mItem.optJSONObject("mapValue").optJSONObject("fields");
                        if (mf == null) continue;

                        boolean lembreteAtivo = getFirestoreBoolean(mf, "lembreteAtivo", true);
                        if (!lembreteAtivo) continue;

                        String medId = getFirestoreString(mf, "id");
                        String medNome = getFirestoreString(mf, "nome");
                        String medDosagem = getFirestoreString(mf, "dosagem");
                        String medInstrucoes = getFirestoreString(mf, "instrucoes");
                        String tipoTratamento = getFirestoreString(mf, "tipoTratamento");
                        String dataFim = getFirestoreString(mf, "dataFim");
                        if (medId.isEmpty() || medNome.isEmpty()) continue;

                        // Se for tratamento por alguns dias e já passou da data final, não notifica mais
                        if ("dias".equalsIgnoreCase(tipoTratamento) && !dataFim.isEmpty() && hojeStr.compareTo(dataFim) > 0) {
                            continue;
                        }

                        // Extrai lista de horários (arrayValue 'horarios' ou string 'horario')
                        JSONObject horariosField = mf.optJSONObject("horarios");
                        if (horariosField != null && horariosField.optJSONObject("arrayValue") != null) {
                            JSONArray hArr = horariosField.optJSONObject("arrayValue").optJSONArray("values");
                            if (hArr != null) {
                                for (int j = 0; j < hArr.length(); j++) {
                                    JSONObject hObj = hArr.optJSONObject(j);
                                    if (hObj == null) continue;
                                    String hStr = hObj.optString("stringValue", "").trim();
                                    checkAndNotifySingleMedicineTime(context, prefs, medId, medNome, medDosagem, medInstrucoes, hStr, hojeStr);
                                }
                            }
                        }
                    }
                }
            }

            // 2. Histórico de Peso (historicoPesoAltura arrayValue no Firestore)
            JSONObject histField = saudeFields.optJSONObject("historicoPesoAltura");
            if (histField != null && histField.optJSONObject("arrayValue") != null) {
                JSONArray pVals = histField.optJSONObject("arrayValue").optJSONArray("values");
                boolean saudeInit = prefs.getBoolean("saude_bg_init", false);
                if (pVals != null) {
                    for (int i = 0; i < pVals.length(); i++) {
                        JSONObject pItem = pVals.optJSONObject(i);
                        if (pItem == null || pItem.optJSONObject("mapValue") == null) continue;
                        JSONObject pf = pItem.optJSONObject("mapValue").optJSONObject("fields");
                        if (pf == null) continue;
                        String regId = getFirestoreString(pf, "id");
                        String pessoa = getFirestoreString(pf, "pessoa");
                        if (pessoa.isEmpty()) pessoa = "Vitórya";
                        double peso = getFirestoreDouble(pf, "peso", 0.0);
                        double metaPeso = getFirestoreDouble(pf, "metaPeso", 0.0);
                        checkAndNotifySingleWeightRecord(context, prefs, regId, pessoa, peso, metaPeso, saudeInit);
                    }
                    if (!saudeInit) prefs.edit().putBoolean("saude_bg_init", true).apply();
                }
            }
        } catch (Exception ignored) {}
    }

    private static void checkAndNotifySingleMedicineTime(
        Context context,
        SharedPreferences prefs,
        String medId,
        String medNome,
        String medDosagem,
        String medInstrucoes,
        String hTrim,
        String hojeStr
    ) {
        if (hTrim == null || hTrim.isEmpty()) return;

        if (isMedicineTimeDueNow(hTrim)) {
            String medKey = "notified_med_" + medId + "_" + hojeStr + "_" + hTrim;
            if (!prefs.getBoolean(medKey, false)) {
                String body = "Lembrete das " + hTrim + ": Tomar " + medNome
                    + (medDosagem == null || medDosagem.isEmpty() ? "" : " (" + medDosagem + ")")
                    + (medInstrucoes == null || medInstrucoes.isEmpty() ? "" : " • " + medInstrucoes);
                showRichNativeNotification(
                    context,
                    medKey.hashCode(),
                    "💊 Hora do Remédio: " + medNome,
                    body,
                    "saude",
                    "remedios",
                    "",
                    "Abrir Remédios",
                    ""
                );
                prefs.edit().putBoolean(medKey, true).apply();
            }
        }
    }

    private static void checkAndNotifySingleWeightRecord(
        Context context,
        SharedPreferences prefs,
        String regId,
        String pessoa,
        double peso,
        double metaP,
        boolean saudeInit
    ) {
        if (regId == null || regId.isEmpty() || peso <= 0) return;
        String knownPesoKey = "known_peso_" + regId;
        if (!prefs.getBoolean(knownPesoKey, false)) {
            prefs.edit().putBoolean(knownPesoKey, true).apply();
            if (saudeInit) {
                String pesoFmt = String.format(new Locale("pt", "BR"), "%.1f", peso);
                showRichNativeNotification(
                    context,
                    ("peso_" + regId).hashCode(),
                    "⚖️ Novo Peso (" + pessoa + "): " + pesoFmt + " kg",
                    pessoa + " registrou " + pesoFmt + " kg na aba Saúde!",
                    "saude",
                    "pesoxaltura",
                    "",
                    "Ver Evolução",
                    ""
                );
            }
        }
        if (metaP > 0 && Math.abs(peso - metaP) <= 0.3) {
            String metaKey = "notified_meta_peso_" + pessoa + "_" + (long) (metaP * 10);
            if (!prefs.getBoolean(metaKey, false)) {
                String pesoFmt = String.format(new Locale("pt", "BR"), "%.1f", peso);
                String metaFmt = String.format(new Locale("pt", "BR"), "%.1f", metaP);
                showRichNativeNotification(
                    context,
                    metaKey.hashCode(),
                    "🎉 Parabéns, " + pessoa + "! Meta de Peso Atingida!",
                    "Incrível! " + pessoa + " chegou a " + pesoFmt + " kg e alcançou a meta individual de " + metaFmt + " kg!",
                    "saude",
                    "pesoxaltura",
                    "",
                    "Comemorar na Saúde",
                    ""
                );
                prefs.edit().putBoolean(metaKey, true).apply();
            }
        }
    }

    private static void processSaudeJsonString(Context context, SharedPreferences prefs, String saudeJsonRaw, String hojeStr) {
        try {
            JSONObject saudeObj = new JSONObject(saudeJsonRaw);
            boolean saudeInit = prefs.getBoolean("saude_bg_init", false);

            JSONObject metasPeso = saudeObj.optJSONObject("metasPeso");
            if (metasPeso == null) metasPeso = saudeObj.optJSONObject("metasPorPessoa");
            JSONArray registros = saudeObj.optJSONArray("registrosPesoAltura");
            if (registros == null) registros = saudeObj.optJSONArray("historicoPesoAltura");

            if (registros != null) {
                for (int i = 0; i < registros.length(); i++) {
                    JSONObject reg = registros.optJSONObject(i);
                    if (reg == null) continue;
                    String regId = reg.optString("id", "");
                    String pessoa = reg.optString("pessoa", "Vitórya");
                    double peso = reg.optDouble("peso", 0.0);
                    double metaP = reg.optDouble("metaPeso", metasPeso != null ? metasPeso.optDouble(pessoa, 0.0) : 0.0);
                    checkAndNotifySingleWeightRecord(context, prefs, regId, pessoa, peso, metaP, saudeInit);
                }
            }

            // Remédios no horário cadastrado (suporta fixo ou por alguns dias até dataFim)
            JSONArray medicamentos = saudeObj.optJSONArray("medicamentos");
            if (medicamentos != null) {
                for (int i = 0; i < medicamentos.length(); i++) {
                    JSONObject med = medicamentos.optJSONObject(i);
                    if (med == null) continue;
                    if (!med.optBoolean("ativo", true) || !med.optBoolean("lembreteAtivo", true)) continue;
                    String tipoTratamento = med.optString("tipoTratamento", "fixo");
                    String dataFim = med.optString("dataFim", "");
                    if ("dias".equalsIgnoreCase(tipoTratamento) && !dataFim.isEmpty() && hojeStr.compareTo(dataFim) > 0) {
                        continue;
                    }
                    String medId = med.optString("id", "");
                    String medNome = med.optString("nome", "");
                    String medDosagem = med.optString("dosagem", "");
                    String medInstrucoes = med.optString("instrucoes", "");
                    if (medId.isEmpty() || medNome.isEmpty()) continue;

                    JSONArray horariosArr = med.optJSONArray("horarios");
                    if (horariosArr != null && horariosArr.length() > 0) {
                        for (int j = 0; j < horariosArr.length(); j++) {
                            String h = horariosArr.optString(j, "").trim();
                            checkAndNotifySingleMedicineTime(context, prefs, medId, medNome, medDosagem, medInstrucoes, h, hojeStr);
                        }
                    } else {
                        String medHorario = med.optString("horario", "");
                        if (!medHorario.isEmpty()) {
                            String[] horarios = medHorario.split("[,;/\\s]+");
                            for (String h : horarios) {
                                checkAndNotifySingleMedicineTime(context, prefs, medId, medNome, medDosagem, medInstrucoes, h.trim(), hojeStr);
                            }
                        }
                    }
                }
            }

            if (!saudeInit) prefs.edit().putBoolean("saude_bg_init", true).apply();
        } catch (Exception ignored) {}
    }

    private static String formatBrDate(String iso) {
        if (iso == null) return "";
        String[] p = iso.split("-");
        if (p.length == 3) return p[2] + "/" + p[1] + "/" + p[0];
        return iso;
    }

    private static String getFirestoreString(JSONObject fields, String key) {
        JSONObject f = fields.optJSONObject(key);
        if (f == null) return "";
        if (f.has("stringValue")) return f.optString("stringValue", "");
        if (f.has("integerValue")) return String.valueOf(f.optLong("integerValue", 0));
        return "";
    }

    private static long getFirestoreLong(JSONObject fields, String key, long def) {
        JSONObject f = fields.optJSONObject(key);
        if (f == null) return def;
        if (f.has("integerValue")) return f.optLong("integerValue", def);
        if (f.has("doubleValue")) return (long) f.optDouble("doubleValue", def);
        return def;
    }

    private static double getFirestoreDouble(JSONObject fields, String key, double def) {
        JSONObject f = fields.optJSONObject(key);
        if (f == null) return def;
        if (f.has("doubleValue")) return f.optDouble("doubleValue", def);
        if (f.has("integerValue")) return (double) f.optLong("integerValue", (long) def);
        return def;
    }

    private static boolean getFirestoreBoolean(JSONObject fields, String key, boolean def) {
        JSONObject f = fields.optJSONObject(key);
        if (f == null) return def;
        if (f.has("booleanValue")) return f.optBoolean("booleanValue", def);
        return def;
    }

    public static void ensureNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Alertas Financeiros, Saúde e Agenda",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Notificações de vencimento de contas, saúde, caixinhas e compromissos da agenda");
            channel.enableVibration(true);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(channel);
        }
    }

    private static android.graphics.Bitmap downloadBitmapForNotification(String imageUrl) {
        if (imageUrl == null || imageUrl.trim().isEmpty()) return null;
        HttpURLConnection conn = null;
        try {
            String clean = imageUrl.trim();
            if (clean.startsWith("data:image")) {
                int commaIdx = clean.indexOf(",");
                if (commaIdx > 0) {
                    byte[] decoded = android.util.Base64.decode(clean.substring(commaIdx + 1), android.util.Base64.DEFAULT);
                    return android.graphics.BitmapFactory.decodeByteArray(decoded, 0, decoded.length);
                }
            }
            if (!clean.startsWith("http://") && !clean.startsWith("https://")) return null;
            URL url = new URL(clean);
            conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(6000);
            conn.setDoInput(true);
            conn.connect();
            if (conn.getResponseCode() == 200) {
                return android.graphics.BitmapFactory.decodeStream(conn.getInputStream());
            }
        } catch (Exception ignored) {
        } finally {
            if (conn != null) conn.disconnect();
        }
        return null;
    }

    public static void showNativeNotification(Context context, int id, String title, String body) {
        showRichNativeNotification(context, id, title, body, "", "", "", "", "");
    }

    public static void showNativeNotificationWithTarget(
        Context context,
        int id,
        String title,
        String body,
        String targetModal,
        String targetSaudeTab
    ) {
        showRichNativeNotification(context, id, title, body, targetModal, targetSaudeTab, "", "", "");
    }

    public static void showRichNativeNotification(
        Context context,
        int id,
        String title,
        String body,
        String targetModal,
        String targetSaudeTab,
        String linkUrl,
        String actionButtonText,
        String imageUrl
    ) {
        if (context == null) return;
        // Executa em thread de background caso tenha imagem HTTP para baixar sem bloquear a UI Thread
        new Thread(() -> {
            try {
                ensureNotificationChannel(context);
                NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm == null) return;

                int safeNotifId = Math.abs(id == 0 ? 1001 : id);

                Intent launchIntent = new Intent(context, MainActivity.class);
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                if (targetModal != null && !targetModal.isEmpty()) {
                    launchIntent.putExtra("openModal", targetModal);
                }
                if (targetSaudeTab != null && !targetSaudeTab.isEmpty()) {
                    launchIntent.putExtra("saudeTab", targetSaudeTab);
                }
                if (linkUrl != null && !linkUrl.trim().isEmpty()) {
                    launchIntent.putExtra("openLinkUrl", linkUrl.trim());
                }

                PendingIntent contentIntent = PendingIntent.getActivity(
                    context,
                    safeNotifId,
                    launchIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );

                int smallIconRes = context.getResources().getIdentifier("ic_stat_sutello", "drawable", context.getPackageName());
                if (smallIconRes == 0) {
                    smallIconRes = context.getApplicationInfo().icon;
                }

                NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                    .setSmallIcon(smallIconRes)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .setDefaults(NotificationCompat.DEFAULT_ALL)
                    .setAutoCancel(true)
                    .setContentIntent(contentIntent)
                    .setColor(0xFF9333EA);

                // Se tiver imagem anexada, baixa e aplica BigPictureStyle + LargeIcon nativo do Android!
                android.graphics.Bitmap bmp = downloadBitmapForNotification(imageUrl);
                if (bmp != null) {
                    builder.setLargeIcon(bmp);
                    builder.setStyle(
                        new NotificationCompat.BigPictureStyle()
                            .bigPicture(bmp)
                            .bigLargeIcon((android.graphics.Bitmap) null)
                            .setBigContentTitle(title)
                            .setSummaryText(body)
                    );
                } else {
                    builder.setStyle(new NotificationCompat.BigTextStyle().bigText(body));
                }

                // 1º Botão de Ação Nativo na barra do Android (Ex: Abrir Aba ou Botão Personalizado)
                String btnLabel = (actionButtonText != null && !actionButtonText.trim().isEmpty())
                    ? actionButtonText.trim()
                    : (targetModal != null && !targetModal.isEmpty() ? "Abrir no App" : "");

                if (linkUrl != null && linkUrl.trim().startsWith("http")) {
                    Intent browserIntent = new Intent(Intent.ACTION_VIEW, android.net.Uri.parse(linkUrl.trim()));
                    browserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    PendingIntent linkPendingIntent = PendingIntent.getActivity(
                        context,
                        safeNotifId + 1,
                        browserIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                    );
                    String linkBtnTitle = !btnLabel.isEmpty() ? btnLabel : "🔗 Abrir Link";
                    builder.addAction(0, linkBtnTitle, linkPendingIntent);
                    builder.addAction(0, "Abrir App", contentIntent);
                } else if (!btnLabel.isEmpty()) {
                    builder.addAction(0, btnLabel, contentIntent);
                }

                nm.notify(safeNotifId, builder.build());
            } catch (Exception ignored) {}
        }).start();
    }
}
