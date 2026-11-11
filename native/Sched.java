package com.hz.hztrip;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.location.Location;
import android.os.Build;

import java.util.Calendar;

/**
 * Jadwal mingguan di sisi Android. Jadwal dikirim dari tampilan web sebagai
 * 7 pasang menit (Minggu..Sabtu); jendela otomatis dihitung di sini supaya tetap
 * jalan walaupun aplikasi tidak dibuka berhari-hari.
 */
final class Sched {
    static final String PREFS = "hztrip";
    static final String ACTION_TICK = "com.hz.hztrip.TICK";
    static final String WARN_CHANNEL = "hztrip_warn2";

    private Sched() {
    }

    static SharedPreferences p(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** v0.15.10: "Matikan total": tidak ada yang berjalan atau menyala sendiri sampai pengguna menyalakan lagi. */
    static boolean masterOff(Context c) {
        return p(c).getBoolean("masterOff", false);
    }

    /** Pengaturan "Rekam otomatis" apa adanya (tanpa memperhitungkan Matikan total). */
    static boolean autoPref(Context c) {
        return p(c).getBoolean("auto", true);
    }

    static boolean autoEnabled(Context c) {
        return !masterOff(c) && autoPref(c);
    }

    static int marginMin(Context c) {
        return p(c).getInt("margin", 30);
    }

    static long pausedUntil(Context c) {
        return p(c).getLong("pausedUntil", 0L);
    }

    /** 7 entri [masuk, pulang] dalam menit; -1 = libur. */
    static int[][] days(Context c) {
        int[][] d = new int[7][2];
        for (int i = 0; i < 7; i++) {
            d[i][0] = -1;
            d[i][1] = -1;
        }
        String s = p(c).getString("sched", "");
        if (s == null || s.length() == 0) {
            return d;
        }
        String[] parts = s.split(";");
        for (int i = 0; i < 7 && i < parts.length; i++) {
            String[] io = parts[i].split("-", -1);
            try {
                if (io.length >= 2 && io[0].length() > 0 && io[1].length() > 0 && !io[0].startsWith("-")) {
                    d[i][0] = Integer.parseInt(io[0]);
                    d[i][1] = Integer.parseInt(io[1]);
                }
            } catch (NumberFormatException ignored) {
            }
        }
        return d;
    }

    /** Jendela otomatis pada hari (hari ini + offset): {awal, akhir} dalam ms, atau null. */
    private static long[] win(Context c, int dayOffset) {
        int[][] d = days(c);
        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.HOUR_OF_DAY, 0);
        cal.set(Calendar.MINUTE, 0);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        cal.add(Calendar.DAY_OF_MONTH, dayOffset);
        int dow = cal.get(Calendar.DAY_OF_WEEK) - 1; // 0 = Minggu
        int in = d[dow][0];
        int out = d[dow][1];
        if (in < 0 || out <= in) {
            return null;
        }
        long base = cal.getTimeInMillis();
        long m = marginMin(c);
        return new long[]{base + (in - m) * 60000L, base + (out + m) * 60000L};
    }

    /** Akhir jendela yang sedang berlaku, atau 0 bila sekarang di luar jendela. */
    static long windowEnd(Context c, long now) {
        for (int off = -1; off <= 1; off++) {
            long[] w = win(c, off);
            if (w != null && now >= w[0] && now < w[1]) {
                return w[1];
            }
        }
        return 0L;
    }

    /** Awal jendela berikutnya (setelah sekarang), atau 0 bila tidak ada. */
    static long nextStart(Context c, long now) {
        long best = 0L;
        for (int off = 0; off <= 8; off++) {
            long[] w = win(c, off);
            if (w != null && w[0] > now && (best == 0L || w[0] < best)) {
                best = w[0];
            }
        }
        return best;
    }

    /** Waktu batas terdekat (awal atau akhir jendela) setelah sekarang. */
    static long nextBoundary(Context c, long now) {
        long best = 0L;
        for (int off = -1; off <= 8; off++) {
            long[] w = win(c, off);
            if (w == null) {
                continue;
            }
            for (int k = 0; k < 2; k++) {
                if (w[k] > now && (best == 0L || w[k] < best)) {
                    best = w[k];
                }
            }
        }
        return best;
    }

    /** Berada di dalam salah satu "Tempat" (pagar virtual rumah/kantor dll): tidak merekam, GPS mati. */
    static boolean inPlace(Context c) {
        String s = p(c).getString("inPlaces", "");
        return s != null && s.length() > 0;
    }

    /** v0.15.1: merekam otomatis kapan saja (tanpa jadwal), kecuali sedang di dalam salah satu Tempat (di sana app hanya menjaga, lihat placeWatch). */
    static boolean autoPossible(Context c, long now) {
        return autoEnabled(c) && now >= pausedUntil(c) && !inPlace(c);
    }

    /** v0.15.9: boleh merekam otomatis tetapi sedang di dalam Tempat: app "menjaga" (sensor gerak + kendaraan), GPS mati. */
    static boolean placeWatch(Context c, long now) {
        return autoEnabled(c) && now >= pausedUntil(c) && inPlace(c);
    }

    /** Satu Tempat: id "hzp<indeks>" sama dengan requestId pagar di Trig.armPlaces. */
    static final class Pl {
        String id;
        double lat;
        double lng;
        float r;
    }

