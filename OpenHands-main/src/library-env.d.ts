/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

interface Window {
  __GITHUB_CLIENT_ID__?: string | null;
  /** Set by entry.client once React has hydrated; read by the prelude in <head>. */
  __openhandsMounted?: boolean;
}
