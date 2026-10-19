package com.hz.hztrip;

import android.app.PendingIntent;
import android.content.Intent;
import android.graphics.drawable.Icon;
import android.os.Build;
import android.service.quicksettings.Tile;
import android.service.quicksettings.TileService;

/** Tombol Quick Settings: satu ketuk Mulai / Akhiri perekaman manual. */
public class HzTileService extends TileService {

    @Override
    public void onStartListening() {
        super.onStartListening();
        refresh();
    }

    @Override
    public void onClick() {
        super.onClick();
        boolean rec = TripService.mode == TripService.M_REKAM;
        Intent i = new Intent(this, TripService.class).setAction(rec ? TripService.ACTION_STOP : TripService.ACTION_START);
        try {
            if (!rec && Build.VERSION.SDK_INT >= 26) {
                startForegroundService(i);
            } else {
                startService(i);
            }
        } catch (Exception e) {
            openApp();
        }
        refresh();
    }

    private void openApp() {
        try {
            Intent li = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (li == null) {
                return;
            }
            li.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (Build.VERSION.SDK_INT >= 34) {
                startActivityAndCollapse(PendingIntent.getActivity(this, 0, li, PendingIntent.FLAG_IMMUTABLE));
            } else {
                startActivityAndCollapse(li);
            }
        } catch (Exception ignored) {
        }
    }

    private void refresh() {
        Tile t = getQsTile();
        if (t == null) {
            return;
        }
        int m = TripService.mode;
        t.setLabel("HZ Trip");
        if (m == TripService.M_REKAM) {
            t.setState(Tile.STATE_ACTIVE);
            if (Build.VERSION.SDK_INT >= 29) {
                t.setSubtitle("Merekam · ketuk akhiri");
            }
        } else {
            t.setState(Tile.STATE_INACTIVE);
            if (Build.VERSION.SDK_INT >= 29) {
                t.setSubtitle(m == TripService.M_OFF ? "Ketuk untuk mulai" : "Siaga · ketuk mulai");
            }
        }
        try {
            t.setIcon(Icon.createWithResource(this, android.R.drawable.ic_menu_mylocation));
        } catch (Exception ignored) {
        }
        t.updateTile();
    }
}
