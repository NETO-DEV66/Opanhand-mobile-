import { useSyncExternalStore } from "react";
import {
  getAndroidBackButtonStepsBackSnapshot,
  subscribeAndroidBackButtonStepsBack,
} from "./android-back-button-storage";

export function useAndroidBackButtonStepsBack(): boolean {
  return useSyncExternalStore(
    subscribeAndroidBackButtonStepsBack,
    getAndroidBackButtonStepsBackSnapshot,
    () => true,
  );
}
