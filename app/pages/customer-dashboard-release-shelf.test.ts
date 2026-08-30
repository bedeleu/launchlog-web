import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { compile } from '@vue/compiler-dom'
import { parse } from '@vue/compiler-sfc'
import { createSSRApp, defineComponent, h } from 'vue'
import { renderToString } from '@vue/server-renderer'

const source = readFileSync(fileURLToPath(new URL('./dashboard.vue', import.meta.url)), 'utf8')
const proofArtifactSource = readFileSync(fileURLToPath(new URL('../components/Listing/ListingReceiptArtifact.vue', import.meta.url)), 'utf8')
const template = parse(source).descriptor.template?.content
if (!template) throw new Error('Dashboard template is missing')

const runtimeTemplate = template.replaceAll(']!', ']')
const render = new Function('Vue', compile(runtimeTemplate, { mode: 'function' }).code)(await import('vue'))
const passthrough = (tag: string) => defineComponent({
  inheritAttrs: false,
  setup: (_props, { attrs, slots }) => () => h(tag, attrs, slots.default?.() ?? []),
})
const slottedPanel = defineComponent({
  inheritAttrs: false,
  setup: (_props, { attrs, slots }) => () => h('section', attrs, [slots.default?.(), slots.footer?.()]),
})

const listing = {
  id: 'release-1',
  slug: 'launch-atlas',
  name: 'Launch Atlas',
  tagline: 'A clean map of new releases.',
  description: 'Follow what independent teams shipped.',
  url: 'https://launch-atlas.example',
  screenshot_url: null,
  status: 'published',
  tier: 'featured',
  published_at: '2026-08-20T00:00:00Z',
  expires_at: null,
  subscription: {
    status: 'active',
    tier: 'featured',
    current_period_start: '2026-08-26T00:00:00Z',
    current_period_end: '2027-08-26T00:00:00Z',
    canceled_at: null,
  },
  receipt: {
    public_url: 'https://launchlog.ai/listing/launch-atlas',
    markdown_url: 'https://launchlog.ai/listing/launch-atlas.md',
    sitemap_url: 'https://launchlog.ai/sitemap.xml',
    llms_url: 'https://launchlog.ai/llms.txt',
    checks: { published: true, schema: true, markdown: true, llms: true },
  },
}

const quota = {
  eligible: true,
  used: 2,
  limit: 5,
  remaining: 3,
  period_start: '2026-08-26T00:00:00Z',
  period_end: '2027-08-26T00:00:00Z',
}

const proposal = {
  id: 'proposal-1',
  listing_id: listing.id,
  status: 'pending',
  current: { name: listing.name },
  proposed: { name: 'Launch Atlas Pro' },
  category: { slug: 'launch-tools', name: 'Launch tools', requires_approval: false },
  evidence: {},
  model: 'grounded-model',
  applied_fields: [],
  created_at: '2026-08-30T00:00:00Z',
}

const renderDashboard = async ({
  aiState,
  currentQuota = null,
  currentProposal = null,
  aiError = null,
}: {
  aiState: 'loading' | 'ready' | 'error'
  currentQuota?: typeof quota | null
  currentProposal?: typeof proposal | null
  aiError?: string | null
}) => {
  const formatDate = (value: string | null | undefined) => value
    ? new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value))
    : 'Not scheduled'
  const app = createSSRApp({
    render,
    setup: () => ({
      loading: false,
      error: null,
      authReady: true,
      user: { email: 'maker@example.com' },
      signingOut: false,
      listings: [listing],
      drafts: { [listing.id]: { name: listing.name, tagline: listing.tagline, description: listing.description } },
      actionErrors: {},
      savingIds: new Set<string>(),
      billingIds: new Set<string>(),
      savedIds: new Set<string>(),
      aiBusyIds: new Set<string>(),
      aiLoadStates: { [listing.id]: aiState },
      aiLoadErrors: { [listing.id]: aiError },
      aiQuotas: { [listing.id]: currentQuota },
      aiProposals: { [listing.id]: currentProposal },
      statusLabels: { published: 'Published' },
      statusState: () => 'success',
      domainOf: () => 'launch-atlas.example',
      formatDate,
      tierLabel: () => 'Featured',
      aiQuotaSummary: (value: typeof quota) => `${value.used} used · ${value.remaining} of ${value.limit} left until ${formatDate(value.period_end)}.`,
      receiptProofDestinations: () => [],
      receiptUnavailableLabel: () => '',
      isDirty: () => false,
      signOut: () => undefined,
      loadListings: () => undefined,
      save: () => undefined,
      clearSaved: () => undefined,
      retryAiState: () => undefined,
      generateAiDraft: () => undefined,
      applyAiDraft: () => undefined,
      rejectAiDraft: () => undefined,
      manageBilling: () => undefined,
    }),
  })
  app.config.warnHandler = () => undefined
  app.component('ReleaseShell', slottedPanel)
  app.component('ReleaseActionRail', slottedPanel)
  app.component('ReleaseStateMarker', passthrough('div'))
  app.component('ListingReceiptArtifact', passthrough('div'))
  app.component('AiProposalReview', defineComponent({ render: () => h('div', 'Proposal review panel') }))
  app.component('Button', passthrough('button'))
  app.component('Input', passthrough('input'))
  app.component('Label', passthrough('label'))
  app.component('NuxtLink', passthrough('a'))
  app.component('AppSpinner', passthrough('span'))
  for (const icon of ['ArrowUpRight', 'CreditCard', 'FileDiff', 'LogOut', 'Save']) app.component(icon, passthrough('span'))
  return renderToString(app)
}

