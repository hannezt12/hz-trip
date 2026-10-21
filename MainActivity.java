package com.hz.hztrip;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.ValueCallback;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(HzTripPlugin.class);
        super.onCreate(savedInstanceState);
        blackStatusBar();
    }

    /** Status bar selalu hitam dengan ikon terang (sinyal, baterai, jam), di tema gelap maupun terang. */
    @SuppressWarnings("deprecation")
    private void blackStatusBar() {
        try {
            Window w = getWindow();
            w.setStatusBarColor(Color.BLACK);
            View decor = w.getDecorView();
            if (Build.VERSION.SDK_INT >= 23) {
                decor.setSystemUiVisibility(decor.getSystemUiVisibility() & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
            }
        } catch (Throwable ignored) {
        }
    }

    /**
     * Tombol back Android: tanya halaman web dulu. Bila ada lembar/drawer terbuka atau
     * halaman bukan Spidometer, halaman menanganinya (menutup / kembali ke Spidometer).
     * Hanya jika sudah di Spidometer, aplikasi keluar.
     */
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        WebView wv = null;
        try {
            wv = getBridge().getWebView();
        } catch (Exception ignored) {
        }
        if (wv == null) {
            super.onBackPressed();
            return;
        }
        wv.evaluateJavascript("(function(){return window.hzBack ? window.hzBack() : false;})()", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String value) {
                if (!"true".equals(value)) {
                    MainActivity.super.onBackPressed();
                }
            }
        });
    }
}
