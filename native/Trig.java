package com.hz.hztrip;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.os.Build;

import com.google.android.gms.location.ActivityRecognition;
import com.google.android.gms.location.ActivityTransition;
import com.google.android.gms.location.ActivityTransitionRequest;
import com.google.android.gms.location.DetectedActivity;
import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingRequest;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.tasks.OnCompleteListener;
import com.google.android.gms.tasks.OnFailureListener;
import com.google.android.gms.tasks.Task;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Pemicu tambahan dari Android: "naik kendaraan" dan pagar virtual (geofence). Keduanya tanpa GPS dan tanpa internet. */
final class Trig {
    static final String ACT_VEH = "com.hz.hztrip.TRIG_VEH";
    static final String ACT_FENCE = "com.hz.hztrip.TRIG_FENCE";
    static final String ACT_PLACE = "com.hz.hztrip.TRIG_PLACE";
    static final String ACT_ALERT2 = "com.hz.hztrip.ALERT2";
    static final String ACT_DISMISS = "com.hz.hztrip.ALERT_X";
    /** Daftar ulang pemicu paling lambat tiap 6 jam: Google Play services kadang membuang pendaftaran tanpa kabar. */
    static final long REFRESH_MS = 6L * 60L * 60L * 1000L;
    private static boolean vehOn = false;
    private static long vehAt = 0L;
    private static String fenceKey = "";
    private static long fenceAt = 0L;

    private Trig() {
    }

    static boolean actGranted(Context c) {
        return Build.VERSION.SDK_INT < 29
                || c.checkSelfPermission("android.permission.ACTIVITY_RECOGNITION") == PackageManager.PERMISSION_GRANTED;
    }

