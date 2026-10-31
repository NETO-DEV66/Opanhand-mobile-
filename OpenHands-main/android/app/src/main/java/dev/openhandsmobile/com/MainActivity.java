package dev.openhandsmobile.com;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Host activity for the Capacitor web app.
 *
 * Two things are customised beyond the stock Capacitor host:
 *
 *  - The keep-alive foreground service is started while the activity is
 *    visible and stopped only when it is genuinely finishing. Merely
 *    backgrounding the app leaves the service running, which is what keeps the
 *    WebView and its conversation socket alive no matter how long the app is
 *    hidden.
 *
 *  - A few WebView rendering flags are tuned for smoother scrolling of a
 *    long, event-heavy chat list.
 *
 * The hardware back button is handled in the web layer
 * (`use-android-back-button`), where the router history and the open overlays
 * are known, so it is not intercepted here.
 */
public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        applyWebViewPerformanceTweaks();
        requestNotificationPermission();
        KeepAliveService.start(this);
    }

    /**
     * Android 13+ needs the runtime notification permission for the keep-alive
     * service's notification to show. The service runs regardless, so a refusal
     * costs only the visible indicator, not the background behaviour.
     */
    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return;
        if (
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
        ) {
            return;
        }
        ActivityCompat.requestPermissions(
            this,
            new String[] { Manifest.permission.POST_NOTIFICATIONS },
            1001
        );
    }

    @Override
    public void onResume() {
        super.onResume();
        // Returning to the foreground: make sure the service is alive again (it
        // may have been killed along with the process) without restarting the
        // web app's state.
        KeepAliveService.start(this);
    }

    @Override
    public void onDestroy() {
        // `isFinishing()` is false on a configuration change or a process
        // reclaim; stopping the service there would defeat its purpose. Only a
        // real teardown (the user closed the app) releases it.
        if (isFinishing()) {
            KeepAliveService.stop(this);
        }
        super.onDestroy();
    }

    /**
     * Rendering hints for a smooth chat scroll.
     *
     * The WebView is already hardware accelerated; these reduce per-frame work
     * on the compositor rather than changing what the page can do, so they are
     * safe for any content the app loads.
     */
    private void applyWebViewPerformanceTweaks() {
        if (bridge == null) return;
        WebView webView = bridge.getWebView();
        if (webView == null) return;

        // The conversation list is a very tall scroller; the glow/stretch
        // effect re-renders a large area every frame for no visual value here.
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);

        WebSettings settings = webView.getSettings();
        settings.setLoadsImagesAutomatically(true);
        settings.setDomStorageEnabled(true);

        // Let the compositor rasterise the WebView on its own layer, which
        // keeps the rest of the activity's chrome out of its invalidation path.
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        // Chromium's scrollbar fading is a no-op on touch devices but the
        // setting avoids a persistent scrollbar strip in some OEM WebViews.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            webView.setScrollbarFadingEnabled(true);
        }
    }
}
