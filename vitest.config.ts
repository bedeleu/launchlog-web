import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    environmentOptions: {
      nuxt: {
        domEnvironment: 'happy-dom',
        rootDir: `${process.cwd()}/.nuxt/test-utils-root`,
        overrides: {
          extends: [process.cwd()],
          alias: {
            '@': `${process.cwd()}/app`,
            '~': `${process.cwd()}/app`,
          },
        },
      },
    },
    include: ['test/nuxt/**/*.nuxt.ts'],
  },
})
