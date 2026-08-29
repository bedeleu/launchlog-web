import type { PrivacyConsent } from '~/utils/privacy-consent'
import {
  LEGACY_PRIVACY_CONSENT_STORAGE_KEY,
  PRIVACY_CONSENT_STORAGE_KEY,
  createPrivacyConsent,
  parsePrivacyConsent,
  persistPrivacyConsent,
  readPrivacyConsent,
} from '~/utils/privacy-consent'

declare global {
  interface Navigator {
    globalPrivacyControl?: boolean
  }
}

let preferencesReturnTarget: HTMLElement | null = null

export const usePrivacyConsent = () => {
  const consent = useState<PrivacyConsent | null | undefined>('privacy-consent', () => undefined)
  const preferencesOpen = useState<boolean>('privacy-preferences-open', () => false)
  const globalPrivacyControl = useState<boolean>('privacy-gpc', () => false)
  const sessionConsentOverride = useState<PrivacyConsent | null>('privacy-session-consent-override', () => null)

  const refreshFromStorage = (): void => {
    if (!import.meta.client) return
    globalPrivacyControl.value = navigator.globalPrivacyControl === true

    if (sessionConsentOverride.value !== null) {
      consent.value = sessionConsentOverride.value
      return
    }

    try {
      const currentRaw = window.localStorage.getItem(PRIVACY_CONSENT_STORAGE_KEY)
      const legacyRaw = window.localStorage.getItem(LEGACY_PRIVACY_CONSENT_STORAGE_KEY)
      const stored = readPrivacyConsent(window.localStorage)
      consent.value = stored

      if (stored !== null && parsePrivacyConsent(currentRaw) === null) {
        const persisted = persistPrivacyConsent(window.localStorage, stored)
        if (!persisted) sessionConsentOverride.value = stored
        return
      }

      if (currentRaw !== null && stored === null) {
        window.localStorage.removeItem(PRIVACY_CONSENT_STORAGE_KEY)
      }
      if (legacyRaw !== null && stored === null) {
        window.localStorage.removeItem(LEGACY_PRIVACY_CONSENT_STORAGE_KEY)
      }
    }
    catch {
      consent.value = null
    }
  }

  const initialize = (): void => {
    if (!import.meta.client || consent.value !== undefined) return
    refreshFromStorage()
  }

  const save = (analytics: boolean, advertising: boolean): void => {
    const next = createPrivacyConsent(
      analytics,
      advertising && !globalPrivacyControl.value,
    )
    consent.value = next

    if (import.meta.client) {
      const persisted = persistPrivacyConsent(window.localStorage, next)
      sessionConsentOverride.value = persisted ? null : next
    }

    preferencesOpen.value = false
  }

  const openPreferences = (): void => {
    initialize()
    if (import.meta.client && document.activeElement instanceof HTMLElement) {
      preferencesReturnTarget = document.activeElement
    }
    preferencesOpen.value = true
  }

  const restorePreferencesFocus = (): void => {
    if (!import.meta.client) return

    const target = preferencesReturnTarget?.isConnected
      ? preferencesReturnTarget
      : document.querySelector<HTMLElement>('[data-privacy-preferences-trigger]')
    preferencesReturnTarget = null
    target?.focus()
  }

  const syncFromStorage = (event: StorageEvent): void => {
    if (
      event.key !== null
      && event.key !== PRIVACY_CONSENT_STORAGE_KEY
      && event.key !== LEGACY_PRIVACY_CONSENT_STORAGE_KEY
    ) return

    sessionConsentOverride.value = null
    if (event.key === null) {
      consent.value = null
      return
    }

    refreshFromStorage()
  }

  return {
    consent,
    preferencesOpen,
    globalPrivacyControl,
    initialized: computed(() => consent.value !== undefined),
    hasDecision: computed(() => consent.value !== undefined && consent.value !== null),
    analyticsAllowed: computed(() => consent.value?.analytics === true),
    advertisingAllowed: computed(() =>
      consent.value?.advertising === true && !globalPrivacyControl.value,
    ),
    initialize,
    refreshFromStorage,
    acceptOptional: () => save(true, true),
    rejectOptional: () => save(false, false),
    save,
    openPreferences,
    restorePreferencesFocus,
    syncFromStorage,
  }
}
