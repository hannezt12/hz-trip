package com.hz.hztrip;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import com.google.android.gms.location.ActivityTransition;
import com.google.android.gms.location.ActivityTransitionEvent;
import com.google.android.gms.location.ActivityTransitionResult;
import com.google.android.gms.location.DetectedActivity;
import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingEvent;

/** Menerima kejadian "naik kendaraan", "keluar pagar virtual" dan "keluar Tempat" dari Android, lalu membangunkan perekam. */
public class TrigReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        String a = null;
        try {
            String why = null;
            a = i == null ? null : i.getAction();
            if (Trig.ACT_PLACE.equals(a)) {
                onPlace(c, i);
                return;
            }
            if (Trig.ACT_ALERT2.equals(a)) {
                Alert.second(c);
                return;
            }
            if (Trig.ACT_DISMISS.equals(a)) {
                Alert.cancel(c, true);
                return;
            }
            if (Trig.ACT_VEH.equals(a)) {
                if (ActivityTransitionResult.hasResult(i)) {
                    for (ActivityTransitionEvent e : ActivityTransitionResult.extractResult(i).getTransitionEvents()) {
                        if (e.getActivityType() != DetectedActivity.IN_VEHICLE) {
                            continue;
                        }
                        if (e.getTransitionType() == ActivityTransition.ACTIVITY_TRANSITION_ENTER) {
                            why = "naik kendaraan";
                            TripService.diagTo(c, "Android: naik kendaraan terdeteksi");
                        } else if (e.getTransitionType() == ActivityTransition.ACTIVITY_TRANSITION_EXIT) {
                            // Turun dari kendaraan: popup boleh muncul lagi pada perjalanan berikutnya.
                            Sched.p(c).edit().putLong("alertUntil", 0L).apply();
                            TripService.diagTo(c, "Android: turun dari kendaraan");
                        }
                    }
                } else {
                    TripService.diagTo(c, "Android: kejadian aktivitas tanpa hasil");
                }
            } else if (Trig.ACT_FENCE.equals(a)) {
                GeofencingEvent ev = GeofencingEvent.fromIntent(i);
                if (ev == null) {
                    TripService.diagTo(c, "Android: kejadian pagar kosong");
                } else if (ev.hasError()) {
                    // Contoh: GEOFENCE_NOT_AVAILABLE (1000) setelah lokasi dimatikan lalu dinyalakan; pagar dibuang sistem.
                    TripService.diagTo(c, "Android: pagar galat kode " + ev.getErrorCode() + ", dipasang ulang");
                    recover(c);
                } else if (ev.getGeofenceTransition() == Geofence.GEOFENCE_TRANSITION_EXIT) {
                    why = "keluar pagar virtual (geofence)";
                    TripService.diagTo(c, "Android: keluar pagar acuan terdeteksi");
                }
            }
            if (why == null) {
                return;
            }
            long tn = System.currentTimeMillis();
            if (!Sched.autoPossible(c, tn) && !Sched.placeWatch(c, tn)) {
                TripService.diagTo(c, "Pemicu diabaikan (" + why + "): " + skipReason(c));
                return;
            }
            wake(c, TripService.ACTION_TRIG, why);
        } catch (Throwable t) {
            TripService.diagTo(c, "TrigReceiver galat (" + a + "): " + t);
        }
    }

    private static String skipReason(Context c) {
        if (!Sched.autoEnabled(c)) {
            return "rekam otomatis dimatikan";
        }
        if (System.currentTimeMillis() < Sched.pausedUntil(c)) {
            return "sedang dijeda";
        }
        if (Sched.inPlace(c)) {
            return "sedang di dalam Tempat";
        }
        return "tidak diizinkan";
    }

    /** Bangunkan TripService. Kegagalan (mis. Android menolak service latar depan) dicatat dan diberitahukan, tidak ditelan diam-diam. */
    private static void wake(Context c, String action, String why) {
        Intent s = new Intent(c, TripService.class).setAction(action).putExtra("why", why);
        try {
            if (android.os.Build.VERSION.SDK_INT >= 26) {
                c.startForegroundService(s);
            } else {
                c.startService(s);
            }
        } catch (Throwable t) {
            TripService.diagTo(c, "Gagal membangunkan perekam (" + why + "): " + t);
            Sched.warn(c, "Perekaman otomatis tidak bisa mulai", "Izinkan lokasi \"Selalu\" dan matikan penghemat baterai untuk HZ Trip.");
        }
    }

    /** Pasang ulang pagar yang dibuang sistem. Dibatasi sekali per 10 menit supaya tidak berputar. */
    private static void recover(Context c) {
        long now = System.currentTimeMillis();
        if (now - Sched.p(c).getLong("recoverAt", 0L) < 10L * 60000L) {
            return;
        }
        Sched.p(c).edit().putLong("recoverAt", now).apply();
        Trig.rearm(c);
    }

    /** Masuk / keluar pagar Tempat: di dalam = diam total; keluar dari semua tempat = langsung cek GPS (awal perjalanan). */
    private void onPlace(Context c, Intent i) {
        GeofencingEvent ev = GeofencingEvent.fromIntent(i);
        if (ev == null) {
            TripService.diagTo(c, "Android: kejadian Tempat kosong");
            return;
        }
        if (ev.hasError()) {
            TripService.diagTo(c, "Android: pagar Tempat galat kode " + ev.getErrorCode() + ", dipasang ulang");
            recover(c);
            return;
        }
        int tr = ev.getGeofenceTransition();
        java.util.List<Geofence> gl = ev.getTriggeringGeofences();
        java.util.HashSet<String> set = new java.util.HashSet<String>();
        String cur = Sched.p(c).getString("inPlaces", "");
        if (cur != null && cur.length() > 0) {
            for (String x : cur.split(",")) {
                set.add(x);
            }
        }
        if (gl != null) {
            for (Geofence g : gl) {
                if (tr == Geofence.GEOFENCE_TRANSITION_ENTER) {
                    set.add(g.getRequestId());
                } else if (tr == Geofence.GEOFENCE_TRANSITION_EXIT) {
                    set.remove(g.getRequestId());
                }
            }
        }
        StringBuilder sb = new StringBuilder();
        for (String x : set) {
            if (sb.length() > 0) {
                sb.append(',');
            }
            sb.append(x);
        }
        Sched.p(c).edit().putString("inPlaces", sb.toString()).apply();
        TripService.diagTo(c, (tr == Geofence.GEOFENCE_TRANSITION_ENTER ? "Masuk tempat" : "Keluar tempat") + " (" + set.size() + " tempat sedang dimasuki)");
        if (set.isEmpty()) {
            // Keluar dari semua Tempat: perjalanan kemungkinan baru dimulai. Nyalakan GPS sekarang (Cek penuh),
            // jangan hanya Siaga yang baru memeriksa tiap 2 menit, supaya awal perjalanan tidak terlewat.
            if (tr == Geofence.GEOFENCE_TRANSITION_EXIT) {
                if (Sched.autoPossible(c, System.currentTimeMillis())) {
                    wake(c, TripService.ACTION_TRIG, "keluar tempat");
                } else {
                    TripService.diagTo(c, "Keluar tempat, tetapi rekam otomatis tidak aktif: " + skipReason(c));
                }
            } else if (Sched.autoPossible(c, System.currentTimeMillis())) {
                wake(c, TripService.ACTION_AUTO, "tempat");
            }
        } else {
            TripService sv = TripService.instance;
            if (sv != null) {
                sv.evaluateAsync();
            } else if (Sched.placeWatch(c, System.currentTimeMillis())) {
                wake(c, TripService.ACTION_AUTO, "tempat");
            }
        }
    }
}
