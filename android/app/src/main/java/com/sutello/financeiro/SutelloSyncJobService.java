package com.sutello.financeiro;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.os.Build;
import android.os.PowerManager;

/**
 * JobService Nativo do Android (100% invisível na barra de notificações).
 * Mantém a sincronização com o Firebase ativa em segundo plano mesmo após horas/dias com o app fechado
 * (incluindo Xiaomi MIUI/HyperOS, Samsung OneUI e Motorola), sem usar Foreground Notification.
 */
public class SutelloSyncJobService extends JobService {
    private static final int JOB_ID_IMMEDIATE = 7788;
    private static final int JOB_ID_PERIODIC = 7789;
    private volatile boolean isCancelled = false;

    public static void scheduleSyncJobs(Context context) {
        if (context == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) return;
        try {
            JobScheduler scheduler = (JobScheduler) context.getSystemService(Context.JOB_SCHEDULER_SERVICE);
            if (scheduler == null) return;

            ComponentName serviceComponent = new ComponentName(context, SutelloSyncJobService.class);

            // 1. Job rápido encadeado (roda a cada ~15 segundos quando há internet, sem ícone na barra)
            JobInfo.Builder fastBuilder = new JobInfo.Builder(JOB_ID_IMMEDIATE, serviceComponent)
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setMinimumLatency(12000L)
                .setOverrideDeadline(25000L)
                .setPersisted(true);

            scheduler.schedule(fastBuilder.build());

            // 2. Job periódico persistente de segurança (garante despertar mesmo após reboot ou Doze profundo)
            boolean hasPeriodic = false;
            for (JobInfo job : scheduler.getAllPendingJobs()) {
                if (job.getId() == JOB_ID_PERIODIC) {
                    hasPeriodic = true;
                    break;
                }
            }
            if (!hasPeriodic) {
                JobInfo.Builder periodicBuilder = new JobInfo.Builder(JOB_ID_PERIODIC, serviceComponent)
                    .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                    .setPeriodic(15 * 60 * 1000L)
                    .setPersisted(true);
                scheduler.schedule(periodicBuilder.build());
            }
        } catch (Exception ignored) {}
    }

    @Override
    public boolean onStartJob(final JobParameters params) {
        isCancelled = false;
        SutelloRealtimeSyncService.clearLegacyForegroundNotification(getApplicationContext());

        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        final PowerManager.WakeLock wakeLock = pm != null
            ? pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "SutelloFinanceiro::JobSyncWakeLock")
            : null;
        if (wakeLock != null) {
            try {
                wakeLock.acquire(55000L);
            } catch (Exception ignored) {}
        }

        new Thread(() -> {
            try {
                // Executa 4 verificações espaçadas de 10 segundos dentro da janela de rede oficial do JobService
                // (No JobService o Android libera acesso total à internet em segundo plano!)
                for (int step = 0; step < 4; step++) {
                    if (isCancelled) break;
                    CloudSyncReceiver.checkFirebaseAndNotify(getApplicationContext());
                    if (step < 3 && !isCancelled) {
                        Thread.sleep(10000L);
                    }
                }
            } catch (Exception ignored) {
            } finally {
                // Reagenda o próximo ciclo encadeado e também o AlarmClock invisível
                scheduleSyncJobs(getApplicationContext());
                CloudSyncReceiver.scheduleNextSync(getApplicationContext());
                if (wakeLock != null && wakeLock.isHeld()) {
                    try {
                        wakeLock.release();
                    } catch (Exception ignored) {}
                }
                jobFinished(params, false);
            }
        }).start();

        return true; // Trabalho rodando em thread assíncrona
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        isCancelled = true;
        scheduleSyncJobs(getApplicationContext());
        CloudSyncReceiver.scheduleNextSync(getApplicationContext());
        return true; // Reagenda automaticamente se o sistema interromper
    }
}
