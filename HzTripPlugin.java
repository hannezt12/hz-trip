package com.hz.hztrip;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.util.Arrays;
import java.util.regex.Pattern;

/** Jembatan antara tampilan web HZ Trip dan TripService (perekam GPS). */
@CapacitorPlugin(
        name = "HzTrip",
        permissions = {
                @Permission(alias = "location", strings = {
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                }),
                @Permission(alias = "notifications", strings = {"android.permission.POST_NOTIFICATIONS"}),
                @Permission(alias = "background", strings = {"android.permission.ACCESS_BACKGROUND_LOCATION"}),
                @Permission(alias = "activity", strings = {"android.permission.ACTIVITY_RECOGNITION"})
        }
)
public class HzTripPlugin extends Plugin {

    private static final Pattern DATE_RE = Pattern.compile("^\\d{4}-\\d{2}-\\d{2}$");
    private static final Pattern NAME_RE = Pattern.compile("^[a-z0-9_-]{1,40}$");

    @Override
    public void load() {
        TripService.listener = new TripService.Listener() {
            @Override
            public void onFix(long t, double lat, double lng, float speedMs, float acc, int count) {
                JSObject o = new JSObject();
                o.put("t", t);
                o.put("lat", lat);
                o.put("lng", lng);
                o.put("v", speedMs);
                o.put("acc", acc);
                o.put("count", count);
                notifyListeners("fix", o);
            }

            @Override
            public void onState() {
                notifyListeners("state", statusObject());
            }
        };
    }

    @Override
    protected void handleOnDestroy() {
        TripService.listener = null;
    }

    private boolean hasLocation() {
        return getPermissionState("location") == PermissionState.GRANTED;
    }

    @PluginMethod
    public void ensurePermissions(PluginCall call) {
        if (hasLocation()) {
            JSObject o = new JSObject();
            o.put("granted", true);
            call.resolve(o);
            return;
        }
        requestPermissionForAliases(new String[]{"location", "notifications"}, call, "permResult");
    }

    @PermissionCallback
    private void permResult(PluginCall call) {
        JSObject o = new JSObject();
        o.put("granted", hasLocation());
        call.resolve(o);
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (!hasLocation()) {
            call.reject("Izin lokasi belum diberikan");
            return;
        }
        Context ctx = getContext();
        Intent i = new Intent(ctx, TripService.class).setAction(TripService.ACTION_START);
        try {
            ContextCompat.startForegroundService(ctx, i);
        } catch (Exception e) {
            call.reject("Gagal memulai perekaman: " + e.getMessage());
            return;
        }
        JSObject o = new JSObject();
        o.put("recording", true);
        call.resolve(o);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try {
            getContext().startService(new Intent(getContext(), TripService.class).setAction(TripService.ACTION_STOP));
        } catch (Exception e) {
            call.reject("Gagal mengakhiri: " + e.getMessage());
            return;
        }
        JSObject o = new JSObject();
        o.put("recording", false);
        call.resolve(o);
    }

    private static String modeName() {
        switch (TripService.mode) {
            case TripService.M_SIAGA:
                return "siaga";
            case TripService.M_CEK:
                return "cek";
            case TripService.M_REKAM:
                return "rekam";
            default:
                return "tidur";
        }
    }

    private boolean hasBackground() {
        if (android.os.Build.VERSION.SDK_INT < 29) {
            return hasLocation();
        }
        return getContext().checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
                == android.content.pm.PackageManager.PERMISSION_GRANTED;
    }

