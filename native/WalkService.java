package com.hz.hztrip;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.VibrationEffect;
import android.os.Vibrator;
import java.io.File;
import java.io.FileWriter;
import java.util.Locale;

/**
 * Perekam jalur Walking (v0.15.2): berjalan mengelilingi batas blok, layar boleh mati.
 * Titik disimpan ke walk.csv (waktu_ms,lat,lng,akurasi); halaman peta membacanya lewat plugin.
 * Terpisah dari TripService, tidak masuk Riwayat.
 */
public class WalkService extends Service {
    static final String ACTION_START = "com.hz.hztrip.WALK_START";
    static final String ACTION_STOP = "com.hz.hztrip.WALK_STOP";
    static final String CH = "hztrip_walk";
    static final int NOTIF_ID = 1003;
    static final float BAD_ACC = 15f;
    static final long BAD_MS = 30000L;
    static final long VIB_EVERY_MS = 60000L;

    private LocationManager lm;
    private HandlerThread ht;
    private FileWriter out;
    private boolean on = false;
    private long badSince = 0L;
    private long lastVib = 0L;
    private int count = 0;

    static File file(Context c) {
        return new File(c.getFilesDir(), "walk.csv");
    }

    @Override
    public IBinder onBind(Intent i) {
        return null;
    }

    @Override
    public int onStartCommand(Intent i, int flags, int startId) {
        String a = i == null ? null : i.getAction();
        if (ACTION_STOP.equals(a)) {
            stopWalk();
            stopSelf();
            return START_NOT_STICKY;
        }
        goForeground();
        if (!on) {
            startWalk();
        }
        return START_NOT_STICKY;
    }

    private void goForeground() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm != null && nm.getNotificationChannel(CH) == null) {
            NotificationChannel ch = new NotificationChannel(CH, "Walking (jalur blok)", NotificationManager.IMPORTANCE_LOW);
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CH) : new Notification.Builder(this);
        b.setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setContentTitle("HZ Trip · Walking")
                .setContentText("Mencatat jalur blok. Buka app untuk melihat.")
                .setOngoing(true)
                .setContentIntent(pi);
        Notification n = b.build();
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(NOTIF_ID, n);
        }
    }

    private void startWalk() {
        try {
            out = new FileWriter(file(this), false);
        } catch (Exception e) {
            stopSelf();
            return;
        }
        lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        ht = new HandlerThread("hz-walk");
        ht.start();
        try {
            lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 0f, listener, ht.getLooper());
            on = true;
        } catch (SecurityException e) {
            stopSelf();
        } catch (Exception e) {
            stopSelf();
        }
    }

    private void stopWalk() {
        on = false;
        try {
            if (lm != null) {
                lm.removeUpdates(listener);
            }
        } catch (Exception ignored) {
        }
        try {
            if (ht != null) {
                ht.quitSafely();
            }
        } catch (Exception ignored) {
        }
        try {
            if (out != null) {
                out.flush();
                out.close();
            }
        } catch (Exception ignored) {
        }
        out = null;
        stopForeground(true);
    }

    private void vibrate() {
        try {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v == null) {
                return;
            }
            if (Build.VERSION.SDK_INT >= 26) {
                v.vibrate(VibrationEffect.createWaveform(new long[]{0, 200, 100, 200}, -1));
            } else {
                v.vibrate(new long[]{0, 200, 100, 200}, -1);
            }
        } catch (Exception ignored) {
        }
    }

    private final LocationListener listener = new LocationListener() {
        @Override
        public void onLocationChanged(Location l) {
            if (!on || out == null || l == null) {
                return;
            }
            float acc = l.hasAccuracy() ? l.getAccuracy() : 99f;
            long t = System.currentTimeMillis();
            try {
                out.write(String.format(Locale.US, "%d,%.7f,%.7f,%.1f\n", t, l.getLatitude(), l.getLongitude(), acc));
                out.flush();
                count++;
            } catch (Exception ignored) {
            }
            // akurasi buruk lebih dari 30 detik: getar singkat (sekali tiap menit), supaya terasa walau layar mati
            if (acc > BAD_ACC) {
                if (badSince == 0L) {
                    badSince = t;
                }
                if (t - badSince >= BAD_MS && t - lastVib >= VIB_EVERY_MS) {
                    lastVib = t;
                    vibrate();
                }
            } else {
                badSince = 0L;
            }
        }

        @Override
        public void onStatusChanged(String p, int s, Bundle b) {
        }

        @Override
        public void onProviderEnabled(String p) {
        }

        @Override
        public void onProviderDisabled(String p) {
        }
    };

    @Override
    public void onDestroy() {
        stopWalk();
        super.onDestroy();
    }
}