describe('customer release shelf', () => {
  test('uses the established Release Catalog shell and proof ledger', () => {
    expect(source).toContain('<ReleaseShell')
    expect(source).toContain('<ListingReceiptArtifact')
    expect(source).toContain('receiptProofDestinations')
    expect(source).toContain('data-customer-release')
  })

  test('keeps account, status, edition, billing, editable copy, and proof in one release record', () => {
    expect(source).toContain('Account holder')
    expect(source).toContain('Publication state')
    expect(source).toContain('Catalog edition')
    expect(source).toContain('Billing record')
    expect(source).toContain('Public copy')
    expect(source).toContain('Published proof')
  })

  test('does not regress to the retired violet card language', () => {
    expect(source).not.toMatch(/indigo|violet|purple|bg-gradient|backdrop-blur/)
    expect(source).not.toContain('rounded-xl')
    expect(source).not.toContain('rounded-full')
  })

  test('keeps every proof address readable inside the narrow dashboard ledger', () => {
    expect(proofArtifactSource).not.toContain('sm:flex-row')
    expect(proofArtifactSource).not.toContain('sm:text-right')
    expect(proofArtifactSource).toContain('w-full max-w-full break-all')
  })

  test('keeps account and new-release actions above the shelf below desktop width', () => {
    expect(source).toContain('data-mobile-account-actions')
    expect(source).toContain('class="mb-6 border border-release-seam bg-release-rail p-4 xl:hidden"')
    expect(source.indexOf('data-mobile-account-actions')).toBeLessThan(source.indexOf('v-if="loading"'))
    expect(source).toContain('class="hidden xl:block"')
  })

  test('renders stable loading, empty, load-error, save-error, and billing-error states', () => {
    expect(source).toContain('Loading release shelf')
    expect(source).toContain('No releases recorded')
    expect(source).toContain('Release shelf unavailable')
    expect(source).toContain('Saving changes')
    expect(source).toContain('Billing could not be opened.')
  })

  test('renders the listing while its AI allowance is still loading', async () => {
    const html = await renderDashboard({ aiState: 'loading' })

    expect(html).toContain('Launch Atlas')
    expect(html).toContain('Checking AI allowance…')
    expect(html).not.toContain('Loading release shelf')
  })

  test('renders an isolated quota error with a retry without hiding manual editing', async () => {
    const html = await renderDashboard({ aiState: 'error', aiError: 'Allowance service timed out.' })

    expect(html).toContain('Launch Atlas')
    expect(html).toContain('AI allowance unavailable')
    expect(html).toContain('Allowance service timed out.')
    expect(html).toContain('Retry AI allowance')
    expect(html).toContain('Save details')
  })

  test('shows quota usage, remaining allowance, and period end in the ready state', async () => {
    const html = await renderDashboard({ aiState: 'ready', currentQuota: quota })

    expect(html).toContain('Improve with AI')
    expect(html).toContain('2 used · 3 of 5 left until Aug 26, 2027.')
  })

  test('turns an existing proposal into status plus its real review panel, not a no-op button', async () => {
    const html = await renderDashboard({ aiState: 'ready', currentQuota: quota, currentProposal: proposal })

    expect(html).toContain('AI draft ready for review')
    expect(html).toContain('Proposal review panel')
    expect(html).not.toContain('Review AI draft')
    expect(html).not.toContain('Improve with AI')
  })

  test('disables generation at zero while keeping manual editing available', async () => {
    const html = await renderDashboard({
      aiState: 'ready',
      currentQuota: { ...quota, used: 5, remaining: 0 },
    })

    expect(html).toMatch(/<button[^>]*disabled[^>]*>.*AI limit reached.*<\/button>/s)
    expect(html).toContain('5 used · 0 of 5 left until Aug 26, 2027.')
    expect(html).toContain('Manual editing stays available.')
    expect(html).toContain('Save details')
  })
})
