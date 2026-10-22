package com.hz.hztrip;

import android.app.Activity;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Popup kecil di atas layar: "Anda sedang bergerak. Mulai rekam?" Ukuran dan gaya mirip popup pesan. */
public class AlertActivity extends Activity {
    static AlertActivity cur;
    private static final long AUTO_CLOSE_MS = 30000L;
    private final Handler h = new Handler(Looper.getMainLooper());
    private final Runnable closer = new Runnable() {
        @Override
        public void run() {
            finish();
        }
    };

    private int dp(int v) {
        return (int) (v * getResources().getDisplayMetrics().density + 0.5f);
    }

    private TextView txt(String s, int sp, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setTextColor(color);
        if (bold) {
            t.setTypeface(Typeface.DEFAULT_BOLD);
        }
        return t;
    }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        cur = this;
        Window w = getWindow();
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            w.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
        w.addFlags(WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL);
        w.clearFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);
        w.setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));

        boolean night = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        int bg = night ? 0xFF1F2C34 : 0xFFFFFFFF;
        int tx = night ? 0xFFE9EDEF : 0xFF111B21;
        int tx2 = night ? 0xFF8696A0 : 0xFF667781;
        int green = night ? 0xFF25C26A : 0xFF0A8F4A;

        FrameLayout box = new FrameLayout(this);
        box.setPadding(dp(8), dp(6), dp(8), dp(10));
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(16), dp(12), dp(8), dp(4));
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(bg);
        shape.setCornerRadius(dp(14));
        card.setBackground(shape);
        if (Build.VERSION.SDK_INT >= 21) {
            card.setElevation(dp(8));
        }

        LinearLayout head = new LinearLayout(this);
        head.setOrientation(LinearLayout.HORIZONTAL);
        TextView app = txt("HZ Trip", 13, green, true);
        TextView now = txt("  ·  sekarang", 13, tx2, false);
        head.addView(app);
        head.addView(now);
        card.addView(head);

        TextView title = txt("Anda sedang bergerak", 16, tx, true);
        title.setPadding(0, dp(4), 0, 0);
        card.addView(title);
        card.addView(txt("Perekaman belum jalan. Mulai rekam?", 14, tx2, false));

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.END);
        TextView close = txt("TUTUP", 14, tx2, true);
        close.setLetterSpacing(0.05f);
        close.setPadding(dp(16), dp(12), dp(16), dp(12));
        TextView go = txt("MULAI REKAM", 14, green, true);
        go.setLetterSpacing(0.05f);
        go.setPadding(dp(16), dp(12), dp(12), dp(12));
        row.addView(close);
        row.addView(go);
        card.addView(row);
        box.addView(card, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT));

        close.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                Alert.cancel(AlertActivity.this, true);
                finish();
            }
        });
        go.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                try {
                    Intent i = new Intent(AlertActivity.this, TripService.class).setAction(TripService.ACTION_START);
                    if (Build.VERSION.SDK_INT >= 26) {
                        startForegroundService(i);
                    } else {
                        startService(i);
                    }
                } catch (Throwable ignored) {
                }
                Alert.cancel(AlertActivity.this, false);
                finish();
            }
        });

        setContentView(box);
        WindowManager.LayoutParams lp = w.getAttributes();
        lp.width = (int) (getResources().getDisplayMetrics().widthPixels * 0.96f);
        lp.height = WindowManager.LayoutParams.WRAP_CONTENT;
        lp.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        lp.y = dp(24);
        w.setAttributes(lp);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
    }

    @Override
    protected void onDestroy() {
        h.removeCallbacks(closer);
        if (cur == this) {
            cur = null;
        }
        super.onDestroy();
    }
}
