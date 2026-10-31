const ANDROID_BACK_BUTTON_STEP_BACK_STORAGE_KEY =
  "openhands.android-back-button-step-back";
const ANDROID_BACK_BUTTON_STEP_BACK_CHANGE_EVENT =
  "openhands:android-back-button-step-back-change";

/**
 * Whether the hardware Back button steps back through the app.
 *
 * Defaults to true: Back closes the topmost menu or dialog, then walks the
 * in-app history, and only leaves the app from the root. When turned off, Back
 * leaves the app immediately — the pre-Android-13 "always exit" behaviour some
 * users expect from a single-screen app.
 */
export function readAndroidBackButtonStepsBack(): boolean {
  if (typeof window === "undefined") return true;
  return (
    window.localStorage.getItem(ANDROID_BACK_BUTTON_STEP_BACK_STORAGE_KEY) !==
    "false"
  );
}

export function getAndroidBackButtonStepsBackSnapshot(): boolean {
  return readAndroidBackButtonStepsBack();
}

export function subscribeAndroidBackButtonStepsBack(
  onStoreChange: () => void,
): () => void {
  const handleChange = () => onStoreChange();
  window.addEventListener("storage", handleChange);
  window.addEventListener(
    ANDROID_BACK_BUTTON_STEP_BACK_CHANGE_EVENT,
    handleChange,
  );

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(
      ANDROID_BACK_BUTTON_STEP_BACK_CHANGE_EVENT,
      handleChange,
    );
  };
}

export function writeAndroidBackButtonStepsBack(stepsBack: boolean): void {
  window.localStorage.setItem(
    ANDROID_BACK_BUTTON_STEP_BACK_STORAGE_KEY,
    stepsBack ? "true" : "false",
  );
  window.dispatchEvent(new Event(ANDROID_BACK_BUTTON_STEP_BACK_CHANGE_EVENT));
}