    static java.util.ArrayList<Pl> places(Context c) {
        java.util.ArrayList<Pl> out = new java.util.ArrayList<Pl>();
        String s = p(c).getString("places", "");
        if (s == null || s.length() == 0) {
            return out;
        }
        String[] items = s.split(";");
        for (int i = 0; i < items.length && i < 90; i++) {
            String[] a = items[i].split(",");
            if (a.length < 3) {
                continue;
            }
            try {
                Pl x = new Pl();
                x.id = "hzp" + i;
                x.lat = Double.parseDouble(a[0]);
                x.lng = Double.parseDouble(a[1]);
                x.r = Math.max(100f, Float.parseFloat(a[2]));
                out.add(x);
            } catch (Exception ignored) {
            }
        }
        return out;
    }

    private static float distTo(Location loc, Pl x) {
        float[] d = new float[1];
        Location.distanceBetween(loc.getLatitude(), loc.getLongitude(), x.lat, x.lng, d);
        return d[0];
    }

    /** Buang dari "inPlaces" Tempat yang menurut GPS pasti sudah dilewati (di luar lingkaran). Mengembalikan jumlah yang dibuang. */
    static int dropOutside(Context c, Location loc) {
        if (!loc.hasAccuracy() || loc.getAccuracy() > 150f) {
            return 0;
        }
        String cur = p(c).getString("inPlaces", "");
        if (cur == null || cur.length() == 0) {
            return 0;
        }
        float acc = loc.getAccuracy();
        java.util.ArrayList<Pl> all = places(c);
        StringBuilder keep = new StringBuilder();
        int dropped = 0;
        for (String id : cur.split(",")) {
            Pl x = null;
            for (Pl q : all) {
                if (q.id.equals(id)) {
                    x = q;
                    break;
                }
            }
            boolean out = x == null;
            if (x != null) {
                float d = distTo(loc, x);
                out = acc <= 50f ? d >= x.r : d - acc >= x.r;
            }
            if (out) {
                dropped++;
            } else {
                if (keep.length() > 0) {
                    keep.append(',');
                }
                keep.append(id);
            }
        }
        if (dropped > 0) {
            p(c).edit().putString("inPlaces", keep.toString()).apply();
        }
        return dropped;
    }

    /** Id Tempat yang pasti melingkupi posisi ini (akurasi baik dan seluruh lingkaran akurasi di dalam). Kosong bila tidak ada. */
    static String insideIds(Context c, Location loc) {
        if (!loc.hasAccuracy() || loc.getAccuracy() > 30f) {
            return "";
        }
        float acc = loc.getAccuracy();
        StringBuilder sb = new StringBuilder();
        for (Pl x : places(c)) {
            if (distTo(loc, x) + acc <= x.r) {
                if (sb.length() > 0) {
                    sb.append(',');
                }
                sb.append(x.id);
            }
        }
        return sb.toString();
    }

    static void arm(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) {
            return;
        }
        Intent i = new Intent(c, ScheduleReceiver.class).setAction(ACTION_TICK);
        PendingIntent pi = PendingIntent.getBroadcast(c, 7, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        am.cancel(pi);
        long now = System.currentTimeMillis();
        long t = nextBoundary(c, now);
        if (t == 0L || !autoEnabled(c)) {
            return;
        }
        try {
            if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, pi);
            } else {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, pi);
            }
        } catch (Exception e) {
            try {
                am.set(AlarmManager.RTC_WAKEUP, t, pi);
            } catch (Exception ignored) {
            }
        }
    }

    /** Dipanggil saat alarm batas jendela, setelah boot, ganti jam, atau saat jadwal diubah. */
    static void evaluate(Context c) {
        long now = System.currentTimeMillis();
        if (autoPossible(c, now) || placeWatch(c, now)) {
            try {
                Intent i = new Intent(c, TripService.class).setAction(TripService.ACTION_AUTO);
                if (Build.VERSION.SDK_INT >= 26) {
                    c.startForegroundService(i);
                } else {
                    c.startService(i);
                }
            } catch (Exception e) {
                warn(c, "Perekaman otomatis tidak bisa mulai", "Buka HZ Trip sekali agar siaga aktif.");
            }
        } else {
            TripService s = TripService.instance;
            if (s != null) {
                s.evaluateAsync();
            }
        }
        arm(c);
    }

    static void warn(Context c, String title, String text) {
        try {
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) {
                return;
            }
            Notification.Builder b;
            if (Build.VERSION.SDK_INT >= 26) {
                if (nm.getNotificationChannel(WARN_CHANNEL) == null) {
                    nm.createNotificationChannel(new NotificationChannel(WARN_CHANNEL, "Peringatan HZ Trip (senyap)", NotificationManager.IMPORTANCE_LOW));
                }
                b = new Notification.Builder(c, WARN_CHANNEL);
            } else {
                b = new Notification.Builder(c);
            }
            Intent open = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
            PendingIntent pi = PendingIntent.getActivity(c, 3, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            b.setSmallIcon(android.R.drawable.ic_dialog_alert).setContentTitle(title).setContentText(text).setAutoCancel(true).setContentIntent(pi);
            nm.notify(1003, b.build());
        } catch (Exception ignored) {
        }
    }
}
