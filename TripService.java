package com.hz.hztrip;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.ComponentName;
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
import java.io.FileInputStream;
import java.io.FileOutputStream;
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
    public static final String ACTION_NOTIF = "com.hz.hztrip.NOTIF";   // masuk mode Notifikasi aktif
    public static final String ACTION_OFF = "com.hz.hztrip.OFF";       // matikan semua
    public static final String ACTION_TRIG = "com.hz.hztrip.TRIG";     // pemicu dari Android (kendaraan / geofence)

    static final String CHANNEL_ID = "hztrip_rec";
    static final int NOTIF_ID = 1001;
    static final int NOTIF_REMIND = 1002;

    public static final int M_OFF = 0, M_SIAGA = 1, M_CEK = 2, M_REKAM = 3;

    // Parameter (lihat Tahap 4 untuk penyetelan baterai)
    static final double START_KMH = 5.0;
    static final long START_HOLD_MS = 5000L;
    static final long NO_FAST_MS = 5L * 60000L;
    static final double MOVE_KMH = 3.0;
    static final double FAST_KMH = 10.0;
    static final long STOP_WAIT_MS = 5L * 60000L;
    static final long SLOW_WAIT_MS = 10L * 60000L;
    static final long CEK_MOTION_MS = 180000L;
    static final long CEK_PROBE_MS = 30000L;
    static final long PROBE_EVERY_MS = 60000L;
    static final long REARM_DELAY_MS = 60000L;
    static final long REMIND_MS = 30L * 60000L;
    static final float MAX_ACC = 50f;
    static final float ACC_START = 100f;   // akurasi posisi yang masih dipercaya untuk pemicu kecepatan (Doppler akurat)
    static final float ACC_FENCE = 150f;   // akurasi terburuk untuk pemicu pagar (jarak dikurangi akurasi harus tetap di luar)
    static final long CEK_EXTEND_MS = 30000L;
    static final int CEK_EXTEND_MAX = 3;
    static final String DIAG_FILE = "diag.log";
    private static final Object DLOCK = new Object();

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
    private boolean everFast = false;
    private double sessMax = 0;
    private double sessMeters = 0;
    private double prevKmh = 0;
    private long lastNotifMs = 0;
    private int fenceHits = 0;
    private Location anchor = null;
    private boolean notifOnly = false;
    private boolean anchorFresh = false;
    private boolean recManual = false;
    private boolean pending = false;
    private long recFirstT = 0L;
    static final long PENDING_MS = 120000L;
    private boolean cekAndroid = false;
    private int cekExt = 0;
    private boolean cekGood = false;
    private long cekStart = 0;
    private long cekFirstFix = 0;

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
        loadAnchor();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        final String action = intent == null ? null : intent.getAction();
        final String why = intent == null ? null : intent.getStringExtra("why");
        if (!ACTION_STOP.equals(action)) {
            // Wajib tampil sebagai foreground segera setelah startForegroundService.
            goForeground();
        }
        h.post(new Runnable() {
            @Override
            public void run() {
                handleCommand(action, why);
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

    private void handleCommand(String action, String why) {
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
                p.edit().putBoolean("manual", false).putBoolean("notif", true).apply();
                diag("Rekam manual diakhiri");
                endRecording();
                afterTrip();
            } else {
                long we = Sched.windowEnd(this, now);
                if (we > 0L) {
                    p.edit().putLong("pausedUntil", we).apply();
                }
                p.edit().putBoolean("notif", true).apply();
                diag("Jeda otomatis: masuk Notifikasi aktif");
                shutdown();
            }
        } else if (ACTION_NOTIF.equals(action) || ACTION_OFF.equals(action)) {
            if (mode == M_REKAM) {
                return;
            }
            boolean on = ACTION_NOTIF.equals(action);
            long we = Sched.windowEnd(this, now);
            SharedPreferences.Editor e = p.edit().putBoolean("notif", on);
            if (we > 0L) {
                e.putLong("pausedUntil", we);
            }
            e.apply();
            diag(on ? "Notifikasi aktif dinyalakan" : "Semua dimatikan");
            shutdown();
        } else if (ACTION_TRIG.equals(action)) {
            if (manual || mode == M_REKAM || mode == M_CEK) {
                return;
            }
            if (!Sched.autoPossible(this, now)) {
                if (mode == M_OFF && p.getBoolean("notif", false)) {
                    if (now < p.getLong("alertUntil", 0L)) {
                        shutdown();
                        return;
                    }
                    diag("Pemicu Android (notifikasi aktif): " + why);
                    notifOnly = true;
                    mode = M_SIAGA;
                    toCek(CEK_MOTION_MS, "pemicu " + why);
                    return;
                }
                if (mode == M_OFF) {
                    shutdown();
                }
                return;
            }
            if (mode == M_OFF) {
                anchorFresh = false;
                afterTrip();
            }
            if (mode == M_SIAGA) {
                diag("Pemicu Android: " + why);
                cekAndroid = true;
                toCek(CEK_MOTION_MS, "pemicu " + why);
            }
        } else if (ACTION_AUTO.equals(action) || ACTION_RESUME.equals(action)) {
            if (ACTION_RESUME.equals(action)) {
                p.edit().putLong("pausedUntil", 0L).apply();
                if (!Sched.autoPossible(this, now) && mode == M_OFF) {
                    shutdown();
                    return;
                }
            }
            if (mode == M_OFF) {
                anchorFresh = false;
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
                    anchorFresh = false;
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
        Sched.p(this).edit().putBoolean("notif", false).apply();
        diag("Siaga" + (anchor != null ? " (pagar " + Sched.p(this).getInt("radius", 150) + " m)" : " (belum ada titik acuan)"));
        registerPassive();
        Trig.arm(this, anchor, Sched.p(this).getInt("radius", 150));
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
                toCek(CEK_PROBE_MS, "periksa berkala");
            }
        }
    };

    private void toCek(long maxMs, String why) {
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
        fenceHits = 0;
        cekExt = 0;
        cekGood = false;
        cekFirstFix = 0;
        cekStart = System.currentTimeMillis();
        diag("Cek mulai (" + why + "), GPS dinyalakan " + (maxMs / 1000L) + " dtk");
        acquireWl(maxMs + CEK_EXTEND_MS * CEK_EXTEND_MAX + 30000L);
        startGps();
        h.postDelayed(cekTimeout, maxMs);
        updateNotif();
        notifyState();
    }

    private final Runnable cekTimeout = new Runnable() {
        @Override
        public void run() {
            if (mode == M_CEK) {
                if (!cekGood && cekExt < CEK_EXTEND_MAX) {
                    cekExt++;
                    diag("Belum ada posisi akurat, Cek diperpanjang " + cekExt + "/" + CEK_EXTEND_MAX + " (+" + (CEK_EXTEND_MS / 1000L) + " dtk)");
                    h.postDelayed(this, CEK_EXTEND_MS);
                    return;
                }
                diag("Cek selesai tanpa pemicu (" + (cekGood ? "posisi didapat, tidak bergerak" : "tidak ada posisi akurat") + ")");
                stopGps();
                releaseWl();
                boolean na = notifOnly, ca = cekAndroid;
                notifOnly = false;
                cekAndroid = false;
                if (ca && !na) {
                    Alert.fire(TripService.this);
                }
                if (!na && Sched.autoPossible(TripService.this, System.currentTimeMillis())) {
                    enterSiaga(REARM_DELAY_MS);
                } else {
                    shutdown();
                }
            }
        }
    };

    private final Runnable autoRec = new Runnable() {
        @Override
        public void run() {
            if (pending && mode == M_CEK) {
                pending = false;
                diag("Popup tidak ditutup: rekam otomatis");
                toRekam();
            }
        }
    };

    /** Dipanggil saat tombol Tutup pada popup ditekan: tidak merekam, titik yang ditampung dibuang. */
    void dismissPending() {
        if (h == null) {
            return;
        }
        h.post(new Runnable() {
            @Override
            public void run() {
                if (pending) {
                    pending = false;
                    h.removeCallbacks(autoRec);
                    stopGps();
                    releaseWl();
                    buffer.clear();
                    bufferT.clear();
                    diag("Popup ditutup: tidak merekam");
                    shutdown();
                }
            }
        });
    }

    private void toRekam() {
        pending = false;
        h.removeCallbacks(autoRec);
        Alert.cancel(this, false);
        notifOnly = false;
        cekAndroid = false;
        h.removeCallbacks(cekTimeout);
        h.removeCallbacks(probeRun);
        stopPassive();
        cancelSig();
        long now = System.currentTimeMillis();
        mode = M_REKAM;
        recManual = manual;
        recFirstT = bufferT.isEmpty() ? now : bufferT.get(0);
        diag("Rekam mulai" + (manual ? " (manual)" : " (otomatis)"));
        everFast = false;
        sessMax = 0;
        sessMeters = 0;
        prevKmh = 0;
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
        if (!everFast && now - startedAt >= NO_FAST_MS) {
            // Jalan kaki / tidak pernah melaju: akhiri tanpa memindahkan titik acuan.
            diag("Rekam selesai: tidak pernah melaju (jalan kaki)");
            endRecording();
            afterTrip();
            return;
        }
        if (now - lastMove >= STOP_WAIT_MS || now - lastFast >= SLOW_WAIT_MS) {
            diag("Rekam selesai: " + (now - lastMove >= STOP_WAIT_MS ? "berhenti lebih dari 5 menit" : "merayap di bawah 10 km/j lebih dari 10 menit"));
            endRecording();
            afterTrip();
        }
    }

    private void endRecording() {
        h.removeCallbacks(watchdog);
        long durMs = System.currentTimeMillis() - startedAt;
        boolean falseRec = !recManual && durMs > 30L * 60000L && sessMeters < 500.0;
        if (!falseRec && (everFast || recManual)) {
            saveAnchor();
            anchorFresh = anchor != null;
        } else {
            anchorFresh = false;
        }
        stopGps();
        closeWriter();
        if (falseRec) {
            dropSince(recFirstT);
            diag("Rekaman dibuang: " + (durMs / 60000L) + " menit tetapi hanya " + Math.round(sessMeters) + " m (kurang dari 500 m dalam lebih dari 30 menit)");
        }
        releaseWl();
        mode = M_OFF;
        cancelRemind();
    }

    /** Hapus titik dari waktu t sampai sekarang (rekaman otomatis yang salah). */
    private void dropSince(long fromT) {
        try {
            File dir = new File(getFilesDir(), "points");
            long now = System.currentTimeMillis();
            Calendar c = Calendar.getInstance();
            c.setTimeInMillis(fromT);
            while (c.getTimeInMillis() <= now) {
                String day = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(c.getTime());
                File f = new File(dir, "points-" + day + ".csv");
                if (f.exists()) {
                    File tmp = new File(dir, "points-" + day + ".csv.tmp");
                    java.io.BufferedReader in = new java.io.BufferedReader(new java.io.InputStreamReader(new FileInputStream(f), "UTF-8"));
                    java.io.BufferedWriter out = new java.io.BufferedWriter(new java.io.OutputStreamWriter(new FileOutputStream(tmp), "UTF-8"));
                    String line;
                    while ((line = in.readLine()) != null) {
                        int k = line.indexOf(',');
                        boolean drop = false;
                        if (k > 0) {
                            try {
                                drop = Long.parseLong(line.substring(0, k)) >= fromT;
                            } catch (NumberFormatException ignored) {
                            }
                        }
                        if (!drop) {
                            out.write(line);
                            out.write('\n');
                        }
                    }
                    in.close();
                    out.flush();
                    out.close();
                    if (!tmp.renameTo(f)) {
                        f.delete();
                        tmp.renameTo(f);
                    }
                }
                c.add(Calendar.DAY_OF_MONTH, 1);
            }
        } catch (Exception ignored) {
        }
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
        notifOnly = false;
        cekAndroid = false;
        pending = false;
        if (Sched.p(this).getBoolean("notif", false)) {
            Trig.enterNotif(this);
        } else {
            Trig.disarm(this);
        }
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
                        toCek(CEK_MOTION_MS, "sensor gerak");
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
            if (mode != M_SIAGA || !loc.hasAccuracy() || loc.getAccuracy() > ACC_FENCE) {
                return;
            }
            if (mode != M_SIAGA) {
                return;
            }
            if (loc.hasSpeed() && loc.getSpeed() * 3.6 >= START_KMH) {
                toCek(CEK_MOTION_MS, "posisi pasif: kecepatan " + Math.round(loc.getSpeed() * 3.6) + " km/j");
            } else if (fenceHit(loc)) {
                toCek(CEK_MOTION_MS, "posisi pasif: di luar pagar " + Math.round(loc.distanceTo(anchor)) + " m");
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
                diag("GPS ponsel dimatikan");
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
        Location p0 = prev;
        prev = loc;
        double kmh = speed * 3.6;
        String line = t + "," + String.format(Locale.US, "%.6f,%.6f,%.2f,%.0f,%d", loc.getLatitude(), loc.getLongitude(), speed, acc, manual ? 1 : 0);

        if (mode == M_CEK) {
            buffer.add(line);
            bufferT.add(t);
            while (buffer.size() > (pending ? 600 : 150)) {
                buffer.remove(0);
                bufferT.remove(0);
            }
            if (pending) {
                return;
            }
            boolean go = false;
            String why = "";
            if (cekFirstFix == 0) {
                cekFirstFix = System.currentTimeMillis();
                diag("Posisi pertama setelah " + ((cekFirstFix - cekStart) / 1000L) + " dtk, akurasi " + Math.round(acc) + " m");
            }
            if (acc <= ACC_START) {
                cekGood = true;
            }
            if (acc <= ACC_START && kmh >= START_KMH) {
                if (runStart == 0) {
                    runStart = t;
                }
                if (t - runStart >= START_HOLD_MS) {
                    go = true;
                    why = "kecepatan " + Math.round(kmh) + " km/j, akurasi " + Math.round(acc) + " m";
                }
            } else {
                runStart = 0;
            }
            if (!go && fenceHit(loc)) {
                go = true;
                why = "keluar pagar " + Math.round(loc.distanceTo(anchor)) + " m, akurasi " + Math.round(acc) + " m";
            }
            if (go) {
                diag("Pemicu: " + why);
                if (notifOnly) {
                    // Gerakan terkonfirmasi: GPS tetap menyala menampung titik sementara popup menunggu keputusan.
                    notifOnly = false;
                    cekAndroid = false;
                    h.removeCallbacks(cekTimeout);
                    pending = true;
                    Alert.fire(this);
                    h.postDelayed(autoRec, PENDING_MS);
                    diag("Menunggu keputusan: rekam otomatis bila popup tidak ditutup dalam " + (PENDING_MS / 1000L) + " dtk");
                    return;
                }
                cekAndroid = false;
                toRekam();
            }
        } else if (mode == M_REKAM) {
            writeLine(line, t);
            long now = System.currentTimeMillis();
            if (acc <= MAX_ACC) {
                double cand = Math.min(kmh, prevKmh);
                if (cand > sessMax) {
                    sessMax = cand;
                }
                prevKmh = kmh;
                if (p0 != null && kmh >= MOVE_KMH && t - p0.getTime() <= 10000L && t > p0.getTime()) {
                    sessMeters += p0.distanceTo(loc);
                }
                if (kmh >= MOVE_KMH) {
                    lastMove = now;
                    reminded = false;
                    cancelRemind();
                }
                if (kmh >= FAST_KMH) {
                    lastFast = now;
                    everFast = true;
                }
            }
            checkRecordingEnd(now);
            if (mode == M_REKAM && now - lastNotifMs >= 5000L) {
                lastNotifMs = now;
                updateNotif();
            }
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

    // ================= titik acuan (pagar virtual) =================

    private void loadAnchor() {
        anchor = null;
        try {
            String s = Sched.p(this).getString("anchor", "");
            if (s != null && s.indexOf(',') > 0) {
                String[] a = s.split(",");
                Location l = new Location("anchor");
                l.setLatitude(Double.parseDouble(a[0]));
                l.setLongitude(Double.parseDouble(a[1]));
                anchor = l;
            }
        } catch (Exception ignored) {
        }
    }

    private void saveAnchor() {
        if (prev == null) {
            return;
        }
        anchor = new Location(prev);
        Sched.p(this).edit().putString("anchor", String.format(Locale.US, "%.6f,%.6f", prev.getLatitude(), prev.getLongitude())).apply();
    }

    /** Titik acuan pagar hanya dipakai bila masih segar (tempat berhenti terakhir). Bila tidak, pusat pagar dipindah ke posisi akurat pertama dan tidak memicu rekaman. */
    private boolean fenceHit(Location loc) {
        if (!anchorFresh) {
            if (loc.hasAccuracy() && loc.getAccuracy() <= MAX_ACC) {
                anchor = new Location(loc);
                Sched.p(this).edit().putString("anchor", String.format(Locale.US, "%.6f,%.6f", loc.getLatitude(), loc.getLongitude())).apply();
                anchorFresh = true;
                diag("Titik acuan pagar dipindah ke posisi sekarang (acuan lama sudah tidak berlaku)");
                Trig.arm(this, anchor, Sched.p(this).getInt("radius", 150));
            }
            return false;
        }
        return outsideFenceLoose(loc);
    }

    // ================= catatan diagnostik =================

    void diag(String msg) {
        diagTo(this, msg);
    }

    static void diagTo(Context ctx, String msg) {
        try {
            synchronized (DLOCK) {
                File f = new File(ctx.getFilesDir(), DIAG_FILE);
                String line = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(new Date()) + " " + msg + "\n";
                FileOutputStream o = new FileOutputStream(f, true);
                o.write(line.getBytes("UTF-8"));
                o.close();
                if (f.length() > 60000L) {
                    trimDiag(f);
                }
            }
        } catch (Exception ignored) {
        }
    }

    private static void trimDiag(File f) throws Exception {
        FileInputStream in = new FileInputStream(f);
        byte[] b = new byte[(int) f.length()];
        int n = in.read(b);
        in.close();
        String all = new String(b, 0, Math.max(n, 0), "UTF-8");
        String[] ls = all.split("\n");
        int from = Math.max(0, ls.length - 250);
        StringBuilder sb = new StringBuilder();
        for (int i = from; i < ls.length; i++) {
            sb.append(ls[i]).append('\n');
        }
        FileOutputStream o = new FileOutputStream(f, false);
        o.write(sb.toString().getBytes("UTF-8"));
        o.close();
    }

    /** Satu titik di luar pagar cukup: jarak >= radius (akurasi baik), atau jarak dikurangi akurasi >= radius (akurasi sedang). */
    private boolean outsideFenceLoose(Location loc) {
        if (anchor == null || !loc.hasAccuracy()) {
            return false;
        }
        int r = Sched.p(this).getInt("radius", 150);
        float d = loc.distanceTo(anchor);
        float a = loc.getAccuracy();
        if (a <= MAX_ACC) {
            return d >= r;
        }
        return a <= ACC_FENCE && d - a >= r;
    }

    private boolean outsideFence(Location loc) {
        if (anchor == null) {
            return false;
        }
        int r = Sched.p(this).getInt("radius", 150);
        return loc.distanceTo(anchor) >= r;
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

    private static final Locale ID = new Locale("id", "ID");

    private PendingIntent actionPi(String action, int req) {
        Intent i = new Intent(this, TripService.class).setAction(action);
        return PendingIntent.getService(this, req, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private Notification buildNotif() {
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent openPi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) {
            b = new Notification.Builder(this, CHANNEL_ID);
        } else {
            b = new Notification.Builder(this);
        }
        String title;
        String text;
        int color = 0xFF93A4AD;
        if (mode == M_REKAM) {
            double kmh = lastSpeed * 3.6;
            if (System.currentTimeMillis() - lastT > 15000L) {
                kmh = 0;
            }
            title = (manual ? "Merekam (manual)" : "Merekam") + " \u00B7 " + Math.round(kmh) + " km/j";
            text = String.format(ID, "Maks %d \u00B7 %.1f km", Math.round(sessMax), sessMeters / 1000.0);
            color = kmh > 90 ? 0xFFFF5B50 : (kmh > 60 ? 0xFFF5C518 : 0xFF3FD07A);
            b.setUsesChronometer(true).setWhen(startedAt).setShowWhen(true);
        } else if (mode == M_CEK) {
            title = "HZ Trip memeriksa gerakan";
            text = "GPS menyala sebentar.";
        } else {
            title = "HZ Trip siaga";
            long we = Sched.windowEnd(this, System.currentTimeMillis());
            if (we > 0L) {
                Calendar c = Calendar.getInstance();
                c.setTimeInMillis(we);
                text = String.format(Locale.US, "Menunggu gerakan \u00B7 jadwal sampai %02d.%02d", c.get(Calendar.HOUR_OF_DAY), c.get(Calendar.MINUTE));
            } else {
                text = "Menunggu gerakan.";
            }
        }
        b.setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setContentTitle(title)
                .setContentText(text)
                .setColor(color)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setContentIntent(openPi);
        if (mode == M_REKAM) {
            b.addAction(new Notification.Action.Builder(android.R.drawable.ic_media_pause, "Akhiri", actionPi(ACTION_STOP, 1)).build());
            b.addAction(new Notification.Action.Builder(android.R.drawable.ic_menu_view, "Buka", openPi).build());
        } else {
            b.addAction(new Notification.Action.Builder(android.R.drawable.ic_media_play, "Mulai rekam", actionPi(ACTION_START, 3)).build());
            b.addAction(new Notification.Action.Builder(android.R.drawable.ic_media_pause, "Jeda otomatis", actionPi(ACTION_STOP, 1)).build());
        }
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
        try {
            if (Build.VERSION.SDK_INT >= 24) {
                android.service.quicksettings.TileService.requestListeningState(this, new ComponentName(this, HzTileService.class));
            }
        } catch (Exception ignored) {
        }
        Listener l = listener;
        if (l != null) {
            l.onState();
        }
    }
}
