export const COOKIE_PREFERENCES_KEY = "glanzio-cookie-choice-v1";
export const COOKIE_PREFERENCES_EVENT = "glanzio-cookie-preferences";
export type CookieChoice = { version: 1; choice: "necessary" | "accept"; savedAt: number };
let memoryChoice: CookieChoice | null = null;

export function readCookieChoice(): CookieChoice | null {
  try {
    const raw = window.localStorage.getItem(COOKIE_PREFERENCES_KEY);
    const value = raw ? JSON.parse(raw) as Partial<CookieChoice> : memoryChoice;
    if (value?.version === 1 && (value.choice === "necessary" || value.choice === "accept") && typeof value.savedAt === "number" && value.savedAt <= Date.now() && Date.now() - value.savedAt < 180 * 86400_000) return value as CookieChoice;
  } catch { return memoryChoice; }
  return null;
}

export function saveCookieChoice(choice: CookieChoice["choice"]) {
  memoryChoice = { version: 1, choice, savedAt: Date.now() };
  try { window.localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(memoryChoice)); } catch { /* Session-only choice when storage is unavailable. */ }
}

export function openCookiePreferences() {
  window.dispatchEvent(new Event(COOKIE_PREFERENCES_EVENT));
}
