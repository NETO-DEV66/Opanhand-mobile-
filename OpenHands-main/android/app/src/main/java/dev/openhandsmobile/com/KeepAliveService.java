package dev.openhandsmobile.com;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.app.NotificationCompat;

/**
 * Keeps the app process alive while it is in the background.
 *
 * A WebView-only app is otherwise a "cached" process the OS is free to freeze
 * or kill the moment the user leaves it: the conversation socket drops, the UI
 * stops receiving events, and returning shows a stale screen. Running a
 * foreground service lifts the process out of that bucket, so the WebView keeps
 * executing and the socket stays open no matter how long the app is hidden.
 *
 * A partial wake lock is held alongside it so the CPU does not sleep and stall
 * the network thread. The service is stopped only when the activity is really
 * going away (the user closes the app), never on a plain background/foreground
 * cycle.
 */
public class KeepAliveService extends Service {

    private static final String CHANNEL_ID = "openhands_keepalive";
    private static final int NOTIFICATION_ID = 1001;
    private static final String PREFS = "openhands_keepalive";
    private static final String KEY_BATTERY_ASKED = "battery_asked";

    private PowerManager.WakeLock wakeLock;

    public static void start(Context context) {
        Intent intent = new Intent(context, KeepAliveService.class);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
        } catch (Exception ignored) {
            // Starting a foreground service can be refused (e.g. an Android 12+
            // background-start restriction). The app still runs, just without
            // the process-lifetime guarantee, so a failure here is not fatal.
        }
    }

    public static void stop(Context context) {
        context.stopService(new Intent(context, KeepAliveService.class));
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
        acquireWakeLock();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForegroundCompat();
        maybeAskForBatteryExemption();
        // Restart if the OS reclaims the process, so "always running" survives
        // low-memory kills too.
        return START_STICKY;
    }

    private void startForegroundCompat() {
        Notification notification = buildNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            // Android 14+ requires the service type to be declared at
            // startForeground() time. "specialUse" has no implicit duration
            // limit, which is what lets the app run indefinitely.
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
            );
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    @Override
    public void onDestroy() {
        releaseWakeLock();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void acquireWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) return;
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm == null) return;
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "OpenHands::KeepAlive");
        wakeLock.setReferenceCounted(false);
        try {
            // No timeout: the lock is released in onDestroy, so it lives exactly
            // as long as the service does.
            wakeLock.acquire();
        } catch (Exception ignored) {
        }
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
            } catch (Exception ignored) {
            }
        }
        wakeLock = null;
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null || nm.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Background activity",
            NotificationManager.IMPORTANCE_MIN
        );
        channel.setDescription("Keeps OpenHands connected while it is in the background.");
        channel.setShowBadge(false);
        nm.createNotificationChannel(channel);
    }

    private Notification buildNotification() {
        Intent launch = new Intent(this, MainActivity.class);
        launch.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            piFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent contentIntent = PendingIntent.getActivity(this, 0, launch, piFlags);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("OpenHands is running")
            .setContentText("Staying connected in the background")
            .setSmallIcon(android.R.drawable.stat_notify_sync_noanim)
            .setContentIntent(contentIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setShowWhen(false)
            .build();
    }

    /**
     * Battery optimisation is what actually kills backgrounded apps on most
     * OEM builds. Ask once for an exemption; the user can decline and the app
     * still works, just with the usual battery-driven throttling.
     */
    private void maybeAskForBatteryExemption() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm == null) return;

        String packageName = getPackageName();
        if (pm.isIgnoringBatteryOptimizations(packageName)) return;

        SharedPreferences prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (prefs.getBoolean(KEY_BATTERY_ASKED, false)) return;
        prefs.edit().putBoolean(KEY_BATTERY_ASKED, true).apply();

        try {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + packageName));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (Exception ignored) {
            // Some OEM builds do not expose this screen; nothing to do.
        }
    }
}
