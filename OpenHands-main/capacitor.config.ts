import type { CapacitorConfig } from "@capacitor/cli";

// Android wrapper config. The web build (react-router build) is copied into
// the native app, so the phone runs the same UI as the browser version.
// Backend URL is NOT stored here: set VITE_BACKEND_BASE_URL at build time.
const config: CapacitorConfig = {
  appId: "dev.openhandsmobile.com",
  appName: "OpenHands Mobile",
  webDir: "build",
  // The Capacitor packages are installed outside package.json (see the Android
  // workflow), so `cap sync` cannot discover them as dependencies. List the
  // ones that ship a native plugin explicitly: @capacitor/app provides the
  // Android back-button event the web layer listens for.
  includePlugins: ["@capacitor/app"],
  server: {
    androidScheme: "https",
  },
};

export default config;
