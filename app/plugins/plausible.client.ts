import { installPlausibleClientLifecycle } from '~/utils/plausible-client-lifecycle'
import { resolvePlausibleCapability } from '~/utils/plausible-privacy'

interface PlausibleFunction {
  (event: string, options?: { url?: string }): void
}

declare global {
  interface Window {
    plausible?: PlausibleFunction
  }
}

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const capability = resolvePlausibleCapability({
    enabled: config.public.plausibleEnabled,
    domain: config.public.plausibleDomain,
    endpoint: config.public.plausibleEndpoint,
  })
  const router = useRouter()
  const { analyticsAllowed, initialize, refreshFromStorage } = usePrivacyConsent()

  installPlausibleClientLifecycle({
    capability,
    browserOrigin: window.location.origin,
    analyticsAllowed,
    initialize,
    refreshFromStorage,
    fetcher: window.fetch.bind(window),
    currentPath: () => router.currentRoute.value.fullPath,
    exposeSender: (sender) => {
      if (sender === undefined) {
        delete window.plausible
        return
      }

      window.plausible = (event, options) => sender(event, options?.url)
    },
    onConsentChange: (handler) => {
      watch(analyticsAllowed, handler)
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
