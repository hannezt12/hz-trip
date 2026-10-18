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
import android.hardware.Sensor;
import android.hardware.SensorManager;
import android.hardware.TriggerEvent;
import android.hardware.TriggerEventListener;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.PowerManager;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

/**
 * Perekam GPS HZ Trip (Tahap 2).
 *
 * Mode:
 *   OFF    = tidur, service tidak berjalan (di luar jadwal atau dijeda)
 *   SIAGA  = di dalam jendela jadwal, GPS mati; menunggu gerakan (sensor gerak signifikan,
 *            titik GPS aplikasi lain, dan pemeriksaan berkala singkat)
 *   CEK    = GPS menyala 1 detik sekali maksimal 90 detik untuk memastikan kendaraan jalan
 *   REKAM  = mencatat titik GPS; berakhir sendiri bila berhenti >= 5 menit
 *            (atau jalan pelan < 10 km/jam selama 10 menit); manual berakhir saat Akhiri.
 *
 * Seluruh logika berjalan di satu thread (HandlerThread) sehingga tanpa kunci.
 * Titik ditulis ke files/points/points-YYYY-MM-DD.csv:
 *   waktu_ms,lat,lng,kecepatan_m_per_s,akurasi_m,manual(0/1)
 */
public class TripService extends Service {

    public static final String ACTION_START = "com.hz.hztrip.START";   // mulai manual
    public static final String ACTION_STOP = "com.hz.hztrip.STOP";     // akhiri / jeda
    public static final String ACTION_AUTO = "com.hz.hztrip.AUTO";     // masuk jendela jadwal
    public static final String ACTION_RESUME = "com.hz.hztrip.RESUME"; // lanjutkan otomatis

    static final String CHANNEL_ID = "hztrip_rec";
    static final int NOTIF_ID = 1001;
    static final int NOTIF_REMIND = 1002;

    public static final int M_OFF = 0, M_SIAGA = 1, M_CEK = 2, M_REKAM = 3;

    // Parameter (lihat Tahap 4 untuk penyetelan baterai)
    static final double START_KMH = 15.0;
    static final long START_HOLD_MS = 10000L;
    static final double MOVE_KMH = 3.0;
    static final double FAST_KMH = 10.0;
    static final long STOP_WAIT_MS = 5L * 60000L;
    static final long SLOW_WAIT_MS = 10L * 60000L;
    static final long CEK_MOTION_MS = 90000L;
    static final long CEK_PROBE_MS = 20000L;
    static final long PROBE_EVERY_MS = 6L * 60000L;
    static final long REARM_DELAY_MS = 60000L;
    static final long REMIND_MS = 30L * 60000L;
    static final float MAX_ACC = 50f;

    public interface Listener {
        void onFix(long t, double lat, double lng, float speedMs, float acc, int count);
        void onState();
    }

    public static volatile Listener listener;
    public static volatile TripService instance;
    public static volatile int mode = M_OFF;
    public static volatile boolean manual = false;
    public static volatile long lastT = 0;
    public static volatile float lastSpeed = 0f;
    public static volatile float lastAcc = 0f;
    public static volatile int count = 0;
    public static volatile long startedAt = 0;

    private Handler h;
    private HandlerThread ht;
    private LocationManager lm;
    private SensorManager sm;
    private Sensor sig;
    private PowerManager.WakeLock wl;
    private BufferedWriter writer;
    private long nextMidnight = 0;
    private Location prev;
    private boolean gpsRunning = false;
    private boolean passiveRunning = false;

