import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { compile } from '@vue/compiler-dom'
import { parse } from '@vue/compiler-sfc'
import { createSSRApp, defineComponent, h } from 'vue'
import { renderToString } from '@vue/server-renderer'

const source = readFileSync(
  fileURLToPath(new URL('./NewsletterCapture.vue', import.meta.url)),
  'utf8',
)
const template = parse(source).descriptor.template?.content
if (!template) throw new Error('NewsletterCapture template is missing')

const render = new Function(
  'Vue',
  compile(template, { mode: 'function' }).code,
)(await import('vue'))
const passthrough = (tag: string) => defineComponent({
  inheritAttrs: false,
  setup: (_props, { attrs, slots }) => () => h(tag, {
    ...attrs,
    href: attrs.to ?? attrs.href,
  }, slots.default?.() ?? []),
})

type CaptureState = 'idle' | 'submitting' | 'success' | 'error'

async function renderCapture(state: CaptureState, error = ''): Promise<string> {
  const app = createSSRApp({
    render,
    setup: () => ({
      source: 'homepage',
      email: 'founder@example.com',
      state,
      error,
      submit: () => undefined,
    }),
  })
  app.config.warnHandler = () => undefined
  app.component('NuxtLink', passthrough('a'))

  return renderToString(app)
}

describe('NewsletterCapture', () => {
  test('states the affirmative purpose, frequency, privacy and unsubscribe contract', async () => {
    const html = await renderCapture('idle')

    expect(html).toContain('The weekly shipping log')
    expect(html).toContain('One concise weekly edition')
    expect(html).toMatch(/unsubscribe/i)
    expect(html).toContain('Privacy policy')
    expect(html).toContain('href="/privacy"')
    expect(html).toContain('Email address')
    expect(html).toContain('id="newsletter-homepage"')
    expect(html).toContain('data-newsletter-source="homepage"')
    expect(html).toContain('Subscribe')
    expect(source).toContain('novalidate')
    expect(source).not.toMatch(/type=["']checkbox|\bchecked\b/i)
    expect(source).not.toMatch(/checkout|payment|plan/i)
  })

  test('pins inline validation and a disabled loading state', async () => {
    const invalid = await renderCapture('error', 'Enter a valid email address.')
    const loading = await renderCapture('submitting')

    expect(invalid).toContain('Enter a valid email address.')
    expect(invalid).toContain('role="alert"')
    expect(source).toContain("'Enter a valid email address.'")
    expect(loading).toContain('Subscribing…')
    expect(loading.match(/disabled/g) ?? []).toHaveLength(2)
    expect(loading).toContain('aria-busy="true"')
  })

  test('uses one generic live success and one retryable failure', async () => {
    const success = await renderCapture('success')
    const failure = await renderCapture(
      'error',
      'Subscription is temporarily unavailable. Try again.',
    )

    expect(success).toContain('Check your inbox to confirm your subscription.')
    expect(success).toContain('role="status"')
    expect(success).toContain('aria-live="polite"')
    expect(success).not.toContain('type="email"')
    expect(failure).toContain('Subscription is temporarily unavailable. Try again.')
    expect(failure).toContain('role="alert"')
    expect(source).not.toMatch(/response\.(?:data|_data)|error\.(?:data|message)/)
  })

  test('uses Release Catalog materials without provider or storage leakage', () => {
    expect(source).toContain('border-release-seam')
    expect(source).toContain('bg-release-rail')
    expect(source).toContain('text-release-paper')
    expect(source).toContain('text-release-paper-muted')
    expect(source).toContain('release-field')
    expect(source).toContain('release-action')
    expect(source).not.toMatch(/rounded-(?:lg|xl|2xl)/)
    expect(source).not.toMatch(/brand-|gradient|backdrop-blur/i)
    expect(source).not.toMatch(
      /beehiiv|localStorage|sessionStorage|indexedDB|publication_id|api_key/i,
    )
  })
})
