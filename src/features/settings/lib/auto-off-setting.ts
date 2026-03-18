const AUTO_OFF_SETTING_KEY = "magic_wand.auto_off_enabled";
const DEFAULT_AUTO_OFF_ENABLED = true;

export function getAutoOffEnabled(): boolean {
  if (typeof window === "undefined") {
    return DEFAULT_AUTO_OFF_ENABLED;
  }

  const raw = window.localStorage.getItem(AUTO_OFF_SETTING_KEY);
  if (raw === null) {
    return DEFAULT_AUTO_OFF_ENABLED;
  }

  return raw === "1";
}

export function setAutoOffEnabled(enabled: boolean): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTO_OFF_SETTING_KEY, enabled ? "1" : "0");
}

export { AUTO_OFF_SETTING_KEY, DEFAULT_AUTO_OFF_ENABLED };
