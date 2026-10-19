import { Navigate } from "react-router";
import {
  SETTINGS_COMPACT_MAX_WIDTH,
  useBreakpoint,
} from "#/hooks/use-breakpoint";
import { useConfig } from "#/hooks/query/use-config";
import { useSettingsNavItems } from "#/hooks/use-settings-nav-items";
import { SettingsMobileHub } from "#/components/features/settings/settings-mobile-hub";
import { getFirstAvailablePath } from "#/utils/settings-utils";

export default function SettingsIndex() {
  const isMobile = useBreakpoint(SETTINGS_COMPACT_MAX_WIDTH);
  const navigationItems = useSettingsNavItems();
  const { data: config } = useConfig();

  if (isMobile) {
    return <SettingsMobileHub navigationItems={navigationItems} />;
  }

  const fallbackPath =
    getFirstAvailablePath(config?.feature_flags) ?? "/settings/app";

  return <Navigate to={fallbackPath} replace />;
}
