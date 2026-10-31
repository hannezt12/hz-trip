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
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;

/** Notifikasi "Anda bergerak, rekaman belum jalan": maksimal 2 kali per kejadian, bunyi dan getar. */
final class Alert {
    static final String CHANNEL = "hztrip_alert";
    static final int ID = 77;
    static final long REPEAT_MS = 60000L;
    static final long EVENT_MS = 10L * 60000L;
    static final long QUIET_MS = 2L * 3600000L;

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

    /** Bunyi popup lewat aliran alarm (tetap berbunyi walau ponsel senyap) atau aliran notifikasi, sesuai pilihan; plus getar. */
    static void beep(final Context c) {
        try {
            String mode = Sched.p(c).getString("popupSound", "alarm");
            if ("off".equals(mode)) {
                return;
            }
            final boolean alarm = !"notif".equals(mode);
            android.os.Vibrator vb = (android.os.Vibrator) c.getSystemService(Context.VIBRATOR_SERVICE);
            if (vb != null) {
                vb.vibrate(new long[]{0, 400, 200, 400}, -1);
            }
            final Handler hh = new Handler(Looper.getMainLooper());
            Runnable play = new Runnable() {
                @Override
                public void run() {
                    try {
                        android.media.Ringtone r = null;
                        String cu = Sched.p(c).getString("popupUri", "");
                        if (cu != null && cu.length() > 0) {
                            try {
                                r = RingtoneManager.getRingtone(c, android.net.Uri.parse(cu));
                            } catch (Throwable ignored2) {
                                r = null;
                            }
                        }
                        if (r == null) {
                            r = RingtoneManager.getRingtone(c, RingtoneManager.getDefaultUri(alarm ? RingtoneManager.TYPE_ALARM : RingtoneManager.TYPE_NOTIFICATION));
                        }
                        if (r == null) {
                            return;
                        }
                        AudioAttributes aa = new AudioAttributes.Builder().setUsage(alarm ? AudioAttributes.USAGE_ALARM : AudioAttributes.USAGE_NOTIFICATION).build();
                        if (Build.VERSION.SDK_INT >= 28) {
                            r.setAudioAttributes(aa);
                        } else {
                            r.setStreamType(alarm ? android.media.AudioManager.STREAM_ALARM : android.media.AudioManager.STREAM_NOTIFICATION);
                        }
                        r.play();
                        final android.media.Ringtone rr = r;
                        hh.postDelayed(new Runnable() {
                            @Override
                            public void run() {
                                try {
                                    rr.stop();
                                } catch (Throwable ignored) {
                                }
                            }
                        }, 2500L);
                    } catch (Throwable ignored) {
                    }
                }
            };
            hh.post(play);
        } catch (Throwable ignored) {
        }
    }

    static boolean canPopup(Context c) {
        return Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(c);
    }

    /** Popup bila izin "tampil di atas aplikasi lain" ada; bila tidak, notifikasi biasa sebagai cadangan. */
    private static void post(Context c, int n) {
        if (canPopup(c)) {
            try {
                Intent i = new Intent(c, AlertActivity.class);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_ANIMATION | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                c.startActivity(i);
                return;
            } catch (Throwable t) {
                TripService.diagTo(c, "Popup gagal: " + t.getMessage());
            }
        }
        postNotif(c);
    }

    private static void postNotif(Context c) {
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
            final AlertActivity act = AlertActivity.cur;
            if (act != null) {
                new Handler(Looper.getMainLooper()).post(new Runnable() {
                    @Override
                    public void run() {
                        act.finish();
                    }
                });
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
            if (quiet) {
                TripService s = TripService.instance;
                if (s != null) {
                    s.dismissPending();
                }
            }
        } catch (Throwable ignored) {
        }
    }
}
