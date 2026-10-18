import type { CapacitorConfig } from "@capacitor/cli";

// Android wrapper config. The web build (react-router build) is copied into
// the native app, so the phone runs the same UI as the browser version.
// Backend URL is NOT stored here: set VITE_BACKEND_BASE_URL at build time.
const config: CapacitorConfig = {
  appId: "dev.openhands.agentcanvas",
  appName: "OpenHands",
  webDir: "build",
  server: {
    androidScheme: "https",
  },
};

export default config;
