import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { compile } from '@vue/compiler-dom'
import { parse } from '@vue/compiler-sfc'
import { createSSRApp, defineComponent, h } from 'vue'
import { renderToString } from '@vue/server-renderer'

const source = readFileSync(fileURLToPath(new URL('./OutreachHistory.vue', import.meta.url)), 'utf8')
const descriptor = parse(source).descriptor
const template = descriptor.template?.content
if (!template) throw new Error('OutreachHistory template is missing')

const render = new Function('Vue', compile(template, { mode: 'function' }).code)(await import('vue'))
const passthrough = (tag: string) => defineComponent({
  inheritAttrs: false,
  setup: (_props, { attrs, slots }) => () => h(tag, attrs, slots.default?.() ?? []),
})

const sendId = 'f642097d-9070-4e00-b2e7-00f0e0e4ea6a'
const previewUrl = `https://launchlog.ai/preview/${'A'.repeat(64)}`
const body = 'Hi Maya,\n\nFirst line.\nSecond line.'
const send = {
  id: sendId,
  request_id: '8adf6d21-2bc6-4c96-8dd6-e17f83956275',
  recipient_email: 'founder@example.com',
  first_name: 'Maya',
  product_name: 'ShipFast',
  source_name: 'Product Hunt',
  subject_variant: 'preview',
  subject: 'I made a private LaunchLog preview for ShipFast',
  text: body,
  preview_url: previewUrl,
  from_address: 'alex@launchlog.ai',
  from_name: 'Alex from LaunchLog',
  reply_to_address: 'reply@launchlog.ai',
  delivery_channel: 'resend',
  provider_email_id: 'email_outreach_1',
  status: 'accepted',
  accepted_at: '2026-08-30T12:00:00Z',
  provider_event_at: '2026-08-30T12:00:02Z',
  last_synced_at: '2026-08-30T12:00:03Z',
  diagnostic_code: 'provider_refresh_failed',
  created_at: '2026-08-30T11:59:59Z',
  updated_at: '2026-08-30T12:00:03Z',
} as const

const meta = {
  current_page: 1,
  from: 1,
  last_page: 1,
  per_page: 20,
  to: 1,
  total: 1,
}

interface RenderOverrides {
  rows?: Array<Record<string, unknown>>
  loading?: boolean
  error?: string | null
  silentRefreshing?: boolean
  refreshingId?: string | null
  refreshError?: string | null
  openRows?: Set<string>
  pageMeta?: typeof meta
}

const renderHistory = (overrides: RenderOverrides = {}) => {
  const app = createSSRApp({
    render,
    setup: () => ({
      rows: overrides.rows ?? [send],
      loading: overrides.loading ?? false,
      error: overrides.error ?? null,
      silentRefreshing: overrides.silentRefreshing ?? false,
      refreshingId: overrides.refreshingId ?? null,
      refreshError: overrides.refreshError ?? null,
      openRows: overrides.openRows ?? new Set<string>(),
      meta: overrides.pageMeta ?? meta,
      currentPage: overrides.pageMeta?.current_page ?? meta.current_page,
      statusPresentation: (status: string) => ({
        label: status === 'accepted' ? 'Accepted' : status === 'delivered' ? 'Delivered' : status,
        help: status === 'accepted'
          ? 'Accepted by Resend for delivery.'
          : status === 'delivered'
            ? 'The recipient server accepted the email. Inbox placement is not guaranteed.'
            : 'Delivery status reported by the provider.',
        tone: status === 'delivered' ? 'signal' : 'neutral',
      }),
      formatDate: () => '30 Aug 2026, 14:00',
      formatTimestamp: (value: string | null) => value ?? '—',
      safeDiagnosticCode: (value: string | null) => value,
      isRowOpen: (id: string) => (overrides.openRows ?? new Set<string>()).has(id),
      toggleDetails: () => undefined,
      load: () => undefined,
      goToPage: () => undefined,
      refreshRow: () => undefined,
    }),
  })
  app.config.warnHandler = () => undefined
  app.component('Button', passthrough('button'))
  app.component('AppSpinner', passthrough('span'))
  return renderToString(app)
}

const loadModuleHelpers = () => {
  const script = descriptor.script?.content
  if (!script) throw new Error('OutreachHistory module helpers are missing')
  const transpiled = new Bun.Transpiler({ loader: 'ts' }).transformSync(script)
  const executable = transpiled.replaceAll('export function ', 'function ')
  return new Function(`${executable}\nreturn { startOutreachHistoryRefresh, showLatestOutreachPage }`)() as {
    startOutreachHistoryRefresh: (options: Record<string, unknown>) => () => void
    showLatestOutreachPage: (
      setPage: (page: number) => void,
      load: (page: number, silent: boolean) => Promise<void>,
    ) => Promise<void>
  }
}