    private static PendingIntent pi(Context c, String action, int rc) {
        Intent i = new Intent(c, TrigReceiver.class).setAction(action);
        int fl = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 31) {
            fl |= PendingIntent.FLAG_MUTABLE;
        }
        return PendingIntent.getBroadcast(c, rc, i, fl);
    }

    /** Pasang (atau perbarui) pemicu. Aman dipanggil berulang. */
    static void arm(Context ctx, Location anchor, int radius) {
        final Context c = ctx.getApplicationContext();
        final long nowMs = System.currentTimeMillis();
        if (!vehOn || nowMs - vehAt >= REFRESH_MS) {
            if (actGranted(c)) {
                try {
                    List<ActivityTransition> l = new ArrayList<ActivityTransition>();
                    l.add(new ActivityTransition.Builder()
                            .setActivityType(DetectedActivity.IN_VEHICLE)
                            .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_ENTER)
                            .build());
                    l.add(new ActivityTransition.Builder()
                            .setActivityType(DetectedActivity.IN_VEHICLE)
                            .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_EXIT)
                            .build());
                    ActivityRecognition.getClient(c)
                            .requestActivityTransitionUpdates(new ActivityTransitionRequest(l), pi(c, ACT_VEH, 71))
                            .addOnFailureListener(new OnFailureListener() {
                                @Override
                                public void onFailure(Exception e) {
                                    vehOn = false;
                                    TripService.diagTo(c, "Pemicu kendaraan gagal dipasang: " + e.getMessage());
                                }
                            });
                    vehOn = true;
                    vehAt = nowMs;
                    TripService.diagTo(c, "Pemicu kendaraan dipasang");
                } catch (Throwable t) {
                    TripService.diagTo(c, "Pemicu kendaraan tidak tersedia: " + t.getMessage());
                }
            } else {
                TripService.diagTo(c, "Pemicu kendaraan dilewati: izin Aktivitas fisik belum diberikan");
            }
        }
        if (anchor == null) {
            return;
        }
        int r = Math.max(radius, 100);
        String key = String.format(Locale.US, "%.5f,%.5f,%d", anchor.getLatitude(), anchor.getLongitude(), r);
        if (key.equals(fenceKey) && nowMs - fenceAt < REFRESH_MS) {
            return;
        }
        try {
            Geofence g = new Geofence.Builder()
                    .setRequestId("hzfence")
                    .setCircularRegion(anchor.getLatitude(), anchor.getLongitude(), (float) r)
                    .setExpirationDuration(Geofence.NEVER_EXPIRE)
                    .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_EXIT)
                    .build();
            GeofencingRequest req = new GeofencingRequest.Builder().addGeofence(g).build();
            LocationServices.getGeofencingClient(c)
                    .addGeofences(req, pi(c, ACT_FENCE, 72))
                    .addOnFailureListener(new OnFailureListener() {
                        @Override
                        public void onFailure(Exception e) {
                            fenceKey = "";
                            TripService.diagTo(c, "Geofence gagal dipasang: " + e.getMessage());
                        }
                    });
            fenceKey = key;
            fenceAt = nowMs;
            TripService.diagTo(c, "Geofence dipasang (" + r + " m)");
        } catch (Throwable t) {
            TripService.diagTo(c, "Geofence tidak tersedia: " + t.getMessage());
        }
    }

    /**
     * Pasang pagar "Tempat" (rumah, kantor, dll). Format prefs "places": "lat,lng,radius;lat,lng,radius".
     * Masuk = tidak merekam (app hanya menjaga gerak); keluar = rekam otomatis aktif lagi. Pagar ini tidak ikut dicabut oleh disarm().
     */
    static void armPlaces(Context ctx) {
        armPlaces(ctx, false);
    }

    /**
     * force = true (boot, app diperbarui, galat pagar): daftar ulang dan anggap belum ada di Tempat mana pun.
     * force = false: lewati bila daftar Tempat tidak berubah dan pendaftaran masih baru (kurang dari 6 jam), supaya membuka app
     * tidak mengosongkan status "sedang di Tempat" dan tidak membuat selang palsu "tidak di Tempat".
     */
    static void armPlaces(Context ctx, boolean force) {
        final Context c = ctx.getApplicationContext();
        try {
            final PendingIntent pp = pi(c, ACT_PLACE, 73);
            final String s0 = Sched.p(c).getString("places", "");
            final String s = s0 == null ? "" : s0;
            final long nowMs = System.currentTimeMillis();
            String sig = Sched.p(c).getString("placesSig", null);
            boolean changed = sig == null || !s.equals(sig);
            if (!force && !changed && nowMs - Sched.p(c).getLong("placesAt", 0L) < REFRESH_MS) {
                return;
            }
            if (force || changed) {
                Sched.p(c).edit().putString("inPlaces", "").apply();
            }
            final List<Geofence> gl = new ArrayList<Geofence>();
            if (s != null && s.length() > 0) {
                String[] items = s.split(";");
                for (int i = 0; i < items.length && i < 90; i++) {
                    String[] a = items[i].split(",");
                    if (a.length < 3) {
                        continue;
                    }
                    try {
                        double la = Double.parseDouble(a[0]);
                        double lo = Double.parseDouble(a[1]);
                        float r = Math.max(100f, Float.parseFloat(a[2]));
                        gl.add(new Geofence.Builder()
                                .setRequestId("hzp" + i)
                                .setCircularRegion(la, lo, r)
                                .setExpirationDuration(Geofence.NEVER_EXPIRE)
                                .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER | Geofence.GEOFENCE_TRANSITION_EXIT)
                                .build());
                    } catch (Exception ignored) {
                    }
                }
            }
            final int n = gl.size();
            LocationServices.getGeofencingClient(c).removeGeofences(pp).addOnCompleteListener(new OnCompleteListener<Void>() {
                @Override
                public void onComplete(Task<Void> t) {
                    Sched.p(c).edit().putString("placesSig", s).putLong("placesAt", nowMs).apply();
                    if (n == 0) {
                        TripService.diagTo(c, "Tempat: tidak ada pagar");
                        return;
                    }
                    try {
                        GeofencingRequest req = new GeofencingRequest.Builder()
                                .setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_ENTER)
                                .addGeofences(gl).build();
                        LocationServices.getGeofencingClient(c).addGeofences(req, pp)
                                .addOnFailureListener(new OnFailureListener() {
                                    @Override
                                    public void onFailure(Exception e) {
                                        TripService.diagTo(c, "Pagar Tempat gagal dipasang: " + e.getMessage());
                                    }
                                });
                        TripService.diagTo(c, "Pagar Tempat dipasang (" + n + " tempat)");
                    } catch (Throwable th) {
                        TripService.diagTo(c, "Pagar Tempat tidak tersedia: " + th.getMessage());
                    }
                }
            });
        } catch (Throwable t) {
            TripService.diagTo(c, "Pagar Tempat gagal: " + t.getMessage());
        }
    }

    static void disarm(Context ctx) {
        Context c = ctx.getApplicationContext();
        try {
            ActivityRecognition.getClient(c).removeActivityTransitionUpdates(pi(c, ACT_VEH, 71));
        } catch (Throwable ignored) {
        }
        try {
            LocationServices.getGeofencingClient(c).removeGeofences(pi(c, ACT_FENCE, 72));
        } catch (Throwable ignored) {
        }
        vehOn = false;
        fenceKey = "";
    }

    /** Paksa pasang ulang semua pemicu (pagar acuan, kendaraan, Tempat), mis. setelah Android membuang pagar. */
    static void rearm(Context ctx) {
        Context c = ctx.getApplicationContext();
        vehOn = false;
        fenceKey = "";
        if (Sched.autoPossible(c, System.currentTimeMillis())) {
            arm(c, anchorOf(c), Sched.p(c).getInt("radius", 150));
        }
        armPlaces(c, true);
    }

    static Location anchorOf(Context c) {
        try {
            String s = Sched.p(c).getString("anchor", "");
            if (s != null && s.indexOf(',') > 0) {
                String[] a = s.split(",");
                Location l = new Location("anchor");
                l.setLatitude(Double.parseDouble(a[0]));
                l.setLongitude(Double.parseDouble(a[1]));
                return l;
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    /** Pasang pemicu untuk mode "Notifikasi aktif" tanpa menjalankan service. */
    static void enterNotif(Context c) {
        arm(c, anchorOf(c), Sched.p(c).getInt("radius", 150));
    }
}
