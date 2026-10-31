import { useTranslation } from "react-i18next";
import { SettingsSwitch } from "#/components/features/settings/settings-switch";
import { I18nKey } from "#/i18n/declaration";
import { isNativeShell } from "#/api/native-shell";
import { useAndroidBackButtonStepsBack } from "./use-android-back-button-steps-back";
import { writeAndroidBackButtonStepsBack } from "./android-back-button-storage";

/**
 * Android-only setting for what the hardware Back button does.
 *
 * The hardware button only exists in the native shell, so the switch is not
 * rendered in a browser, where the browser's own Back button governs.
 */
export function AndroidBackButtonSwitch() {
  const { t } = useTranslation("openhands");
  const stepsBack = useAndroidBackButtonStepsBack();

  if (!isNativeShell()) return null;

  return (
    <div className="flex flex-col gap-1">
      <SettingsSwitch
        testId="android-back-button-switch"
        isToggled={stepsBack}
        onToggle={(value) => writeAndroidBackButtonStepsBack(value)}
        togglePosition="right"
      >
        {t(I18nKey.SETTINGS$ANDROID_BACK_BUTTON_LABEL)}
      </SettingsSwitch>
      <p className="text-sm leading-5 text-tertiary-light">
        {t(I18nKey.SETTINGS$ANDROID_BACK_BUTTON_DESCRIPTION)}
      </p>
    </div>
  );
}
