import {
  installMetaPixelClientLifecycle,
  type MetaBrowserEventSender,
  type MetaPixelCommand,
} from '~/utils/meta-pixel-client-lifecycle'
import { resolveMetaPixelCapability } from '~/utils/meta-pixel'

const SCRIPT_ID = 'launchlog-meta-pixel'

interface MetaPixelQueue extends MetaPixelCommand {
  callMethod?: MetaPixelCommand
  queue: unknown[][]
  loaded: boolean
  version: string
}

declare global {
  interface Window {
    _fbq?: MetaPixelQueue
    fbq?: MetaPixelQueue
    launchlogMetaEvent?: MetaBrowserEventSender
  }
}

const bootstrapPixelQueue = (): MetaPixelQueue => {
  if (window.fbq) return window.fbq

  const queue = ((...args: unknown[]) => {
    if (queue.callMethod) queue.callMethod(...args)
    else queue.queue.push(args)
  }) as MetaPixelQueue
  queue.queue = []
  queue.loaded = true
  queue.version = '2.0'
  window.fbq = queue
  window._fbq = queue
  return queue
}

const removePixel = (): void => {
  document.getElementById(SCRIPT_ID)?.remove()
  delete window.fbq
  delete window._fbq
}

const clearMetaCookie = (name: '_fbp' | '_fbc'): void => {
  const attributes = 'Max-Age=0; Path=/; SameSite=Lax; Secure'
  document.cookie = `${name}=; ${attributes}`
  document.cookie = `${name}=; Domain=.launchlog.ai; ${attributes}`
}

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const capability = resolveMetaPixelCapability({
    enabled: config.public.metaPixelEnabled,
    domain: config.public.domain,
    pixelId: config.public.metaPixelId,
  })
  const router = useRouter()
  const { advertisingAllowed, initialize, refreshFromStorage } = usePrivacyConsent()
  let command: MetaPixelQueue | null = null

  installMetaPixelClientLifecycle({
    capability,
    browserOrigin: window.location.origin,
    advertisingAllowed,
    initialize,
    refreshFromStorage,
    currentPath: () => router.currentRoute.value.fullPath,
    command: (...args) => {
      command ??= bootstrapPixelQueue()
      command(...args)
    },
    loadScript: (url) => {
      if (document.getElementById(SCRIPT_ID)) return

      const script = document.createElement('script')
      script.id = SCRIPT_ID
      script.async = true
      script.src = url
      script.referrerPolicy = 'no-referrer'
      document.head.append(script)
    },
    removeScript: () => {
      removePixel()
      command = null
    },
    clearCookie: clearMetaCookie,
    exposeEventSender: (sender) => {
      if (sender === undefined) {
        delete window.launchlogMetaEvent
        return
      }
      window.launchlogMetaEvent = sender
    },
    onConsentChange: (handler) => {
      watch(advertisingAllowed, handler)
    },
    onNavigation: (handler) => {
      router.afterEach((to, from, failure) => {
        handler(to.fullPath, from.fullPath, failure)
      })
    },
    onMounted: (handler) => {
      nuxtApp.hook('app:mounted', handler)
    },
  })
})
