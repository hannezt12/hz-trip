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
import com.google.android.gms.tasks.OnFailureListener;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Pemicu tambahan dari Android: "naik kendaraan" dan pagar virtual (geofence). Keduanya tanpa GPS dan tanpa internet. */
final class Trig {
    static final String ACT_VEH = "com.hz.hztrip.TRIG_VEH";
    static final String ACT_FENCE = "com.hz.hztrip.TRIG_FENCE";
    static final String ACT_ALERT2 = "com.hz.hztrip.ALERT2";
    static final String ACT_DISMISS = "com.hz.hztrip.ALERT_X";
    private static boolean vehOn = false;
    private static String fenceKey = "";

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
        if (!vehOn) {
            if (actGranted(c)) {
                try {
                    List<ActivityTransition> l = new ArrayList<ActivityTransition>();
                    l.add(new ActivityTransition.Builder()
                            .setActivityType(DetectedActivity.IN_VEHICLE)
                            .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_ENTER)
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
        if (key.equals(fenceKey)) {
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
            TripService.diagTo(c, "Geofence dipasang (" + r + " m)");
        } catch (Throwable t) {
            TripService.diagTo(c, "Geofence tidak tersedia: " + t.getMessage());
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
