package com.sutello.financeiro;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.SystemClock;

/**
 * Serviço em Segundo Plano 100% Invisível (SEM ícone fixo na barra de notificações)
 * Roda de forma silenciosa usando a isenção de bateria do Android + AlarmManager exato + WakeLock,
 * exatamente como o WhatsApp, mostrando notificação na barra SOMENTE quando houver alerta real!
 */
public class SutelloRealtimeSyncService extends Service {
    public static final String SYNC_CHANNEL_ID = "sutello_realtime_sync_service";
    public static final int SERVICE_NOTIFICATION_ID = 7799;
    private static final long POLL_INTERVAL_MS = 12000L; // 12 segundos em tempo real

    private HandlerThread workerThread;
    private Handler workerHandler;
    private PowerManager.WakeLock serviceWakeLock;
    private volatile boolean isRunning = false;

    private final Runnable syncRunnable = new Runnable() {
        @Override
        public void run() {
            if (!isRunning) return;
            try {
                CloudSyncReceiver.checkFirebaseAndNotify(getApplicationContext());
            } catch (Exception ignored) {
            } finally {
                if (isRunning && workerHandler != null) {
                    workerHandler.postDelayed(this, POLL_INTERVAL_MS);
                }
            }
        }
    };

    public static void startRealtimeService(Context context) {
        if (context == null) return;
        // Garante que qualquer notificação fixa antiga de versão anterior seja removida imediatamente
        clearLegacyForegroundNotification(context);
        try {
            Intent serviceIntent = new Intent(context, SutelloRealtimeSyncService.class);
            // Usa startService comum (sem startForegroundService) para NUNCA exibir notificação fixa na barra!
            context.startService(serviceIntent);
        } catch (Exception e) {
            // Quando o app está 100% fechado no Android 12+, o AlarmManager exato + WakeLock do CloudSyncReceiver assume automaticamente sem nenhuma notificação fixa
            CloudSyncReceiver.scheduleNextSync(context);
        }
    }

    public static void clearLegacyForegroundNotification(Context context) {
        try {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(SERVICE_NOTIFICATION_ID);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    nm.deleteNotificationChannel(SYNC_CHANNEL_ID);
                }
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onCreate() {
        super.onCreate();
        clearLegacyForegroundNotification(this);
        CloudSyncReceiver.ensureNotificationChannel(this);

        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                serviceWakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "SutelloFinanceiro::RealtimeBgWakeLock");
                serviceWakeLock.setReferenceCounted(false);
                serviceWakeLock.acquire(60 * 60 * 1000L);
            }
        } catch (Exception ignored) {}

        workerThread = new HandlerThread("SutelloRealtimeSyncWorker");
        workerThread.start();
        workerHandler = new Handler(workerThread.getLooper());
        isRunning = true;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // Garante que NÃO haja notificação fixa na barra de status
        try {
            stopForeground(true);
        } catch (Exception ignored) {}
        clearLegacyForegroundNotification(this);

        try {
            if (serviceWakeLock != null && !serviceWakeLock.isHeld()) {
                serviceWakeLock.acquire(60 * 60 * 1000L);
            }
        } catch (Exception ignored) {}

        if (workerHandler != null) {
            workerHandler.removeCallbacks(syncRunnable);
            workerHandler.post(syncRunnable);
        }

        // Mantém o AlarmManager e o JobService agendados para funcionar mesmo se o sistema recolher o serviço após alguns minutos
        CloudSyncReceiver.scheduleNextSync(this);
        SutelloSyncJobService.scheduleSyncJobs(this);

        return START_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // Quando o usuário fecha o app arrastando dos "Apps Recentes", reagenda o alarme e o JobService invisível em segundo plano
        restartWithInvisibleAlarm();
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        isRunning = false;
        if (workerHandler != null) {
            workerHandler.removeCallbacks(syncRunnable);
        }
        if (workerThread != null) {
            workerThread.quitSafely();
        }
        try {
            if (serviceWakeLock != null && serviceWakeLock.isHeld()) {
                serviceWakeLock.release();
            }
        } catch (Exception ignored) {}
        restartWithInvisibleAlarm();
        super.onDestroy();
    }

    private void restartWithInvisibleAlarm() {
        try {
            CloudSyncReceiver.scheduleNextSync(getApplicationContext());
            SutelloSyncJobService.scheduleSyncJobs(getApplicationContext());
            AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            Intent restartIntent = new Intent(getApplicationContext(), CloudSyncReceiver.class);
            restartIntent.setAction("com.sutello.financeiro.ACTION_BG_CLOUD_SYNC");
            PendingIntent pi = PendingIntent.getBroadcast(
                getApplicationContext(),
                7702,
                restartIntent,
                PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE
            );
            long triggerAt = SystemClock.elapsedRealtime() + 4000L;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                try {
                    am.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi);
                } catch (SecurityException se) {
                    am.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi);
                }
            } else {
                am.setExact(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi);
            }
        } catch (Exception ignored) {}
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
