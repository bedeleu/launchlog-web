import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { compile } from '@vue/compiler-dom'
import { parse } from '@vue/compiler-sfc'
import { createSSRApp, defineComponent, h } from 'vue'
import { renderToString } from '@vue/server-renderer'

const source = readFileSync(fileURLToPath(new URL('./PreviewForm.vue', import.meta.url)), 'utf8')
const template = parse(source).descriptor.template?.content
if (!template) throw new Error('PreviewForm template is missing')

// compiler-dom's function mode does not strip the SFC's TypeScript non-null
// assertion. Removing only that type syntax leaves the runtime template intact.
const runtimeTemplate = template.replaceAll('!.token', '.token').replaceAll('!.domain', '.domain')
const render = new Function('Vue', compile(runtimeTemplate, { mode: 'function' }).code)(await import('vue'))
const passthrough = (tag: string) => defineComponent({
  inheritAttrs: false,
  setup: (_props, { attrs, slots }) => () => h(tag, attrs, slots.default?.() ?? []),
})

const renderForm = async (
  existingListing: Record<string, unknown> | null,
  submitting = false,
) => {
  const draft = { token: 'p'.repeat(64), domain: 'maker.example' }
  const app = createSSRApp({
    render,
    setup: () => ({
      existingListing,
      claimPath: '/contact?topic=listing_claim',
      known: draft,
      intake: { latestDraft: draft },
      errors: {},
      serverError: null,
      submitting,
      url: 'https://maker.example',
      urlAttrs: {},
      onSubmit: () => undefined,
    }),
  })
  // The template-only harness intentionally omits Nuxt's auto-import proxy.
  // Suppress only those harness warnings; rendering and assertions stay real.
  app.config.warnHandler = () => undefined
  app.component('Input', passthrough('input'))
  app.component('Button', passthrough('button'))
  app.component('FieldMessage', passthrough('p'))
  app.component('AppSpinner', passthrough('span'))
  app.component('NuxtLink', passthrough('a'))
  return renderToString(app)
}

describe('PreviewForm existing-listing state', () => {
  test('does not offer a stale local preview after the API reports a represented domain', async () => {
    const html = await renderForm({
      action: 'claim',
      domain: 'maker.example',
      listing_path: '/listing/maker-example',
      dashboard_path: null,
    })

    expect(html).toContain('Already on LaunchLog')
    expect(html).toContain('View it')
    expect(html).toContain('to="/listing/maker-example"')
    expect(html).not.toContain('Already generated a preview?')
    expect(html).not.toContain(`preview/${'p'.repeat(64)}`)
  })

  test('keeps the primary CTA width stable while checking the website', async () => {
    const [idle, loading] = await Promise.all([
      renderForm(null),
      renderForm(null, true),
    ])

    expect(idle).toContain('Preview my listing')
    expect(loading).toContain('Checking website…')
    expect(idle).toContain('w-full')
    expect(idle).toContain('sm:w-48')
    expect(loading).toContain('w-full')
    expect(loading).toContain('sm:w-48')
  })
})
