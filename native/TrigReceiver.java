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
            if (why == null || !(Sched.autoPossible(c, System.currentTimeMillis()) || Sched.p(c).getBoolean("notif", false))) {
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
}
