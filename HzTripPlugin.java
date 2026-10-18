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
                @Permission(alias = "notifications", strings = {"android.permission.POST_NOTIFICATIONS"})
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
            public void onState(boolean recording) {
                JSObject o = new JSObject();
                o.put("recording", recording);
                notifyListeners("state", o);
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
        TripService s = TripService.instance;
        if (s != null) {
            s.stopRecording();
        } else {
            getContext().startService(new Intent(getContext(), TripService.class).setAction(TripService.ACTION_STOP));
        }
        JSObject o = new JSObject();
        o.put("recording", false);
        call.resolve(o);
    }

    @PluginMethod
    public void status(PluginCall call) {
        Context ctx = getContext();
        JSObject o = new JSObject();
        o.put("recording", TripService.recording);
        o.put("lastT", TripService.lastT);
        o.put("lastV", TripService.lastSpeed);
        o.put("lastAcc", TripService.lastAcc);
        o.put("count", TripService.count);
        o.put("startedAt", TripService.startedAt);
        o.put("permission", hasLocation());
        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        o.put("batteryFree", pm != null && pm.isIgnoringBatteryOptimizations(ctx.getPackageName()));
        call.resolve(o);
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
