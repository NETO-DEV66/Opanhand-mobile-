import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/chat.tsx"),
  route("settings", "routes/connection-settings.tsx"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
