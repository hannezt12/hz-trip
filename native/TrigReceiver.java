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

/** Menerima kejadian "naik kendaraan" dan "keluar pagar virtual" dari Android, lalu membangunkan perekam. */
public class TrigReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        try {
            String why = null;
            String a = i.getAction();
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
                        if (e.getActivityType() == DetectedActivity.IN_VEHICLE
                                && e.getTransitionType() == ActivityTransition.ACTIVITY_TRANSITION_ENTER) {
                            why = "naik kendaraan";
                        }
                        if (e.getActivityType() == DetectedActivity.IN_VEHICLE
                                && e.getTransitionType() == ActivityTransition.ACTIVITY_TRANSITION_EXIT) {
                            // Turun dari kendaraan: popup boleh muncul lagi pada perjalanan berikutnya.
                            Sched.p(c).edit().putLong("alertUntil", 0L).apply();
                        }
                    }
                }
            } else if (Trig.ACT_FENCE.equals(a)) {
                GeofencingEvent ev = GeofencingEvent.fromIntent(i);
                if (ev != null && !ev.hasError() && ev.getGeofenceTransition() == Geofence.GEOFENCE_TRANSITION_EXIT) {
                    why = "keluar pagar virtual (geofence)";
                }
            }
            if (why == null || !Sched.autoPossible(c, System.currentTimeMillis())) {
                return;
            }
            Intent s = new Intent(c, TripService.class).setAction(TripService.ACTION_TRIG).putExtra("why", why);
            if (android.os.Build.VERSION.SDK_INT >= 26) {
                c.startForegroundService(s);
            } else {
                c.startService(s);
            }
        } catch (Throwable ignored) {
        }
    }

    /** Masuk / keluar pagar Tempat: di dalam = diam total; keluar dari semua tempat = otomatis aktif lagi. */
    private void onPlace(Context c, Intent i) {
        GeofencingEvent ev = GeofencingEvent.fromIntent(i);
        if (ev == null || ev.hasError()) {
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
            if (Sched.autoPossible(c, System.currentTimeMillis())) {
                Intent s = new Intent(c, TripService.class).setAction(TripService.ACTION_AUTO);
                if (android.os.Build.VERSION.SDK_INT >= 26) {
                    c.startForegroundService(s);
                } else {
                    c.startService(s);
                }
            }
        } else {
            TripService sv = TripService.instance;
            if (sv != null) {
                sv.evaluateAsync();
            }
        }
    }
}
