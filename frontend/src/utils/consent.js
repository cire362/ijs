export const CONSENT_STORAGE_KEY = "cookie_consent";
export const LEGACY_COOKIE_ACCEPTED_KEY = "cookie_accepted";
export const OPEN_COOKIE_SETTINGS_EVENT = "app:open-cookie-settings";

export const LEGAL_DOC_VERSION = "2026-01-12";
export const COOKIE_POLICY_VERSION = "2026-01-12";

export function readCookieConsent() {
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hasCookieConsentDecision() {
  const consent = readCookieConsent();
  if (consent) return true;

  try {
    return localStorage.getItem(LEGACY_COOKIE_ACCEPTED_KEY) === "true";
  } catch {
    return false;
  }
}

export function saveCookieConsent({ analytics, marketing }) {
  const payload = {
    necessary: true,
    analytics: Boolean(analytics),
    marketing: Boolean(marketing),
    version: COOKIE_POLICY_VERSION,
    acceptedAt: new Date().toISOString(),
  };

  localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(payload));
  localStorage.setItem(LEGACY_COOKIE_ACCEPTED_KEY, "true");
  return payload;
}

export function openCookieSettings() {
  window.dispatchEvent(new CustomEvent(OPEN_COOKIE_SETTINGS_EVENT));
}
