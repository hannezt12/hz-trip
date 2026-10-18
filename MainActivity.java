package com.hz.hztrip;

import android.os.Bundle;
import android.webkit.ValueCallback;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(HzTripPlugin.class);
        super.onCreate(savedInstanceState);
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
