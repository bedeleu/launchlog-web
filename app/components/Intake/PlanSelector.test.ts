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

const renderSelector = (adminMode: boolean) => {
  const app = createSSRApp({
    render,
    setup: () => ({
      adminMode,
      disabled: false,
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
})
