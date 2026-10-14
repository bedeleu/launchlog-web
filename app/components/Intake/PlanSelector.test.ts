import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { compile } from '@vue/compiler-dom'
import { parse } from '@vue/compiler-sfc'
import { createSSRApp, defineComponent, h } from 'vue'
import { renderToString } from '@vue/server-renderer'

const source = readFileSync(fileURLToPath(new URL('./PlanSelector.vue', import.meta.url)), 'utf8')
const template = parse(source).descriptor.template?.content
if (!template) throw new Error('PlanSelector template is missing')

const render = new Function('Vue', compile(template, { mode: 'function' }).code)(await import('vue'))
const plans = [
  {
    tier: 'basic',
    name: 'Standard',
    badge: null,
    highlight: false,
    monthlyLabel: '$2.08',
    priceLabel: '$24.99',
    features: ['Public directory placement'],
  },
  {
    tier: 'featured',
    name: 'Featured',
    badge: 'Priority placement',
    highlight: true,
    monthlyLabel: '$8.25',
    priceLabel: '$99',
    features: ['Featured directory placement'],
  },
]

const renderSelector = (adminMode: boolean, options: { compact?: boolean, disabled?: boolean } = {}) => {
  const app = createSSRApp({
    render,
    setup: () => ({
      adminMode,
      compact: options.compact ?? false,
      disabled: options.disabled ?? false,
      modelValue: 'featured',
      plans,
      emit: () => undefined,
    }),
  })
  app.config.warnHandler = () => undefined
  app.component('Check', defineComponent({ render: () => h('span') }))
  return renderToString(app)
}

describe('PlanSelector admin presentation', () => {
  test('replaces checkout prices with an explicit manual-placement label for admins', async () => {
    const html = await renderSelector(true)

    expect(html).toContain('Manual placement')
    expect(html).toContain('No Stripe subscription')
    expect(html).not.toContain('$2.08')
    expect(html).not.toContain('$8.25')
    expect(html).not.toContain('billed yearly')
  })

  test('keeps public checkout pricing for normal buyers', async () => {
    const html = await renderSelector(false)

    expect(html).toContain('$8.25')
    expect(html).toContain('$99 billed yearly')
    expect(html).not.toContain('No Stripe subscription')
  })

  test('shows both annual offers in the compact preview selector with one selected plan', async () => {
    const html = await renderSelector(false, { compact: true })
    const buttons = [...html.matchAll(/(<button\b[^>]*>)([\s\S]*?)<\/button>/g)]

    expect(buttons).toHaveLength(2)
    expect(buttons[0]?.[2]).toContain('Standard')
    expect(buttons[0]?.[2]).toContain('$24.99')
    expect(buttons[0]?.[2]).toContain('/ year')
    expect(buttons[0]?.[1]).toContain('aria-pressed="false"')
    expect(buttons[1]?.[2]).toContain('Featured')
    expect(buttons[1]?.[2]).toContain('$99')
    expect(buttons[1]?.[2]).toContain('/ year')
    expect(buttons[1]?.[1]).toContain('aria-pressed="true"')
    expect(html).not.toContain('/mo')
    expect(html).not.toContain('billed yearly')
  })

  test('retains offer information while both choices are disabled for access or checkout recovery', async () => {
    const html = await renderSelector(false, { compact: true, disabled: true })
    const buttons = [...html.matchAll(/<button\b[^>]*>/g)].map(match => match[0])

    expect(buttons).toHaveLength(2)
    for (const button of buttons) expect(button).toMatch(/\sdisabled(?:=|\s|>)/)
    expect(html).toContain('$24.99')
    expect(html).toContain('$99')
  })

  test('lets admins inspect the same compact offer while identifying manual publishing', async () => {
    const html = await renderSelector(true, { compact: true })

    expect(html).toContain('$24.99')
    expect(html).toContain('$99')
    expect(html.match(/Admin · no checkout/g) ?? []).toHaveLength(2)
    expect(html).not.toContain('billed yearly')
  })
})
