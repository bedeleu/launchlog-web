// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-16',
  devtools: { enabled: true },
  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxtjs/sitemap',
    '@vueuse/nuxt',
    '@pinia/nuxt',
    '@nuxtjs/turnstile',
  ],
  app: {
    head: {
      title: 'LaunchLog — The log of what just shipped',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content:
            'A curated directory for indie makers, SaaS founders, and tech launches. Engineered to be cited by ChatGPT, Perplexity, Claude, and Gemini.',
        },
      ],
    },
  },
  runtimeConfig: {
    public: {
      apiUrl: process.env.NUXT_PUBLIC_API_URL || 'https://api.launchlog.ai',
      domain: process.env.NUXT_PUBLIC_DOMAIN || 'launchlog.ai',
      firebase: {
        apiKey: process.env.NUXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID,
      },
      turnstileSiteKey: process.env.NUXT_PUBLIC_TURNSTILE_SITE_KEY,
      plausibleDomain: process.env.NUXT_PUBLIC_PLAUSIBLE_DOMAIN,
    },
  },
  routeRules: {
    '/': { isr: 600 },
    '/browse-all': { isr: 1800 },
    '/tech-products': { isr: 1800 },
    '/sponsors': { isr: 3600 },
    '/listing/**': { isr: 3600 },
    '/pricing': { isr: 86400 },
    '/admin/**': { robots: false },
  },
  site: {
    url: 'https://launchlog.ai',
    name: 'LaunchLog',
  },
  sitemap: {
    sources: ['/api/__sitemap__/listings'],
  },
})
