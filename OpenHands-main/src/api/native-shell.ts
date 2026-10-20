/**
 * Whether this page is running inside the Capacitor native shell.
 *
 * On Android the shell registers a `WebViewClient` that hands every
 * off-origin navigation to the system browser (`Intent.ACTION_VIEW`) and
 * cancels the in-WebView load. That makes a top-level `location.assign()` the
 * reliable way to open a URL externally; `window.open` depends on multiple
 * windows being supported, which the shell does not enable.
 *
 * It also means an `<a href>` to another origin silently leaves the app. The
 * shipped APK is locked to OpenHands Cloud, whose host is a different origin
 * from the WebView's own `https://localhost`, so any settings link that points
 * at the Cloud host would open the system browser. Callers that keep the user
 * in the app (see `shouldDeferSettingsToCloudShell()`) check this first.
 */
export function isNativeShell(): boolean {
  if (typeof window === "undefined") return false;
  const capacitor = (
    window as unknown as {
      Capacitor?: { isNativePlatform?: () => boolean };
    }
  ).Capacitor;
  return capacitor?.isNativePlatform?.() === true;
}
