package com.sutello.financeiro;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

import org.json.JSONArray;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Bloqueia Print Screen, Gravação de Tela e Miniatura em Apps Recentes nativamente no Android (igual apps de banco)
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        );
        super.onCreate(savedInstanceState);

        // Remove imediatamente qualquer notificação fixa antiga e inicia o sincronizador 100% invisível
        SutelloRealtimeSyncService.clearLegacyForegroundNotification(this);
        CloudSyncReceiver.ensureNotificationChannel(this);
        CloudSyncReceiver.scheduleNextSync(this);
        SutelloSyncJobService.scheduleSyncJobs(this);
        SutelloRealtimeSyncService.startRealtimeService(this);

        // Solicita isenção de economia de bateria do Android (apenas 1x) para que o serviço em 2º plano nunca seja pausado
        requestBatteryOptimizationExemptionOnce();

        // Registra ponte JS -> Android Nativo e blindagem contra "Page not found" no WebView
        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                WebView webView = this.bridge.getWebView();
                webView.addJavascriptInterface(new SutelloNativeBridge(this, webView), "SutelloNativeAndroid");

                // Blindagem anti-erro 404 / Page Not Found: se qualquer URL remota falhar, volta imediatamente para o https://localhost nativo
                webView.setWebViewClient(new BridgeWebViewClient(this.bridge) {
                    @Override
                    public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
                        super.onReceivedHttpError(view, request, errorResponse);
                        if (request != null && request.isForMainFrame() && errorResponse != null && errorResponse.getStatusCode() >= 400) {
                            recoverToLocalBundle(view);
                        }
                    }

                    @Override
                    public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                        super.onReceivedError(view, request, error);
                        if (request != null && request.isForMainFrame()) {
                            String url = request.getUrl() != null ? request.getUrl().toString() : "";
                            if (!url.startsWith("https://localhost")) {
                                recoverToLocalBundle(view);
                            }
                        }
                    }
                });

                // Se houver uma URL pública válida (ex: Vercel) salva e não for link privado do AI Studio, carrega com segurança
                SharedPreferences prefs = getSharedPreferences(CloudSyncReceiver.PREFS_NAME, Context.MODE_PRIVATE);
                String savedOtaUrl = prefs.getString("ota_live_url", "");
                if (savedOtaUrl != null && !savedOtaUrl.isEmpty()) {
                    if (isValidPublicOtaUrl(savedOtaUrl)) {
                        webView.loadUrl(savedOtaUrl);
                    } else {
                        prefs.edit().remove("ota_live_url").apply();
                    }
                }
            }
        } catch (Exception ignored) {}

        handleNotificationIntent(getIntent());
    }

    private static boolean isValidPublicOtaUrl(String url) {
        if (url == null) return false;
        String clean = url.trim().toLowerCase();
        // Nunca aceita links temporários/privados do AI Studio (.run.app) que dão Page Not Found no WebView
        if (!clean.startsWith("https://") || clean.contains(".run.app") || clean.contains("localhost")) {
            return false;
        }
        return true;
    }

    private void recoverToLocalBundle(WebView view) {
        try {
            SharedPreferences prefs = getSharedPreferences(CloudSyncReceiver.PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().remove("ota_live_url").apply();
            if (view != null) {
                view.post(() -> view.loadUrl("https://localhost"));
            }
        } catch (Exception ignored) {}
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleNotificationIntent(intent);
    }

    private void handleNotificationIntent(Intent intent) {
        if (intent == null) return;
        final String openModal = intent.getStringExtra("openModal");
        final String saudeTab = intent.getStringExtra("saudeTab");
        final String openLinkUrl = intent.getStringExtra("openLinkUrl");

        if (openLinkUrl != null && openLinkUrl.startsWith("http")) {
            try {
                Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(openLinkUrl));
                browserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(browserIntent);
            } catch (Exception ignored) {}
        }

        if (openModal != null && !openModal.isEmpty() && this.bridge != null && this.bridge.getWebView() != null) {
            final String safeModal = openModal.replace("'", "");
            final String safeTab = saudeTab != null ? saudeTab.replace("'", "") : "";
            this.bridge.getWebView().postDelayed(() -> {
                try {
                    String js = "localStorage.setItem('sutello_pending_target_modal', JSON.stringify({targetModal:'" + safeModal + "', targetSaudeTab:'" + safeTab + "', ts: Date.now()}));" +
                        "window.dispatchEvent(new CustomEvent('sutello_heads_up_notification', { detail: { id: 'intent_' + Date.now(), title: 'Abrindo aba...', body: '', targetModal: '" + safeModal + "', targetSaudeTab: '" + safeTab + "', timestamp: Date.now() } }));";
                    this.bridge.getWebView().evaluateJavascript(js, null);
                } catch (Exception ignored) {}
            }, 600);
        }
    }

    private void requestBatteryOptimizationExemptionOnce() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + getPackageName()));
                    startActivity(intent);
                }
            } catch (Exception ignored) {}
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        );
        SutelloRealtimeSyncService.clearLegacyForegroundNotification(this);
        CloudSyncReceiver.scheduleNextSync(this);
        SutelloSyncJobService.scheduleSyncJobs(this);
        SutelloRealtimeSyncService.startRealtimeService(this);
    }

    @Override
    public void onStop() {
        super.onStop();
        // Garante que ao minimizar ou fechar o aplicativo o serviço em tempo real, o JobService e o alarme continuem ativos
        CloudSyncReceiver.scheduleNextSync(this);
        SutelloSyncJobService.scheduleSyncJobs(this);
        SutelloRealtimeSyncService.startRealtimeService(this);
    }

    public static class SutelloNativeBridge {
        private final Context context;
        private final WebView webView;

        public SutelloNativeBridge(Context context, WebView webView) {
            this.context = context.getApplicationContext();
            this.webView = webView;
        }

        @JavascriptInterface
        public void registerLoggedUser(String uid, String projectId, String apiKey) {
            registerLoggedUserWithToken(uid, projectId, apiKey, "", "", "");
        }

        @JavascriptInterface
        public void registerLoggedUserWithToken(String uid, String projectId, String apiKey, String idToken, String refreshToken) {
            registerLoggedUserWithToken(uid, projectId, apiKey, idToken, refreshToken, "");
        }

        @JavascriptInterface
        public void registerLoggedUserWithToken(String uid, String projectId, String apiKey, String idToken, String refreshToken, String deviceId) {
            if (uid == null || uid.trim().isEmpty()) return;
            SharedPreferences prefs = context.getSharedPreferences(CloudSyncReceiver.PREFS_NAME, Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit()
                .putString("uid", uid.trim())
                .putString("projectId", (projectId != null && !projectId.isEmpty()) ? projectId : "sutello-financeiro")
                .putString("apiKey", apiKey != null ? apiKey : "");

            if (idToken != null && !idToken.isEmpty()) {
                editor.putString("idToken", idToken);
                editor.putLong("tokenRefreshedAt", System.currentTimeMillis());
            }
            if (refreshToken != null && !refreshToken.isEmpty()) {
                editor.putString("refreshToken", refreshToken);
            }
            if (deviceId != null && !deviceId.isEmpty()) {
                editor.putString("deviceId", deviceId);
            }
            editor.apply();
            CloudSyncReceiver.scheduleNextSync(context);
            SutelloSyncJobService.scheduleSyncJobs(context);
            SutelloRealtimeSyncService.startRealtimeService(context);
        }

        @JavascriptInterface
        public void syncModulesForNativeBackground(String saudeJson, String caixinhasJson, String agendaJson) {
            try {
                SharedPreferences prefs = context.getSharedPreferences(CloudSyncReceiver.PREFS_NAME, Context.MODE_PRIVATE);
                SharedPreferences.Editor editor = prefs.edit();
                if (saudeJson != null) editor.putString("local_saude_json", saudeJson);
                if (caixinhasJson != null) editor.putString("local_caixinhas_json", caixinhasJson);
                if (agendaJson != null) editor.putString("local_agenda_json", agendaJson);
                editor.apply();
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public void applyOtaUpdate(String liveUrl, String version, String buildId) {
            SharedPreferences prefs = context.getSharedPreferences(CloudSyncReceiver.PREFS_NAME, Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit();
            if (version != null && !version.isEmpty()) {
                editor.putString("installed_app_version", version);
            }
            if (buildId != null && !buildId.isEmpty()) {
                editor.putString("installed_build_id", buildId);
            }

            final String cleanUrl = liveUrl != null ? liveUrl.trim() : "";
            final boolean useRemoteVercel = isValidPublicOtaUrl(cleanUrl);
            if (useRemoteVercel) {
                editor.putString("ota_live_url", cleanUrl);
            } else {
                editor.remove("ota_live_url");
            }
            editor.apply();

            if (webView != null) {
                webView.post(() -> {
                    try {
                        webView.clearCache(true);
                        if (useRemoteVercel) {
                            String sep = cleanUrl.contains("?") ? "&" : "?";
                            webView.loadUrl(cleanUrl + sep + "ota_updated=" + System.currentTimeMillis());
                        } else {
                            webView.loadUrl("https://localhost/?ota_updated=" + System.currentTimeMillis());
                        }
                    } catch (Exception ignored) {}
                });
            }
        }

        @JavascriptInterface
        public void syncKnownAccountsSnapshot(String allContaIdsJson, String paidContaIdsJson) {
            try {
                SharedPreferences prefs = context.getSharedPreferences(CloudSyncReceiver.PREFS_NAME, Context.MODE_PRIVATE);
                SharedPreferences.Editor editor = prefs.edit();
                if (allContaIdsJson != null && !allContaIdsJson.isEmpty()) {
                    JSONArray allArr = new JSONArray(allContaIdsJson);
                    for (int i = 0; i < allArr.length(); i++) {
                        String id = allArr.optString(i, "");
                        if (!id.isEmpty()) {
                            editor.putBoolean("known_conta_" + id, true);
                        }
                    }
                }
                if (paidContaIdsJson != null && !paidContaIdsJson.isEmpty()) {
                    JSONArray paidArr = new JSONArray(paidContaIdsJson);
                    for (int i = 0; i < paidArr.length(); i++) {
                        String id = paidArr.optString(i, "");
                        if (!id.isEmpty()) {
                            editor.putBoolean("paid_conta_" + id, true);
                        }
                    }
                }
                editor.putBoolean("contas_bg_initialized", true);
                editor.apply();
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public void triggerNativeNotificationNow(String title, String body) {
            int id = (int) (System.currentTimeMillis() % 2147483000);
            CloudSyncReceiver.showNativeNotification(context, id, title, body);
        }

        @JavascriptInterface
        public void triggerNativeNotificationWithTarget(String title, String body, String targetModal, String targetSaudeTab) {
            int id = (int) (System.currentTimeMillis() % 2147483000);
            CloudSyncReceiver.showRichNativeNotification(context, id, title, body, targetModal, targetSaudeTab, "", "", "");
        }

        @JavascriptInterface
        public void triggerNativeNotificationWithTarget(String title, String body, int id, String targetModal, String targetSaudeTab) {
            CloudSyncReceiver.showRichNativeNotification(context, id, title, body, targetModal, targetSaudeTab, "", "", "");
        }

        @JavascriptInterface
        public void triggerRichNativeNotification(
            String title,
            String body,
            String targetModal,
            String targetSaudeTab,
            String linkUrl,
            String actionButtonText,
            String imageUrl
        ) {
            int id = (int) (System.currentTimeMillis() % 2147483000);
            CloudSyncReceiver.showRichNativeNotification(
                context,
                id,
                title,
                body,
                targetModal != null ? targetModal : "",
                targetSaudeTab != null ? targetSaudeTab : "",
                linkUrl != null ? linkUrl : "",
                actionButtonText != null ? actionButtonText : "",
                imageUrl != null ? imageUrl : ""
            );
        }
    }
}