    private final ArrayList<String> buffer = new ArrayList<String>();
    private final ArrayList<Long> bufferT = new ArrayList<Long>();
    private long runStart = 0;
    private long lastMove = 0;
    private long lastFast = 0;
    private boolean reminded = false;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        mode = M_OFF;
        ht = new HandlerThread("hztrip-svc");
        ht.start();
        h = new Handler(ht.getLooper());
        lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        sm = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        if (sm != null) {
            sig = sm.getDefaultSensor(Sensor.TYPE_SIGNIFICANT_MOTION);
        }
        createChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        final String action = intent == null ? null : intent.getAction();
        if (!ACTION_STOP.equals(action)) {
            // Wajib tampil sebagai foreground segera setelah startForegroundService.
            goForeground();
        }
        h.post(new Runnable() {
            @Override
            public void run() {
                handleCommand(action);
            }
        });
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        try {
            stopGps();
            stopPassive();
            cancelSig();
            closeWriter();
            releaseWl();
        } catch (Exception ignored) {
        }
        if (ht != null) {
            ht.quitSafely();
        }
        mode = M_OFF;
        instance = null;
        notifyState();
        super.onDestroy();
    }

    // ================= perintah =================

    private void handleCommand(String action) {
        long now = System.currentTimeMillis();
        SharedPreferences p = Sched.p(this);
        if (ACTION_START.equals(action)) {
            manual = true;
            p.edit().putBoolean("manual", true).apply();
            if (mode == M_REKAM) {
                updateNotif();
                notifyState();
            } else {
                leaveWatching();
                toRekam();
            }
        } else if (ACTION_STOP.equals(action)) {
            if (manual) {
                manual = false;
                p.edit().putBoolean("manual", false).apply();
                endRecording();
                afterTrip();
            } else {
                long we = Sched.windowEnd(this, now);
                if (we > 0L) {
                    p.edit().putLong("pausedUntil", we).apply();
                }
                shutdown();
            }
        } else if (ACTION_AUTO.equals(action) || ACTION_RESUME.equals(action)) {
            if (ACTION_RESUME.equals(action)) {
                p.edit().putLong("pausedUntil", 0L).apply();
            }
            if (mode == M_OFF) {
                afterTrip();
            } else {
                updateNotif();
            }
        } else {
            // Dihidupkan ulang sistem (intent kosong) atau perintah tak dikenal.
            if (mode == M_OFF) {
                if (p.getBoolean("manual", false)) {
                    manual = true;
                    toRekam();
                } else {
                    afterTrip();
                }
            }
        }
    }

    /** Dipanggil dari ScheduleReceiver (thread mana pun). */
    public void evaluateAsync() {
        if (h == null) {
            return;
        }
        h.post(new Runnable() {
            @Override
            public void run() {
                long now = System.currentTimeMillis();
                if ((mode == M_SIAGA || mode == M_CEK) && !Sched.autoPossible(TripService.this, now)) {
                    shutdown();
                }
            }
        });
    }

    // ================= perpindahan mode =================

    /** Setelah satu perekaman selesai (atau saat mulai): Siaga bila masih boleh otomatis, jika tidak tidur. */
    private void afterTrip() {
        long now = System.currentTimeMillis();
        if (!manual && Sched.autoPossible(this, now)) {
            enterSiaga(0L);
        } else if (manual) {
            toRekam();
        } else {
            shutdown();
        }
    }

    private void enterSiaga(long sigDelayMs) {
        h.removeCallbacksAndMessages(null);
        stopGps();
        closeWriter();
        releaseWl();
        buffer.clear();
        bufferT.clear();
        runStart = 0;
        mode = M_SIAGA;
        registerPassive();
        if (sigDelayMs <= 0L) {
            armSig();
        } else {
            h.postDelayed(new Runnable() {
                @Override
                public void run() {
                    if (mode == M_SIAGA) {
                        armSig();
                    }
                }
            }, sigDelayMs);
        }
        h.postDelayed(probeRun, PROBE_EVERY_MS);
        updateNotif();
        notifyState();
    }

    private final Runnable probeRun = new Runnable() {
        @Override
        public void run() {
            if (mode == M_SIAGA) {
                toCek(CEK_PROBE_MS);
            }
        }
    };

    private void toCek(long maxMs) {
        if (mode != M_SIAGA) {
            return;
        }
        h.removeCallbacks(probeRun);
        mode = M_CEK;
        stopPassive();
        cancelSig();
        buffer.clear();
        bufferT.clear();
        runStart = 0;
        acquireWl(maxMs + 30000L);
        startGps();
        h.postDelayed(cekTimeout, maxMs);
        updateNotif();
        notifyState();
    }

    private final Runnable cekTimeout = new Runnable() {
        @Override
        public void run() {
            if (mode == M_CEK) {
                stopGps();
                releaseWl();
                if (Sched.autoPossible(TripService.this, System.currentTimeMillis())) {
                    enterSiaga(REARM_DELAY_MS);
                } else {
                    shutdown();
                }
            }
        }
    };

    private void toRekam() {
        h.removeCallbacks(cekTimeout);
        h.removeCallbacks(probeRun);
        stopPassive();
        cancelSig();
        long now = System.currentTimeMillis();
        mode = M_REKAM;
        lastMove = now;
        lastFast = now;
        reminded = false;
        startedAt = now;
        acquireWl(16L * 60L * 60L * 1000L);
        startGps();
        // Tulis titik penyangga (awal gerak yang terjadi saat masa Cek) lebih dulu.
        for (int i = 0; i < buffer.size(); i++) {
            writeLine(buffer.get(i), bufferT.get(i));
        }
        buffer.clear();
        bufferT.clear();
        h.postDelayed(watchdog, 30000L);
        updateNotif();
        notifyState();
    }

    private final Runnable watchdog = new Runnable() {
        @Override
        public void run() {
            if (mode != M_REKAM) {
                return;
            }
            checkRecordingEnd(System.currentTimeMillis());
            if (mode == M_REKAM) {
                h.postDelayed(this, 30000L);
            }
        }
    };

    private void checkRecordingEnd(long now) {
        if (manual) {
            if (!reminded && now - lastMove >= REMIND_MS) {
                reminded = true;
                remind();
            }
            return;
        }
        if (now - lastMove >= STOP_WAIT_MS || now - lastFast >= SLOW_WAIT_MS) {
            endRecording();
            afterTrip();
        }
    }

    private void endRecording() {
        h.removeCallbacks(watchdog);
        stopGps();
        closeWriter();
        releaseWl();
        mode = M_OFF;
        cancelRemind();
    }

    private void leaveWatching() {
        h.removeCallbacks(cekTimeout);
        h.removeCallbacks(probeRun);
        stopPassive();
        cancelSig();
    }

    private void shutdown() {
        h.removeCallbacksAndMessages(null);
        stopGps();
        stopPassive();
        cancelSig();
        closeWriter();
        releaseWl();
        cancelRemind();
        mode = M_OFF;
        manual = false;
        Sched.p(this).edit().putBoolean("manual", false).apply();
        notifyState();
        if (Build.VERSION.SDK_INT >= 24) {
            stopForeground(Service.STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
        stopSelf();
    }

    // ================= GPS dan sensor =================

    private void startGps() {
        if (gpsRunning || lm == null) {
            return;
        }
        try {
            lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 0f, gpsListener, ht.getLooper());
            gpsRunning = true;
            prev = null;
        } catch (SecurityException e) {
            Sched.warn(this, "Izin lokasi belum lengkap", "Buka HZ Trip lalu izinkan lokasi.");
        } catch (Exception e) {
            Sched.warn(this, "GPS tidak bisa dibuka", String.valueOf(e.getMessage()));
        }
    }

    private void stopGps() {
        if (!gpsRunning || lm == null) {
            return;
        }
        try {
            lm.removeUpdates(gpsListener);
        } catch (Exception ignored) {
        }
        gpsRunning = false;
    }

    private void registerPassive() {
        if (passiveRunning || lm == null) {
            return;
        }
        try {
            lm.requestLocationUpdates(LocationManager.PASSIVE_PROVIDER, 0L, 0f, passiveListener, ht.getLooper());
            passiveRunning = true;
        } catch (Exception ignored) {
        }
    }

    private void stopPassive() {
        if (!passiveRunning || lm == null) {
            return;
        }
        try {
            lm.removeUpdates(passiveListener);
        } catch (Exception ignored) {
        }
        passiveRunning = false;
    }

    private final TriggerEventListener trig = new TriggerEventListener() {
        @Override
        public void onTrigger(TriggerEvent event) {
            if (h == null) {
                return;
            }
            h.post(new Runnable() {
                @Override
                public void run() {
                    if (mode == M_SIAGA) {
                        toCek(CEK_MOTION_MS);
                    }
                }
            });
        }
    };

    private void armSig() {
        if (sm == null || sig == null) {
            return;
        }
        try {
            sm.requestTriggerSensor(trig, sig);
        } catch (Exception ignored) {
        }
    }

    private void cancelSig() {
        if (sm == null || sig == null) {
            return;
        }
        try {
            sm.cancelTriggerSensor(trig, sig);
        } catch (Exception ignored) {
        }
    }

    private final LocationListener passiveListener = new LocationListener() {
        @Override
        public void onLocationChanged(Location loc) {
            if (mode == M_SIAGA && loc.hasSpeed() && loc.hasAccuracy() && loc.getAccuracy() <= MAX_ACC
                    && loc.getSpeed() * 3.6 >= START_KMH) {
                toCek(CEK_MOTION_MS);
            }
        }

        @Override
        public void onProviderDisabled(String provider) {
        }

        @Override
        public void onProviderEnabled(String provider) {
        }

        @Override
        @SuppressWarnings("deprecation")
        public void onStatusChanged(String provider, int status, Bundle extras) {
        }
    };

    private final LocationListener gpsListener = new LocationListener() {
        @Override
        public void onLocationChanged(Location loc) {
            handleFix(loc);
        }

        @Override
        public void onProviderDisabled(String provider) {
            if (LocationManager.GPS_PROVIDER.equals(provider)) {
                Sched.warn(TripService.this, "GPS ponsel mati", "Nyalakan GPS agar perjalanan terekam.");
            }
        }

        @Override
        public void onProviderEnabled(String provider) {
        }

        @Override
        @SuppressWarnings("deprecation")
        public void onStatusChanged(String provider, int status, Bundle extras) {
        }
    };

    // ================= titik GPS =================

    private void handleFix(Location loc) {
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
        double kmh = speed * 3.6;
        String line = t + "," + String.format(Locale.US, "%.6f,%.6f,%.2f,%.0f,%d", loc.getLatitude(), loc.getLongitude(), speed, acc, manual ? 1 : 0);

        if (mode == M_CEK) {
            buffer.add(line);
            bufferT.add(t);
            while (buffer.size() > 150) {
                buffer.remove(0);
                bufferT.remove(0);
            }
            if (acc <= MAX_ACC && kmh >= START_KMH) {
                if (runStart == 0) {
                    runStart = t;
                }
                if (t - runStart >= START_HOLD_MS) {
                    toRekam();
                }
            } else {
                runStart = 0;
            }
        } else if (mode == M_REKAM) {
            writeLine(line, t);
            long now = System.currentTimeMillis();
            if (acc <= MAX_ACC) {
                if (kmh >= MOVE_KMH) {
                    lastMove = now;
                    reminded = false;
                    cancelRemind();
                }
                if (kmh >= FAST_KMH) {
                    lastFast = now;
                }
            }
            checkRecordingEnd(now);
        } else {
            return;
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

    // ================= berkas =================

    private void writeLine(String line, long t) {
        try {
            ensureWriter(t);
            writer.write(line);
            writer.write('\n');
            writer.flush();
        } catch (Exception e) {
            Sched.warn(this, "Gagal menulis data", String.valueOf(e.getMessage()));
        }
    }

    private void ensureWriter(long t) throws Exception {
        if (writer != null && t < nextMidnight) {
            return;
        }
        closeWriter();
        File dir = new File(getFilesDir(), "points");
        if (!dir.exists()) {
            dir.mkdirs();
        }
        String day = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(t));
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

    // ================= wake lock =================

    private void acquireWl(long ms) {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm == null) {
                return;
            }
            if (wl == null) {
                wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "hztrip:rec");
                wl.setReferenceCounted(false);
            }
            wl.acquire(ms);
        } catch (Exception ignored) {
        }
    }

    private void releaseWl() {
        try {
            if (wl != null && wl.isHeld()) {
                wl.release();
            }
        } catch (Exception ignored) {
        }
    }

    // ================= notifikasi =================

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null && nm.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Perekaman perjalanan", NotificationManager.IMPORTANCE_LOW);
                ch.setDescription("Tampil selama HZ Trip siaga atau merekam");
                ch.setShowBadge(false);
                nm.createNotificationChannel(ch);
            }
        }
    }

    private String titleNow() {
        if (mode == M_REKAM) {
            return manual ? "HZ Trip merekam (manual)" : "HZ Trip merekam";
        }
        if (mode == M_CEK) {
            return "HZ Trip memeriksa gerakan";
        }
        return "HZ Trip siaga";
    }

    private String textNow() {
        if (mode == M_REKAM) {
            return manual ? "Ketuk Akhiri bila sudah selesai." : "Otomatis berhenti sendiri setelah 5 menit diam.";
        }
        if (mode == M_CEK) {
            return "GPS menyala sebentar.";
        }
        long we = Sched.windowEnd(this, System.currentTimeMillis());
        if (we > 0L) {
            Calendar c = Calendar.getInstance();
            c.setTimeInMillis(we);
            return String.format(Locale.US, "Menunggu gerakan, jadwal sampai %02d.%02d", c.get(Calendar.HOUR_OF_DAY), c.get(Calendar.MINUTE));
        }
        return "Menunggu gerakan.";
    }

    private Notification buildNotif() {
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent openPi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Intent stop = new Intent(this, TripService.class).setAction(ACTION_STOP);
        PendingIntent stopPi = PendingIntent.getService(this, 1, stop, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) {
            b = new Notification.Builder(this, CHANNEL_ID);
        } else {
            b = new Notification.Builder(this);
        }
        b.setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setContentTitle(titleNow())
                .setContentText(textNow())
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setContentIntent(openPi);
        String label = (mode == M_REKAM) ? "Akhiri" : "Jeda otomatis";
        b.addAction(new Notification.Action.Builder(android.R.drawable.ic_media_pause, label, stopPi).build());
        return b.build();
    }

    private void goForeground() {
        Notification n = buildNotif();
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(NOTIF_ID, n);
        }
    }

    private void updateNotif() {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.notify(NOTIF_ID, buildNotif());
            }
        } catch (Exception ignored) {
        }
    }

    private void remind() {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) {
                return;
            }
            Intent stop = new Intent(this, TripService.class).setAction(ACTION_STOP);
            PendingIntent stopPi = PendingIntent.getService(this, 2, stop, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            Notification.Builder b;
            if (Build.VERSION.SDK_INT >= 26) {
                b = new Notification.Builder(this, CHANNEL_ID);
            } else {
                b = new Notification.Builder(this);
            }
            b.setSmallIcon(android.R.drawable.ic_menu_mylocation)
                    .setContentTitle("Masih merekam?")
                    .setContentText("Kendaraan sudah diam lebih dari 30 menit.")
                    .setAutoCancel(true)
                    .addAction(new Notification.Action.Builder(android.R.drawable.ic_media_pause, "Akhiri", stopPi).build());
            nm.notify(NOTIF_REMIND, b.build());
        } catch (Exception ignored) {
        }
    }

    private void cancelRemind() {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(NOTIF_REMIND);
            }
        } catch (Exception ignored) {
        }
    }

    private void notifyState() {
        Listener l = listener;
        if (l != null) {
            l.onState();
        }
    }
}
