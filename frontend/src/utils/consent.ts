import { COOKIE_POLICY_VERSION } from '@/config/brand'

// Storage keys are shared with the previous frontend so earlier decisions stay valid.
const CONSENT_KEY = 'cookie_consent'
const LEGACY_KEY = 'cookie_accepted'
export const OPEN_COOKIE_SETTINGS_EVENT = 'app:open-cookie-settings'

export interface CookieConsent {
  necessary: true
  analytics: boolean
  marketing: boolean
  version: string
  acceptedAt: string
}

export function readCookieConsent (): CookieConsent | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null')
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export function hasCookieDecision (): boolean {
  try {
    return Boolean(readCookieConsent()) || localStorage.getItem(LEGACY_KEY) === 'true'
  } catch {
    return false
  }
}

export function saveCookieConsent (analytics: boolean, marketing: boolean): CookieConsent {
  const payload: CookieConsent = { necessary: true, analytics, marketing, version: COOKIE_POLICY_VERSION, acceptedAt: new Date().toISOString() }
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(payload))
    localStorage.setItem(LEGACY_KEY, 'true')
  } catch { /* storage may be unavailable */ }
  return payload
}

export function openCookieSettings () {
  window.dispatchEvent(new CustomEvent(OPEN_COOKIE_SETTINGS_EVENT))
}
