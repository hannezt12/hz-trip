package com.hz.hztrip;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;

/** Notifikasi "Anda bergerak, rekaman belum jalan": maksimal 2 kali per kejadian, bunyi dan getar. */
final class Alert {
    static final String CHANNEL = "hztrip_alert";
    static final int ID = 77;
    static final long REPEAT_MS = 2L * 60000L;
    static final long EVENT_MS = 10L * 60000L;
    static final long QUIET_MS = 5L * 60000L;

    private Alert() {
    }

    private static void channel(Context c) {
        if (Build.VERSION.SDK_INT < 26) {
            return;
        }
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null && nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Pengingat rekam", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Berbunyi bila Anda bergerak tetapi perekaman belum jalan");
            ch.enableVibration(true);
            ch.setVibrationPattern(new long[]{0, 400, 200, 400});
            ch.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                    new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build());
            nm.createNotificationChannel(ch);
        }
    }

    private static PendingIntent recv(Context c, String action, int rc) {
        Intent i = new Intent(c, TrigReceiver.class).setAction(action);
        return PendingIntent.getBroadcast(c, rc, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /** Dipanggil saat gerakan terkonfirmasi (atau pemicu Android) tetapi tidak ada rekaman. */
    static void fire(Context c) {
        try {
            SharedPreferences p = Sched.p(c);
            long now = System.currentTimeMillis();
            if (now < p.getLong("alertUntil", 0L) || TripService.mode == TripService.M_REKAM) {
                return;
            }
            int n = p.getInt("alertCount", 0);
            if (now - p.getLong("alertAt", 0L) > EVENT_MS) {
                n = 0;
            }
            if (n >= 2 || (n == 1 && now - p.getLong("alertAt", 0L) < REPEAT_MS - 5000L)) {
                return;
            }
            n++;
            p.edit().putInt("alertCount", n).putLong("alertAt", now).apply();
            post(c, n);
            if (n == 1) {
                AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
                if (am != null) {
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, now + REPEAT_MS, recv(c, Trig.ACT_ALERT2, 83));
                }
                TripService.diagTo(c, "Notifikasi pengingat ke-1 ditampilkan");
            } else {
                TripService.diagTo(c, "Notifikasi pengingat ke-2 ditampilkan");
            }
        } catch (Throwable ignored) {
        }
    }

    /** Dari alarm 2 menit setelah yang pertama. */
    static void second(Context c) {
        try {
            SharedPreferences p = Sched.p(c);
            if (p.getInt("alertCount", 0) != 1 || TripService.mode == TripService.M_REKAM) {
                return;
            }
            p.edit().putInt("alertCount", 2).putLong("alertAt", System.currentTimeMillis()).apply();
            post(c, 2);
            TripService.diagTo(c, "Notifikasi pengingat ke-2 ditampilkan");
        } catch (Throwable ignored) {
        }
    }

    private static void post(Context c, int n) {
        channel(c);
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) {
            return;
        }
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CHANNEL) : new Notification.Builder(c);
        Intent open = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        PendingIntent openPi = PendingIntent.getActivity(c, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        PendingIntent startPi = PendingIntent.getService(c, 84,
                new Intent(c, TripService.class).setAction(TripService.ACTION_START),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        b.setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setContentTitle("Anda sedang bergerak")
                .setContentText("Perekaman belum jalan. Mulai rekam?")
                .setColor(0xFFF5C518)
                .setAutoCancel(true)
                .setOnlyAlertOnce(false)
                .setCategory(Notification.CATEGORY_REMINDER)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setContentIntent(openPi)
                .setDeleteIntent(recv(c, Trig.ACT_DISMISS, 85))
                .addAction(new Notification.Action.Builder(android.R.drawable.ic_media_play, "Mulai rekam", startPi).build())
                .addAction(new Notification.Action.Builder(android.R.drawable.ic_menu_close_clear_cancel, "Tutup", recv(c, Trig.ACT_DISMISS, 85)).build());
        if (Build.VERSION.SDK_INT < 26) {
            b.setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL);
        }
        nm.notify(ID, b.build());
    }

    /** Hentikan notifikasi dan alarm ulangnya (mulai rekam, ditutup, atau digeser). */
    static void cancel(Context c, boolean quiet) {
        try {
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(ID);
            }
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            if (am != null) {
                am.cancel(recv(c, Trig.ACT_ALERT2, 83));
            }
            SharedPreferences.Editor e = Sched.p(c).edit().putInt("alertCount", 2);
            if (quiet) {
                e.putLong("alertUntil", System.currentTimeMillis() + QUIET_MS);
            }
            e.apply();
        } catch (Throwable ignored) {
        }
    }
}
