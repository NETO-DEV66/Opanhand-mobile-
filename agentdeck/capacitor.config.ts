import type { CapacitorConfig } from "@capacitor/cli";

// Android wrapper config. The web build (react-router build) is copied into
// the native app, so the phone runs the same UI as the browser version.
// There is no server URL to configure: the app is a direct-connect client and
// asks the user for a provider API key on first launch.
const config: CapacitorConfig = {
  appId: "dev.netodev66.agentdeck",
  appName: "AgentDeck",
  webDir: "build",
  server: {
    androidScheme: "https",
  },
};

export default config;