describe('outreach delivery ledger', () => {
  test('renders explicit Release loading, empty, error, and retry states', async () => {
    const [loading, empty, error] = await Promise.all([
      renderHistory({ rows: [], loading: true }),
      renderHistory({ rows: [] }),
      renderHistory({ rows: [], error: 'Delivery history could not be loaded.' }),
    ])

    expect(loading).toContain('Loading delivery ledger')
    expect(loading).toContain('aria-busy="true"')
    expect(empty).toContain('No outreach deliveries yet')
    expect(error).toContain('role="alert"')
    expect(error).toContain('Delivery history could not be loaded.')
    expect(error).toContain('Retry')
    expect(`${loading}${empty}${error}`).toContain('border-release-seam')
    expect(`${loading}${empty}${error}`).toContain('bg-release-rail')
  })

  test('labels accepted truthfully and explains delivered without promising inbox placement', async () => {
    const accepted = await renderHistory()
    const delivered = await renderHistory({ rows: [{ ...send, status: 'delivered' }] })

    expect(accepted).toContain('>Accepted<')
    expect(accepted).toContain('Accepted by Resend for delivery.')
    expect(accepted).not.toContain('>Sent<')
    expect(delivered).toContain('The recipient server accepted the email.')
    expect(delivered).toContain('Inbox placement is not guaranteed.')
  })

  test('renders the expanded audit rail with exact text and a direct untracked preview', async () => {
    const html = await renderHistory({ openRows: new Set([sendId]) })

    expect(html).toContain('aria-expanded="true"')
    expect(html).toContain('From')
    expect(html).toContain('Alex from LaunchLog &lt;alex@launchlog.ai&gt;')
    expect(html).toContain('Reply-To')
    expect(html).toContain('reply@launchlog.ai')
    expect(html).toContain('Delivery channel')
    expect(html).toContain('Subject variant')
    expect(html).toContain(body)
    expect(html).toContain('whitespace-pre-wrap')
    expect(html).toContain(`href="${previewUrl}"`)
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain(send.request_id)
    expect(html).toContain(send.provider_email_id)
    expect(html).toContain(send.accepted_at)
    expect(html).toContain(send.provider_event_at)
    expect(html).toContain(send.last_synced_at)
    expect(html).toContain(send.created_at)
    expect(html).toContain('provider_refresh_failed')
    expect(html).not.toMatch(/bit\.ly|utm_|tracking/i)
  })

  test('uses bounded pagination and a row-specific project-styled refresh action', async () => {
    const pageTwo = await renderHistory({
      pageMeta: { ...meta, current_page: 2, last_page: 3, total: 41, from: 21, to: 40 },
      refreshingId: sendId,
    })
    const firstPage = await renderHistory()

    expect(pageTwo).toContain('aria-label="Previous outreach history page"')
    expect(pageTwo).toContain('aria-label="Next outreach history page"')
    expect(pageTwo).toContain(`aria-label="Refresh delivery status for ShipFast to founder@example.com"`)
    expect(pageTwo).toContain('Refreshing delivery status for ShipFast')
    expect(pageTwo).toContain('focus-visible:ring-release-focus')
    expect(pageTwo).toContain('disabled')
    expect(firstPage).toMatch(/aria-label="Previous outreach history page"[^>]*disabled/)
    expect(firstPage).toMatch(/aria-label="Next outreach history page"[^>]*disabled/)
  })

  test('keeps the visual system industrial, flat, and explicit across interaction states', async () => {
    const html = await renderHistory({ openRows: new Set([sendId]), silentRefreshing: true })

    expect(html).toContain('font-mono')
    expect(html).toContain('border-release-blaze')
    expect(html).toContain('hover:border-release-blaze')
    expect(html).toContain('active:bg-release-ink')
    expect(html).toContain('Refreshing…')
    expect(source).not.toMatch(/gradient|backdrop-blur|rounded-(?:lg|xl|2xl)|shadow-(?:lg|xl|2xl)/)
  })

  test('pauses the single timer while hidden, refreshes once on return, and cleans up', async () => {
    const { startOutreachHistoryRefresh } = loadModuleHelpers()
    let visible = true
    let intervalCallback: (() => void) | undefined
    let visibilityCallback: (() => void) | undefined
    let refreshes = 0
    const cleared: unknown[] = []

    const stop = startOutreachHistoryRefresh({
      isVisible: () => visible,
      refresh: async () => { refreshes += 1 },
      setInterval: (callback: () => void, milliseconds: number) => {
        expect(milliseconds).toBe(10_000)
        intervalCallback = callback
        return 17
      },
      clearInterval: (id: unknown) => { cleared.push(id) },
      addVisibilityListener: (callback: () => void) => { visibilityCallback = callback },
      removeVisibilityListener: (callback: () => void) => {
        expect(callback).toBe(visibilityCallback)
        visibilityCallback = undefined
      },
    })

    expect(intervalCallback).toBeDefined()
    expect(visibilityCallback).toBeDefined()
    intervalCallback?.()
    expect(refreshes).toBe(1)

    visible = false
    visibilityCallback?.()
    intervalCallback?.()
    expect(refreshes).toBe(1)

    visible = true
    visibilityCallback?.()
    expect(refreshes).toBe(2)
    visibilityCallback?.()
    expect(refreshes).toBe(2)

    stop()
    expect(cleared).toEqual([17])
    expect(visibilityCallback).toBeUndefined()
  })

  test('exposes showLatest semantics that switch to page one before loading it', async () => {
    const { showLatestOutreachPage } = loadModuleHelpers()
    const events: string[] = []

    await showLatestOutreachPage(
      page => { events.push(`page:${page}`) },
      async (page, silent) => { events.push(`load:${page}:${silent}`) },
    )

    expect(events).toEqual(['page:1', 'load:1:true'])
    expect(source).toContain('defineExpose({ showLatest })')
  })
})
