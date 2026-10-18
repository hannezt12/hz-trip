package com.hz.hztrip;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;

/**
 * Foreground service perekam GPS HZ Trip.
 * Tahap 1: perekaman manual (Mulai/Akhiri). Setiap titik GPS ditulis mentah ke
 * files/points/points-YYYY-MM-DD.csv dengan format:
 *   waktu_ms,lat,lng,kecepatan_m_per_s,akurasi_m
 * Memakai LocationManager (tanpa Google Play Services), jadi tidak ada
 * dependensi tambahan di Gradle.
 */
public class TripService extends Service implements LocationListener {

    public static final String ACTION_START = "com.hz.hztrip.START";
    public static final String ACTION_STOP = "com.hz.hztrip.STOP";
    static final String CHANNEL_ID = "hztrip_rec";
    static final int NOTIF_ID = 1001;
    static final String PREFS = "hztrip";
    static final String PREF_REC = "recording";

    public interface Listener {
        void onFix(long t, double lat, double lng, float speedMs, float acc, int count);
        void onState(boolean recording);
    }

    public static volatile Listener listener;
    public static volatile TripService instance;
    public static volatile boolean recording = false;
    public static volatile long lastT = 0;
    public static volatile float lastSpeed = 0f;
    public static volatile float lastAcc = 0f;
    public static volatile int count = 0;
    public static volatile long startedAt = 0;