    private JSObject statusObject() {
        Context ctx = getContext();
        long now = System.currentTimeMillis();
        JSObject o = new JSObject();
        o.put("mode", modeName());
        o.put("recording", TripService.mode == TripService.M_REKAM);
        o.put("manual", TripService.manual);
        o.put("lastT", TripService.lastT);
        o.put("lastV", TripService.lastSpeed);
        o.put("lastAcc", TripService.lastAcc);
        o.put("count", TripService.count);
        o.put("startedAt", TripService.startedAt);
        o.put("permission", hasLocation());
        o.put("background", hasBackground());
        o.put("actPerm", Trig.actGranted(ctx));
        o.put("notif", Sched.p(ctx).getBoolean("notif", false));
        o.put("overlay", Alert.canPopup(ctx));
        o.put("popupSound", Sched.p(ctx).getString("popupSound", "alarm"));
        o.put("auto", Sched.autoEnabled(ctx));
        o.put("winEnd", Sched.windowEnd(ctx, now));
        o.put("nextStart", Sched.nextStart(ctx, now));
        o.put("paused", now < Sched.pausedUntil(ctx));
        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        o.put("batteryFree", pm != null && pm.isIgnoringBatteryOptimizations(ctx.getPackageName()));
        try {
            android.location.LocationManager lm = (android.location.LocationManager) ctx.getSystemService(Context.LOCATION_SERVICE);
            o.put("gpsOn", lm != null && lm.isProviderEnabled(android.location.LocationManager.GPS_PROVIDER));
            android.hardware.SensorManager sm = (android.hardware.SensorManager) ctx.getSystemService(Context.SENSOR_SERVICE);
            o.put("sigSensor", sm != null && sm.getDefaultSensor(android.hardware.Sensor.TYPE_SIGNIFICANT_MOTION) != null);
        } catch (Exception ignored) {
        }
        return o;
    }

    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(statusObject());
    }

    @PluginMethod
    public void setSchedule(PluginCall call) {
        Context ctx = getContext();
        try {
            JSArray days = call.getArray("days");
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 7; i++) {
                int in = -1;
                int out = -1;
                if (days != null && i < days.length()) {
                    org.json.JSONObject d = days.getJSONObject(i);
                    in = d.optInt("i", -1);
                    out = d.optInt("o", -1);
                }
                if (i > 0) {
                    sb.append(';');
                }
                if (in < 0 || out <= in) {
                    sb.append("-");
                } else {
                    sb.append(in).append('-').append(out);
                }
            }
            Boolean auto = call.getBoolean("auto", true);
            Integer margin = call.getInt("margin", 30);
            Integer radius = call.getInt("radius", 150);
            Sched.p(ctx).edit()
                    .putString("sched", sb.toString())
                    .putBoolean("auto", auto == null || auto)
                    .putInt("margin", margin == null ? 30 : margin)
                    .putInt("radius", radius == null ? 150 : radius)
                    .putLong("pausedUntil", 0L)
                    .apply();
        } catch (Exception e) {
            call.reject("Jadwal tidak valid: " + e.getMessage());
            return;
        }
        Sched.evaluate(ctx);
        call.resolve(statusObject());
    }

    @PluginMethod
    public void resumeAuto(PluginCall call) {
        Context ctx = getContext();
        Sched.p(ctx).edit().putLong("pausedUntil", 0L).apply();
        Sched.evaluate(ctx);
        call.resolve(statusObject());
    }

    @PluginMethod
    public void setPopupSound(PluginCall call) {
        String m = call.getString("mode", "alarm");
        if (!"alarm".equals(m) && !"notif".equals(m) && !"off".equals(m)) {
            m = "alarm";
        }
        Sched.p(getContext()).edit().putString("popupSound", m).apply();
        call.resolve();
    }

    @PluginMethod
    public void openOverlaySettings(PluginCall call) {
        try {
            Intent i = new Intent(android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    android.net.Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    @PluginMethod
    public void setWatch(PluginCall call) {
        String m = call.getString("mode", "off");
        Intent i = new Intent(getContext(), TripService.class).setAction("notif".equals(m) ? TripService.ACTION_NOTIF : TripService.ACTION_OFF);
        try {
            if (android.os.Build.VERSION.SDK_INT >= 26) {
                getContext().startForegroundService(i);
            } else {
                getContext().startService(i);
            }
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
            return;
        }
        call.resolve();
    }

    @PluginMethod
    public void ensureActivity(PluginCall call) {
        if (Trig.actGranted(getContext())) {
            call.resolve(statusObject());
            return;
        }
        requestPermissionForAlias("activity", call, "actResult");
    }

    @PermissionCallback
    private void actResult(PluginCall call) {
        call.resolve(statusObject());
    }

    @PluginMethod
    public void ensureBackground(PluginCall call) {
        if (hasBackground() || android.os.Build.VERSION.SDK_INT < 29) {
            call.resolve(statusObject());
            return;
        }
        requestPermissionForAlias("background", call, "bgResult");
    }

    @PermissionCallback
    private void bgResult(PluginCall call) {
        call.resolve(statusObject());
    }

    @PluginMethod
    public void listDays(PluginCall call) {
        File dir = new File(getContext().getFilesDir(), "points");
        JSArray arr = new JSArray();
        String[] names = dir.list();
        if (names != null) {
            Arrays.sort(names);
            for (String n : names) {
                if (n.startsWith("points-") && n.endsWith(".csv")) {
                    arr.put(n.substring(7, n.length() - 4));
                }
            }
        }
        JSObject o = new JSObject();
        o.put("days", arr);
        call.resolve(o);
    }

    @PluginMethod
    public void readDay(PluginCall call) {
        String date = call.getString("date", "");
        if (!DATE_RE.matcher(date).matches()) {
            call.reject("Tanggal tidak valid");
            return;
        }
        File f = new File(new File(getContext().getFilesDir(), "points"), "points-" + date + ".csv");
        JSObject o = new JSObject();
        o.put("text", f.exists() ? readFile(f) : "");
        call.resolve(o);
    }

    /** Hapus permanen titik GPS dengan waktu dalam [from, to] (ms) pada satu hari. Hanya untuk hari yang sudah lewat. */
    @PluginMethod
    public void deletePoints(PluginCall call) {
        String date = call.getString("date", "");
        long fromT = 0L;
        long toT = 0L;
        try {
            fromT = Long.parseLong(call.getString("from", "0"));
            toT = Long.parseLong(call.getString("to", "0"));
        } catch (NumberFormatException e) {
            call.reject("Parameter tidak valid");
            return;
        }
        final long from = fromT;
        final long to = toT;
        if (!DATE_RE.matcher(date).matches() || to < from) {
            call.reject("Parameter tidak valid");
            return;
        }
        File dir = new File(getContext().getFilesDir(), "points");
        File f = new File(dir, "points-" + date + ".csv");
        JSObject o = new JSObject();
        int removed = 0;
        if (f.exists()) {
            try {
                File tmp = new File(dir, "points-" + date + ".csv.tmp");
                java.io.BufferedReader in = new java.io.BufferedReader(new java.io.InputStreamReader(new java.io.FileInputStream(f), "UTF-8"));
                java.io.BufferedWriter out = new java.io.BufferedWriter(new java.io.OutputStreamWriter(new java.io.FileOutputStream(tmp), "UTF-8"));
                String line;
                while ((line = in.readLine()) != null) {
                    int c = line.indexOf(',');
                    boolean drop = false;
                    if (c > 0) {
                        try {
                            long t = Long.parseLong(line.substring(0, c));
                            drop = t >= from && t <= to;
                        } catch (NumberFormatException ignored) {
                        }
                    }
                    if (drop) {
                        removed++;
                    } else {
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
            } catch (Exception e) {
                call.reject("Gagal menghapus titik: " + e.getMessage());
                return;
            }
        }
        o.put("removed", removed);
        call.resolve(o);
    }

    /** Catatan diagnostik pemicu (maks 200 baris terakhir). */
    @PluginMethod
    public void readDiag(PluginCall call) {
        File f = new File(getContext().getFilesDir(), TripService.DIAG_FILE);
        String t = f.exists() ? readFile(f) : "";
        String[] ls = t.split("\n");
        int from = Math.max(0, ls.length - 200);
        StringBuilder sb = new StringBuilder();
        for (int i = from; i < ls.length; i++) {
            if (ls[i].length() > 0) {
                sb.append(ls[i]).append('\n');
            }
        }
        JSObject o = new JSObject();
        o.put("text", sb.toString());
        call.resolve(o);
    }

    @PluginMethod
    public void clearDiag(PluginCall call) {
        new File(getContext().getFilesDir(), TripService.DIAG_FILE).delete();
        call.resolve();
    }

    /** Pulihkan satu hari titik GPS dari cadangan. Ditolak bila berkas hari itu sudah ada dan overwrite bukan "1". */
    @PluginMethod
    public void writeDay(PluginCall call) {
        String date = call.getString("date", "");
        String text = call.getString("text", "");
        boolean over = "1".equals(call.getString("overwrite", "0"));
        if (!DATE_RE.matcher(date).matches()) {
            call.reject("Tanggal tidak valid");
            return;
        }
        try {
            File dir = new File(getContext().getFilesDir(), "points");
            if (!dir.exists()) {
                dir.mkdirs();
            }
            File dest = new File(dir, "points-" + date + ".csv");
            JSObject o = new JSObject();
            if (dest.exists() && !over) {
                o.put("written", false);
                call.resolve(o);
                return;
            }
            File tmp = new File(dir, "points-" + date + ".csv.tmp");
            FileOutputStream out = new FileOutputStream(tmp);
            out.write(text.getBytes("UTF-8"));
            out.flush();
            out.getFD().sync();
            out.close();
            if (!tmp.renameTo(dest)) {
                dest.delete();
                tmp.renameTo(dest);
            }
            o.put("written", true);
            call.resolve(o);
        } catch (Exception e) {
            call.reject("Gagal menulis: " + e.getMessage());
        }
    }

    @PluginMethod
    public void saveJson(PluginCall call) {
        String name = call.getString("name", "");
        String data = call.getString("data", "");
        if (!NAME_RE.matcher(name).matches()) {
            call.reject("Nama berkas tidak valid");
            return;
        }
        try {
            File dir = new File(getContext().getFilesDir(), "meta");
            if (!dir.exists()) {
                dir.mkdirs();
            }
            File tmp = new File(dir, name + ".json.tmp");
            FileOutputStream out = new FileOutputStream(tmp);
            out.write(data.getBytes("UTF-8"));
            out.flush();
            out.getFD().sync();
            out.close();
            File dest = new File(dir, name + ".json");
            if (!tmp.renameTo(dest)) {
                dest.delete();
                tmp.renameTo(dest);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Gagal menyimpan: " + e.getMessage());
        }
    }

    @PluginMethod
    public void loadJson(PluginCall call) {
        String name = call.getString("name", "");
        if (!NAME_RE.matcher(name).matches()) {
            call.reject("Nama berkas tidak valid");
            return;
        }
        File f = new File(new File(getContext().getFilesDir(), "meta"), name + ".json");
        JSObject o = new JSObject();
        o.put("data", f.exists() ? readFile(f) : "");
        call.resolve(o);
    }

    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        Context ctx = getContext();
        try {
            Intent i = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
        } catch (Exception e) {
            try {
                Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + ctx.getPackageName()));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(i);
            } catch (Exception e2) {
                call.reject("Pengaturan baterai tidak bisa dibuka");
                return;
            }
        }
        call.resolve();
    }

    private static String readFile(File f) {
        try {
            FileInputStream in = new FileInputStream(f);
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] b = new byte[16384];
            int n;
            while ((n = in.read(b)) > 0) {
                buf.write(b, 0, n);
            }
            in.close();
            return buf.toString("UTF-8");
        } catch (Exception e) {
            return "";
        }
    }
}
