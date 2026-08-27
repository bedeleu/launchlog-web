import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { compile } from '@vue/compiler-dom'
import { parse } from '@vue/compiler-sfc'
import { createSSRApp, defineComponent, h } from 'vue'
import { renderToString } from '@vue/server-renderer'

const passthrough = (tag: string) => defineComponent({
  inheritAttrs: false,
  setup: (_props, { attrs, slots }) => () => h(tag, attrs, slots.default?.() ?? []),
})

const renderPage = async (relativePath: string, setup: Record<string, unknown>) => {
  const filename = fileURLToPath(new URL(relativePath, import.meta.url))
  const source = readFileSync(filename, 'utf8')
  const template = parse(source).descriptor.template?.content
  if (!template) throw new Error(`${relativePath} template is missing`)

  const render = new Function('Vue', compile(template, { mode: 'function' }).code)(await import('vue'))
  const app = createSSRApp({ render, setup: () => setup })
  app.config.warnHandler = () => undefined
  app.component('Button', passthrough('div'))
  app.component('NuxtLink', passthrough('a'))
  app.component('FileText', passthrough('span'))
  app.component('ListChecks', passthrough('span'))
  app.component('FilePlus2', passthrough('span'))
  app.component('ScanLine', passthrough('span'))
  app.component('AdminListingForm', passthrough('form'))
  app.component('IntakePreviewForm', passthrough('form'))
  return renderToString(app)
}

describe('admin listing entry points', () => {
  test('starts a new listing from the URL scanner on the admin dashboard', async () => {
    const html = await renderPage('./admin/index.vue', {
      loading: false,
      error: null,
      data: {
        coverage: { screenshot_percent: 100 },
        totals: { founding_missing_screenshots: 0, missing_screenshots: 0 },
        recent_listings: [],
      },
      kpis: [],
      lastBatchSummary: null,
      screenshotBusy: false,
      screenshotLimitNotice: null,
      screenshotMessage: null,
      screenshotStatus: null,
      sourceRows: [],
      statusRows: [],
      tierRows: [],
      numberFormat: new Intl.NumberFormat('en-US'),
      listingStatusClass: () => '',
      loadDashboard: () => undefined,
      refreshScreenshotStatus: () => undefined,
      startScreenshotBatch: () => undefined,
    })

    expect(html).toContain('to="/submit"')
    expect(html).toContain('Scan website')
    expect(html).not.toContain('to="/admin/listings/new"')
  })

  test('uses URL scanning as the only create action on the listings page', async () => {
    const html = await renderPage('./admin/listings/index.vue', {
      actionBusy: {},
      actionErrors: {},
      error: null,
      filters: { status: '', tier: '', source: '', q: '' },
      listings: [],
      loading: false,
      pagination: null,
      screenshotBusy: false,
      screenshotMessage: null,
      screenshotStatus: null,
      statusClass: {},
      load: () => undefined,
      act: () => undefined,
      refreshScreenshotStatus: () => undefined,
      startScreenshotBatch: () => undefined,
    })

    expect(html).toContain('to="/submit"')
    expect(html).toContain('Add by URL')
    expect(html).not.toContain('to="/admin/listings/new"')
    expect(html).not.toContain('Manual entry')
    expect(html).not.toContain('AI enrichment review queue')
    expect(html).not.toContain('Create AI dry run')
  })

  test('renders the standard URL onboarding on the legacy admin create route', async () => {
    const html = await renderPage('./admin/listings/new.vue', {
      error: null,
      submitting: false,
      onSubmit: () => undefined,
    })

    expect(html).toContain('Add a listing')
    expect(html).toContain('Drop the website URL and review the generated preview.')
    expect(html).toContain('<form></form>')
    expect(html).not.toContain('Advanced manual entry')
    expect(html).not.toContain('submit-label="Create listing"')
  })

  test('loads the category taxonomy for the simplified edit form', () => {
    const source = readFileSync(fileURLToPath(new URL('./admin/listings/[id].vue', import.meta.url)), 'utf8')

    expect(source).toContain('categories()')
    expect(source).toContain(':categories="categoryOptions"')
  })

  test('keeps AI approval to one explicit save and separates manual edits', () => {
    const page = readFileSync(fileURLToPath(new URL('./admin/listings/[id].vue', import.meta.url)), 'utf8')
    const review = readFileSync(fileURLToPath(new URL('../components/Ai/ProposalReview.vue', import.meta.url)), 'utf8')

    expect(page).toContain('listAdminProposals')
    expect(page).toContain("'AI changes applied. The public listing is updated.'")
    expect(page).toContain('submit-label="Save manual edits"')
    expect(review).toContain("return 'Apply & save selected changes'")
  })
})