    private LocationManager lm;
    private HandlerThread ht;
    private PowerManager.WakeLock wl;
    private BufferedWriter writer;
    private long nextMidnight = 0;
    private Location prev;
    private boolean gpsOn = true;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopRecording();
            return START_NOT_STICKY;
        }
        if (intent == null) {
            // Dihidupkan ulang oleh sistem setelah service dimatikan: lanjut hanya jika tadi sedang merekam.
            boolean was = getSharedPreferences(PREFS, MODE_PRIVATE).getBoolean(PREF_REC, false);
            if (!was) {
                stopSelf();
                return START_NOT_STICKY;
            }
        }
        startRecording();
        return START_STICKY;
    }

    private void startRecording() {
        if (recording && lm != null) {
            return;
        }
        createChannel();
        Notification n = buildNotification(getString(R.string.app_name) + " merekam", "Ketuk untuk membuka. GPS dipantau tiap detik.");
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(NOTIF_ID, n);
        }
        instance = this;
        count = 0;
        startedAt = System.currentTimeMillis();
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean(PREF_REC, true).apply();

        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "hztrip:rec");
            wl.setReferenceCounted(false);
            wl.acquire(16L * 60L * 60L * 1000L);
        }

        ht = new HandlerThread("hztrip-gps");
        ht.start();
        lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        try {
            lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 0f, this, ht.getLooper());
            gpsOn = lm.isProviderEnabled(LocationManager.GPS_PROVIDER);
        } catch (SecurityException e) {
            updateNotification("Izin lokasi belum diberikan", "Buka HZ Trip dan izinkan lokasi.");
        } catch (Exception e) {
            updateNotification("GPS tidak bisa dibuka", String.valueOf(e.getMessage()));
        }
        if (!gpsOn) {
            updateNotification("GPS ponsel mati", "Nyalakan GPS agar perjalanan terekam.");
        }
        recording = true;
        Listener l = listener;
        if (l != null) {
            l.onState(true);
        }
    }

    void stopRecording() {
        try {
            if (lm != null) {
                lm.removeUpdates(this);
            }
        } catch (Exception ignored) {
        }
        lm = null;
        closeWriter();
        if (ht != null) {
            ht.quitSafely();
            ht = null;
        }
        if (wl != null && wl.isHeld()) {
            wl.release();
        }
        wl = null;
        recording = false;
        instance = null;
        prev = null;
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean(PREF_REC, false).apply();
        if (Build.VERSION.SDK_INT >= 24) {
            stopForeground(Service.STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
        Listener l = listener;
        if (l != null) {
            l.onState(false);
        }
        stopSelf();
    }

    @Override
    public void onDestroy() {
        if (recording) {
            // Service dimatikan sistem saat masih merekam: tutup berkas dengan rapi,
            // flag PREF_REC dibiarkan true supaya sistem/aplikasi bisa melanjutkan.
            try {
                if (lm != null) {
                    lm.removeUpdates(this);
                }
            } catch (Exception ignored) {
            }
            closeWriter();
            if (wl != null && wl.isHeld()) {
                wl.release();
            }
            recording = false;
            instance = null;
            Listener l = listener;
            if (l != null) {
                l.onState(false);
            }
        }
        super.onDestroy();
    }

    // ---------- GPS ----------

    @Override
    public void onLocationChanged(Location loc) {
        long t = loc.getTime() > 0 ? loc.getTime() : System.currentTimeMillis();
        float acc = loc.hasAccuracy() ? loc.getAccuracy() : 99f;
        float speed;
        if (loc.hasSpeed()) {
            speed = loc.getSpeed();
        } else if (prev != null && t > prev.getTime()) {
            speed = prev.distanceTo(loc) / ((t - prev.getTime()) / 1000f);
        } else {
            speed = 0f;
        }
        prev = loc;
        try {
            ensureWriter(t);
            writer.write(t + "," + String.format(Locale.US, "%.6f,%.6f,%.2f,%.0f", loc.getLatitude(), loc.getLongitude(), speed, acc));
            writer.write('\n');
            writer.flush();
        } catch (Exception e) {
            updateNotification("Gagal menulis data", String.valueOf(e.getMessage()));
        }
        count++;
        lastT = t;
        lastSpeed = speed;
        lastAcc = acc;
        Listener l = listener;
        if (l != null) {
            l.onFix(t, loc.getLatitude(), loc.getLongitude(), speed, acc, count);
        }
    }

    @Override
    public void onProviderDisabled(String provider) {
        if (LocationManager.GPS_PROVIDER.equals(provider)) {
            gpsOn = false;
            updateNotification("GPS ponsel mati", "Nyalakan GPS agar perjalanan terekam.");
        }
    }

    @Override
    public void onProviderEnabled(String provider) {
        if (LocationManager.GPS_PROVIDER.equals(provider)) {
            gpsOn = true;
            updateNotification(getString(R.string.app_name) + " merekam", "Ketuk untuk membuka. GPS dipantau tiap detik.");
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onStatusChanged(String provider, int status, Bundle extras) {
    }

    // ---------- Berkas ----------

    private void ensureWriter(long t) throws Exception {
        if (writer != null && t < nextMidnight) {
            return;
        }
        closeWriter();
        File dir = new File(getFilesDir(), "points");
        if (!dir.exists()) {
            dir.mkdirs();
        }
        String day = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new java.util.Date(t));
        writer = new BufferedWriter(new FileWriter(new File(dir, "points-" + day + ".csv"), true), 8192);
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(t);
        c.set(Calendar.HOUR_OF_DAY, 0);
        c.set(Calendar.MINUTE, 0);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        c.add(Calendar.DAY_OF_MONTH, 1);
        nextMidnight = c.getTimeInMillis();
    }

    private void closeWriter() {
        try {
            if (writer != null) {
                writer.flush();
                writer.close();
            }
        } catch (Exception ignored) {
        }
        writer = null;
    }

    // ---------- Notifikasi ----------

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null && nm.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Perekaman perjalanan", NotificationManager.IMPORTANCE_LOW);
                ch.setDescription("Tampil selama HZ Trip merekam kecepatan");
                ch.setShowBadge(false);
                nm.createNotificationChannel(ch);
            }
        }
    }

    private Notification buildNotification(String title, String text) {
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent openPi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Intent stop = new Intent(this, TripService.class).setAction(ACTION_STOP);
        PendingIntent stopPi = PendingIntent.getService(this, 1, stop, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setContentTitle(title)
                .setContentText(text)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setContentIntent(openPi)
                .addAction(0, "Akhiri", stopPi)
                .build();
    }

    private void updateNotification(String title, String text) {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.notify(NOTIF_ID, buildNotification(title, text));
            }
        } catch (Exception ignored) {
        }
    }
}
