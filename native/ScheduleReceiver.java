package com.hz.hztrip;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Menerima alarm batas jendela jadwal, boot, penggantian aplikasi, dan perubahan jam. */
public class ScheduleReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        try {
            Sched.evaluate(context);
            if (Sched.p(context).getBoolean("notif", false) && TripService.mode == TripService.M_OFF) {
                Trig.enterNotif(context);
            }
        } catch (Exception ignored) {
        }
    }
}
