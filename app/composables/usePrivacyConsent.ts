import type { PrivacyConsent } from '~/utils/privacy-consent'
import {
  PRIVACY_CONSENT_STORAGE_KEY,
  createPrivacyConsent,
  parsePrivacyConsent,
  persistPrivacyConsent,
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
  const sessionDenyOverride = useState<boolean>('privacy-session-deny', () => false)

  const refreshFromStorage = (): void => {
    if (!import.meta.client) return
    globalPrivacyControl.value = navigator.globalPrivacyControl === true
    if (sessionDenyOverride.value) {
      if (consent.value?.analytics !== false) consent.value = createPrivacyConsent(false)
      return
    }
    try {
      const raw = window.localStorage.getItem(PRIVACY_CONSENT_STORAGE_KEY)
      consent.value = parsePrivacyConsent(raw)
      if (raw !== null && consent.value === null) {
        window.localStorage.removeItem(PRIVACY_CONSENT_STORAGE_KEY)
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

  const save = (analytics: boolean): void => {
    const next = createPrivacyConsent(analytics)
    consent.value = next

    if (import.meta.client) {
      const persisted = persistPrivacyConsent(window.localStorage, next)
      sessionDenyOverride.value = !analytics && !persisted
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
    if (sessionDenyOverride.value) return
    if (event.key === null) {
      consent.value = null
      return
    }
    if (event.key !== PRIVACY_CONSENT_STORAGE_KEY) return
    consent.value = parsePrivacyConsent(event.newValue)
  }

  return {
    consent,
    preferencesOpen,
    globalPrivacyControl,
    initialized: computed(() => consent.value !== undefined),
    hasDecision: computed(() => consent.value !== undefined && consent.value !== null),
    analyticsAllowed: computed(() => consent.value?.analytics === true),
    initialize,
    refreshFromStorage,
    acceptAnalytics: () => save(true),
    rejectAnalytics: () => save(false),
    save,
    openPreferences,
    restorePreferencesFocus,
    syncFromStorage,
  }
}
