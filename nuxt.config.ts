import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-16',
  devtools: { enabled: true },
  // Tailwind v4 wired via the official Vite plugin (replaces the deprecated @nuxtjs/tailwindcss
  // legacy module which was pinned to Tailwind v3 and incompatible with shadcn-vue@2.7+).
  vite: {
    plugins: [tailwindcss()],
  },
  css: ['~/assets/css/tailwind.css'],
  modules: [
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
      // Host only (no /api prefix). Callers must include /api/v1/... themselves — see
      // server/middleware/markdown-negotiation.ts for the canonical pattern.
      apiUrl: process.env.NUXT_PUBLIC_API_URL || 'https://api.launchlog.ai',
      domain: process.env.NUXT_PUBLIC_DOMAIN || 'launchlog.ai',
      firebase: {
        // 6 fields — no measurementId (D-032 — Plausible, not GA4).
        // storageBucket/messagingSenderId/appId kept for future App Check + headers, harmless if unused.
        apiKey: process.env.NUXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NUXT_PUBLIC_FIREBASE_APP_ID,
      },
      turnstileSiteKey: process.env.NUXT_PUBLIC_TURNSTILE_SITE_KEY,
      plausibleDomain: process.env.NUXT_PUBLIC_PLAUSIBLE_DOMAIN,
    },
  },
  routeRules: {
    '/': { isr: 600 },
    '/browse-all': { isr: 1800 },
    '/tech-products': { isr: 1800 },
    '/featured': { isr: 3600 },
    '/sponsors': { redirect: '/featured' },
    '/listing/**': { isr: 3600 },
    '/pricing': { isr: 86400 },
    // '/admin/**': robots opt-out lands when a Nuxt SEO/robots module is wired in Phase 3.
    // The Tailwind v4 stack swap dropped @nuxtjs/seo, so for now we omit the directive.
  },
  components: {
    // Exclude shadcn-vue barrel files (app/components/ui/<name>/index.ts) from auto-import.
    // Without this, Nuxt registers both Foo.vue AND index.ts (which re-exports the same component),
    // emitting "Two component files resolving to the same name" warnings on every build.
    dirs: [
      { path: '~/components', extensions: ['vue'] },
    ],
  },
  site: {
    url: 'https://launchlog.ai',
    name: 'LaunchLog',
  },
  sitemap: {
    sources: ['/api/__sitemap__/listings'],
  },
})
