import type { FunnelEvent } from './plausible-privacy'
import {
  isMetaEventId,
  mapFunnelEventToMeta,
  sanitizePublicMetaUrl,
  type MetaPixelCapability,
} from './meta-pixel'

interface BooleanRef {
  value: boolean
}

export interface MetaPixelCommand {
  (...args: unknown[]): void
}

export interface MetaBrowserEventSender {
  (event: FunnelEvent, eventId: string): boolean
}

interface MetaPixelClientLifecycleDependencies {
  capability: MetaPixelCapability | null
  browserOrigin: string
  advertisingAllowed: BooleanRef
  initialize: () => void
  refreshFromStorage: () => void
  currentPath: () => string
  command: MetaPixelCommand
  loadScript: (url: string) => void
  removeScript: () => void
  clearCookie: (name: '_fbp' | '_fbc') => void
  exposeEventSender: (sender: MetaBrowserEventSender | undefined) => void
  onConsentChange: (handler: (allowed: boolean) => void) => void
  onNavigation: (handler: (to: string, from: string, failure?: unknown) => void) => void
  onMounted: (handler: () => void) => void
}

export const installMetaPixelClientLifecycle = (
  dependencies: MetaPixelClientLifecycleDependencies,
): boolean => {
  const {
    capability,
    browserOrigin,
    advertisingAllowed,
    initialize,
    refreshFromStorage,
    currentPath,
    command,
    loadScript,
    removeScript,
    clearCookie,
    exposeEventSender,
    onConsentChange,
    onNavigation,
    onMounted,
  } = dependencies

  if (capability === null || capability.origin !== browserOrigin) return false

  let appMounted = false
  let enabled = false

  const pageView = (rawPath: string): boolean => {
    if (!enabled || !advertisingAllowed.value) return false
    if (sanitizePublicMetaUrl(rawPath, capability) === null) return false

    command('track', 'PageView')
    return true
  }

  const eventSender: MetaBrowserEventSender = (event, eventId) => {
    refreshFromStorage()
    if (!enabled || !advertisingAllowed.value || !isMetaEventId(eventId)) return false
    if (sanitizePublicMetaUrl(currentPath(), capability) === null) return false

    const metaEvent = mapFunnelEventToMeta(event)
    command(metaEvent.method, metaEvent.name, {}, { eventID: eventId })
    return true
  }

  const enable = (): void => {
    if (
      !appMounted
      || enabled
      || !advertisingAllowed.value
      || sanitizePublicMetaUrl(currentPath(), capability) === null
    ) return

    enabled = true
    command('consent', 'grant')
    command('init', capability.pixelId)
    command('set', 'autoConfig', false, capability.pixelId)
    exposeEventSender(eventSender)
    pageView(currentPath())
    loadScript(capability.scriptUrl)
  }

  const disable = (): void => {
    if (enabled) command('consent', 'revoke')
    enabled = false
    exposeEventSender(undefined)
    removeScript()
    clearCookie('_fbp')
    clearCookie('_fbc')
  }

  initialize()
  onConsentChange((allowed) => {
    if (allowed) enable()
    else disable()
  })
  onNavigation((to, from, failure) => {
    if (failure) return

    if (!enabled) {
      enable()
      return
    }

    const toUrl = sanitizePublicMetaUrl(to, capability)
    const fromUrl = sanitizePublicMetaUrl(from, capability)
    if (toUrl !== null && toUrl !== fromUrl) pageView(to)
  })
  onMounted(() => {
    appMounted = true
    enable()
  })

  return true
}
