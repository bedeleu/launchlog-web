import type { PlausibleCapability, PlausibleFetch } from './plausible-privacy'
import { createPlausibleEventSender } from './plausible-privacy'
import { shouldTrackPlausibleNavigation } from './plausible-navigation'

interface BooleanRef {
  value: boolean
}

export interface PlausibleBrowserFunction {
  (event: string, path?: string): void
}

interface PlausibleClientLifecycleDependencies {
  capability: PlausibleCapability | null
  browserOrigin: string
  analyticsAllowed: BooleanRef
  initialize: () => void
  refreshFromStorage: () => void
  fetcher: PlausibleFetch
  currentPath: () => string
  exposeSender: (sender: PlausibleBrowserFunction | undefined) => void
  onConsentChange: (handler: (allowed: boolean) => void) => void
  onNavigation: (handler: (to: string, from: string, failure?: unknown) => void) => void
  onMounted: (handler: () => void) => void
}

export const installPlausibleClientLifecycle = (
  dependencies: PlausibleClientLifecycleDependencies,
): boolean => {
  const {
    capability,
    browserOrigin,
    analyticsAllowed,
    initialize,
    refreshFromStorage,
    fetcher,
    currentPath,
    exposeSender,
    onConsentChange,
    onNavigation,
    onMounted,
  } = dependencies

  if (capability === null || capability.origin !== browserOrigin) return false

  const sender = createPlausibleEventSender(
    capability,
    fetcher,
    () => {
      refreshFromStorage()
      return analyticsAllowed.value
    },
  )
  let appMounted = false
  let enabled = false

  const emit = (event: string, rawPath: string): void => {
    if (!enabled || !analyticsAllowed.value) return
    sender.send(event, rawPath)
  }

  const enable = (): void => {
    if (!appMounted || enabled || !analyticsAllowed.value) return

    sender.enable()
    enabled = true
    exposeSender((event, path) => emit(event, path ?? currentPath()))
    emit('pageview', currentPath())
  }

  const disable = (): void => {
    sender.disable()
    enabled = false
    exposeSender(undefined)
  }

  initialize()
  onConsentChange((allowed) => {
    if (allowed) enable()
    else disable()
  })
  onNavigation((to, from, failure) => {
    if (shouldTrackPlausibleNavigation(to, from, failure, capability)) {
      emit('pageview', to)
    }
  })
  onMounted(() => {
    appMounted = true
    enable()
  })

  return true
}
