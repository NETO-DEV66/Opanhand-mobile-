import { defineConfig } from "vite";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";

// AgentDeck is a client-only SPA: it ships no server bundle and talks straight
// to the model provider the user picked, so there is no dev proxy, no i18n
// asset middleware and no runtime dependency pre-bundling list to maintain.
export default defineConfig({
  plugins: [reactRouter(), tailwindcss()],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    port: Number.parseInt(process.env.VITE_FRONTEND_PORT ?? "3001", 10),
    host: process.env.VITE_BIND_HOST ?? "127.0.0.1",
    allowedHosts: true,
  },
  clearScreen: false,
});
