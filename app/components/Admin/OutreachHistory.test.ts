import { afterEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { compile } from '@vue/compiler-dom'
import { compileScript, parse } from '@vue/compiler-sfc'
import {
  createRenderer,
  createSSRApp,
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
} from 'vue'
import * as VueRuntime from 'vue'
import { renderToString } from '@vue/server-renderer'
import { parseIsoOffsetToMicroseconds } from '../../composables/useOutreachSend'
import type { OutreachEmailSend } from '~/composables/useOutreachSend'
import type { OutreachEmailSendPage } from '~/composables/useOutreachHistory'

const source = readFileSync(fileURLToPath(new URL('./OutreachHistory.vue', import.meta.url)), 'utf8')
const descriptor = parse(source).descriptor
const template = descriptor.template?.content
if (!template) throw new Error('OutreachHistory template is missing')

const compiledSfcScript = compileScript(descriptor, {
  id: 'outreach-history-test',
})
const transpiledScript = new Bun.Transpiler({ loader: 'ts' }).transformSync(compiledSfcScript.content)
const executableScript = transpiledScript
  .replace(/import\s*{([^}]+)}\s*from\s*["']vue["'];?/g, (_statement, bindings: string) => (
    `const { ${bindings.replaceAll(' as ', ': ')} } = VueRuntime;`
  ))
  .replace(/import\s*{\s*parseIsoOffsetToMicroseconds\s*}\s*from\s*["']~\/composables\/useOutreachSend["'];?/g, '')
  .replace('export default', 'return')
const render = new Function('Vue', compile(template, {
  mode: 'function',
  prefixIdentifiers: true,
  bindingMetadata: compiledSfcScript.bindings,
}).code)(await import('vue'))
const OutreachHistory = new Function(
  'VueRuntime',
  'parseIsoOffsetToMicroseconds',
  executableScript,
)(VueRuntime, parseIsoOffsetToMicroseconds)
OutreachHistory.render = render
const passthrough = (tag: string) => defineComponent({
  inheritAttrs: false,
  setup: (_props, { attrs, slots }) => () => h(tag, attrs, slots.default?.() ?? []),
})

interface TestNode {
  type: string
  props: Record<string, unknown>
  children: TestNode[]
  parent: TestNode | null
  text: string
}

const createTestNode = (type: string, text = ''): TestNode => ({
  type,
  props: {},
  children: [],
  parent: null,
  text,
})

const mountedRenderer = createRenderer<TestNode, TestNode>({
  patchProp: (node, key, _previous, value) => {
    if (value === null || value === undefined) Reflect.deleteProperty(node.props, key)
    else node.props[key] = value
  },
  insert: (child, parent, anchor) => {
    const previousIndex = parent.children.indexOf(child)
    if (previousIndex >= 0) parent.children.splice(previousIndex, 1)
    child.parent = parent
    const anchorIndex = anchor ? parent.children.indexOf(anchor) : -1
    if (anchorIndex >= 0) parent.children.splice(anchorIndex, 0, child)
    else parent.children.push(child)
  },
  remove: (child) => {
    if (!child.parent) return
    const index = child.parent.children.indexOf(child)
    if (index >= 0) child.parent.children.splice(index, 1)
    child.parent = null
  },
  createElement: type => createTestNode(type),
  createText: text => createTestNode('#text', text),
  createComment: text => createTestNode('#comment', text),
  setText: (node, text) => { node.text = text },
  setElementText: (node, text) => {
    node.text = text
    node.children = []
  },
  parentNode: node => node.parent,
  nextSibling: (node) => {
    if (!node.parent) return null
    const index = node.parent.children.indexOf(node)
    return node.parent.children[index + 1] ?? null
  },
  querySelector: () => null,
  setScopeId: () => undefined,
  cloneNode: node => ({
    ...node,
    props: { ...node.props },
    children: [...node.children],
    parent: null,
  }),
  insertStaticContent: (content, parent, anchor) => {
    const node = createTestNode('#static', content)
    const anchorIndex = anchor ? parent.children.indexOf(anchor) : -1
    node.parent = parent
    if (anchorIndex >= 0) parent.children.splice(anchorIndex, 0, node)
    else parent.children.push(node)
    return [node, node]
  },
})

interface Deferred<Value> {
  promise: Promise<Value>
  resolve: (value: Value) => void
  reject: (reason: unknown) => void
}

const deferred = <Value>(): Deferred<Value> => {
  let resolve: (value: Value) => void = () => undefined
  let reject: (reason: unknown) => void = () => undefined
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

interface MountedHistoryApi {
  list: (page: number) => Promise<OutreachEmailSendPage>
  refresh: (id: string) => Promise<OutreachEmailSend>
}

interface MountedHistoryState {
  rows: OutreachEmailSend[]
  error: string | null
  refreshError: string | null
}

interface MountedHistoryResources {
  intervals: Map<number, () => void>
  clearedIntervals: number[]
  visibilityListeners: Set<() => void>
  removedListeners: Array<() => void>
}

interface MountedHistoryHarness {
  root: TestNode
  state: MountedHistoryState
  resources: MountedHistoryResources
  showLatest: () => Promise<void>
  unmount: () => void
}

const globals = globalThis as unknown as Record<string, unknown>
const originalGlobals = new Map<string, unknown>()
const mountedHarnesses: MountedHistoryHarness[] = []

const setTestGlobal = (key: string, value: unknown) => {
  if (!originalGlobals.has(key)) originalGlobals.set(key, globals[key])
  globals[key] = value
}

const nodeText = (node: TestNode): string => (
  `${node.text}${node.children.map(nodeText).join('')}`
)

const findNode = (node: TestNode, predicate: (candidate: TestNode) => boolean): TestNode | null => {
  if (predicate(node)) return node
  for (const child of node.children) {
    const found = findNode(child, predicate)
    if (found) return found
  }
  return null
}

const findButton = (root: TestNode, label: string): TestNode => {
  const button = findNode(root, node => node.type === 'button' && node.props['aria-label'] === label)
  if (!button) throw new Error(`Button not found: ${label}`)
  return button
}

const click = async (node: TestNode): Promise<void> => {
  const handler = node.props.onClick
  if (typeof handler !== 'function') throw new Error('Node has no click handler')
  await Promise.resolve((handler as (event: unknown) => unknown)({}))
}

const flushComponent = async (): Promise<void> => {
  await Promise.resolve()
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

const mountHistoryComponent = (api: MountedHistoryApi): MountedHistoryHarness => {
  const resources: MountedHistoryResources = {
    intervals: new Map(),
    clearedIntervals: [],
    visibilityListeners: new Set(),
    removedListeners: [],
  }
  let nextIntervalId = 1
  const pageDocument = {
    visibilityState: 'visible',
    addEventListener: (type: string, listener: () => void) => {
      if (type === 'visibilitychange') resources.visibilityListeners.add(listener)
    },
    removeEventListener: (type: string, listener: () => void) => {
      if (type !== 'visibilitychange') return
      resources.visibilityListeners.delete(listener)
      resources.removedListeners.push(listener)
    },
  }

  setTestGlobal('ref', ref)
  setTestGlobal('onMounted', onMounted)
  setTestGlobal('onBeforeUnmount', onBeforeUnmount)
  setTestGlobal('useOutreachHistory', () => api)
  setTestGlobal('document', pageDocument)
  setTestGlobal('setInterval', (callback: () => void, _milliseconds: number) => {
    const id = nextIntervalId++
    resources.intervals.set(id, callback)
    return id
  })
  setTestGlobal('clearInterval', (id: number) => {
    resources.intervals.delete(id)
    resources.clearedIntervals.push(id)
  })

  const root = createTestNode('root')
  const app = mountedRenderer.createApp(OutreachHistory)
  app.config.warnHandler = () => undefined
  app.component('Button', passthrough('button'))
  app.component('AppSpinner', passthrough('span'))
  const instance = app.mount(root) as unknown as { showLatest: () => Promise<void> }
  const internalInstance = (app as unknown as {
    _instance: { setupState: MountedHistoryState }
  })._instance
  let unmounted = false
  const harness: MountedHistoryHarness = {
    root,
    state: internalInstance.setupState,
    resources,
    showLatest: instance.showLatest,
    unmount: () => {
      if (unmounted) return
      unmounted = true
      app.unmount()
    },
  }
  mountedHarnesses.push(harness)
  return harness
}

afterEach(() => {
  for (const harness of mountedHarnesses.splice(0)) harness.unmount()
  for (const [key, value] of originalGlobals) {
    if (value === undefined) Reflect.deleteProperty(globals, key)
    else globals[key] = value
  }
  originalGlobals.clear()
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
} satisfies OutreachEmailSend

const meta = {
  current_page: 1,
  from: 1,
  last_page: 1,
  per_page: 20,
  to: 1,
  total: 1,
}

const sendWith = (overrides: Partial<OutreachEmailSend>): OutreachEmailSend => ({
  ...send,
  ...overrides,
})

const pageFor = (rows: OutreachEmailSend[]): OutreachEmailSendPage => ({
  data: rows,
  links: {
    first: 'https://api.launchlog.test/api/v1/admin/outreach/sends?page=1',
    last: 'https://api.launchlog.test/api/v1/admin/outreach/sends?page=1',
    prev: null,
    next: null,
  },
  meta: {
    current_page: 1,
    from: rows.length > 0 ? 1 : null,
    last_page: 1,
    per_page: 20,
    to: rows.length > 0 ? rows.length : null,
    total: rows.length,
  },
})

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
      isRowRefreshing: (id: string) => id === (overrides.refreshingId ?? null),
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
  const executable = transpiled
    .replace(/import\s*{\s*parseIsoOffsetToMicroseconds\s*}\s*from\s*["']~\/composables\/useOutreachSend["'];?/g, '')
    .replaceAll('export function ', 'function ')
  return new Function(`${executable}\nreturn { startOutreachHistoryRefresh, showLatestOutreachPage }`)() as {
    startOutreachHistoryRefresh: (options: Record<string, unknown>) => () => void
    showLatestOutreachPage: (
      setPage: (page: number) => void,
      load: (page: number, silent: boolean, force?: boolean) => Promise<void>,
    ) => Promise<void>
  }
}

describe('outreach delivery ledger', () => {
  test('renders real mounted loading, empty, error, and retry states', async () => {
    const initial = deferred<OutreachEmailSendPage>()
    const loading = mountHistoryComponent({
      list: () => initial.promise,
      refresh: async () => send,
    })

    await flushComponent()
    expect(nodeText(loading.root)).toContain('Loading delivery ledger')

    initial.resolve(pageFor([]))
    await flushComponent()
    expect(nodeText(loading.root)).toContain('No outreach deliveries yet')
    loading.unmount()

    const failed = mountHistoryComponent({
      list: async () => { throw new Error('network unavailable') },
      refresh: async () => send,
    })
    await flushComponent()

    expect(nodeText(failed.root)).toContain('Delivery history could not be loaded.')
    expect(findButton(failed.root, 'Refresh current outreach history page')).toBeDefined()
    expect(findNode(failed.root, node => node.type === 'button' && nodeText(node).includes('Retry'))).not.toBeNull()
  })

  test('installs lifecycle resources before the initial request settles and cleans them exactly once', async () => {
    const initial = deferred<OutreachEmailSendPage>()
    const harness = mountHistoryComponent({
      list: () => initial.promise,
      refresh: async () => send,
    })
    await flushComponent()

    expect(harness.resources.intervals.size).toBe(1)
    expect(harness.resources.visibilityListeners.size).toBe(1)
    expect(harness.state.rows).toHaveLength(0)

    harness.unmount()
    expect(harness.resources.intervals.size).toBe(0)
    expect(harness.resources.visibilityListeners.size).toBe(0)
    expect(harness.resources.clearedIntervals).toHaveLength(1)
    expect(harness.resources.removedListeners).toHaveLength(1)

    initial.resolve(pageFor([sendWith({ status: 'delivered' })]))
    await flushComponent()

    expect(harness.state.rows).toHaveLength(0)
    expect(harness.resources.intervals.size).toBe(0)
    expect(harness.resources.visibilityListeners.size).toBe(0)
    expect(harness.resources.clearedIntervals).toHaveLength(1)
    expect(harness.resources.removedListeners).toHaveLength(1)
  })

  test('recovers a real initial failure through the exposed showLatest method', async () => {
    const recovery = deferred<OutreachEmailSendPage>()
    let listCalls = 0
    const harness = mountHistoryComponent({
      list: () => listCalls++ === 0
        ? Promise.reject(new Error('initial failure'))
        : recovery.promise,
      refresh: async () => send,
    })
    await flushComponent()
    expect(harness.state.error).toBe('Delivery history could not be loaded.')

    const showingLatest = harness.showLatest()
    recovery.resolve(pageFor([sendWith({ status: 'delivered' })]))
    await showingLatest
    await flushComponent()

    expect(harness.state.error).toBeNull()
    expect(harness.state.refreshError).toBeNull()
    expect(harness.state.rows[0]?.status).toBe('delivered')
    expect(nodeText(harness.root)).not.toContain('Delivery history could not be loaded.')
    expect(nodeText(harness.root)).toContain('Delivered')
  })

  test('clears a row refresh error after the next accepted page response', async () => {
    let listCalls = 0
    const harness = mountHistoryComponent({
      list: async () => {
        listCalls += 1
        return pageFor([send])
      },
      refresh: async () => { throw new Error('provider unavailable') },
    })
    await flushComponent()

    await click(findButton(harness.root, 'Refresh delivery status for ShipFast to founder@example.com'))
    await flushComponent()
    expect(harness.state.refreshError).toContain('could not be refreshed')

    await click(findButton(harness.root, 'Refresh current outreach history page'))
    await flushComponent()
    expect(listCalls).toBe(2)
    expect(harness.state.error).toBeNull()
    expect(harness.state.refreshError).toBeNull()
  })

  test('does not let a late page response regress a fresher manual row result', async () => {
    const pageRequest = deferred<OutreachEmailSendPage>()
    const rowRequest = deferred<OutreachEmailSend>()
    const sameTimes = {
      updated_at: '2026-08-30T12:10:00Z',
      provider_event_at: '2026-08-30T12:09:00Z',
      last_synced_at: '2026-08-30T12:10:00Z',
    }
    const stalePageRow = sendWith({ ...sameTimes, status: 'accepted' })
    const freshRow = sendWith({ ...sameTimes, status: 'delivered' })
    let listCalls = 0
    const harness = mountHistoryComponent({
      list: () => listCalls++ === 0 ? Promise.resolve(pageFor([stalePageRow])) : pageRequest.promise,
      refresh: () => rowRequest.promise,
    })
    await flushComponent()

    const loadingPage = click(findButton(harness.root, 'Refresh current outreach history page'))
    const refreshingRow = click(findButton(harness.root, 'Refresh delivery status for ShipFast to founder@example.com'))
    rowRequest.resolve(freshRow)
    await refreshingRow
    await flushComponent()
    expect(harness.state.rows[0]?.status).toBe('delivered')

    pageRequest.resolve(pageFor([stalePageRow]))
    await loadingPage
    await flushComponent()
    expect(harness.state.rows[0]?.status).toBe('delivered')
  })

  test('does not let a late manual row response regress a fresher page result', async () => {
    const pageRequest = deferred<OutreachEmailSendPage>()
    const rowRequest = deferred<OutreachEmailSend>()
    const sharedTimes = {
      updated_at: '2026-08-30T12:10:00Z',
      provider_event_at: '2026-08-30T12:09:00Z',
    }
    const staleRow = sendWith({
      ...sharedTimes,
      status: 'accepted',
      last_synced_at: '2026-08-30T12:09:30Z',
    })
    const freshPageRow = sendWith({
      ...sharedTimes,
      status: 'delivered',
      last_synced_at: '2026-08-30T12:10:00Z',
    })
    let listCalls = 0
    const harness = mountHistoryComponent({
      list: () => listCalls++ === 0 ? Promise.resolve(pageFor([staleRow])) : pageRequest.promise,
      refresh: () => rowRequest.promise,
    })
    await flushComponent()

    const refreshingRow = click(findButton(harness.root, 'Refresh delivery status for ShipFast to founder@example.com'))
    const loadingPage = click(findButton(harness.root, 'Refresh current outreach history page'))
    pageRequest.resolve(pageFor([freshPageRow]))
    await loadingPage
    await flushComponent()
    expect(harness.state.rows[0]?.status).toBe('delivered')

    rowRequest.resolve(staleRow)
    await refreshingRow
    await flushComponent()
    expect(harness.state.rows[0]?.status).toBe('delivered')
  })

  test('keeps the newer provider microsecond when an older stronger status arrives late', async () => {
    const pageRequest = deferred<OutreachEmailSendPage>()
    const rowRequest = deferred<OutreachEmailSend>()
    const sharedTimes = {
      updated_at: '2026-08-30T12:10:01+00:00',
      last_synced_at: '2026-08-30T12:10:02+00:00',
    }
    const initialRow = sendWith({
      ...sharedTimes,
      status: 'accepted',
      provider_event_at: '2026-08-30T12:10:00.000000+00:00',
    })
    const olderStrongRow = sendWith({
      ...sharedTimes,
      status: 'bounced',
      provider_event_at: '2026-08-30T13:10:00.000100+01:00',
    })
    const newerLowerPrecedenceRow = sendWith({
      ...sharedTimes,
      status: 'delivered',
      provider_event_at: '2026-08-30T12:10:00.000900+00:00',
    })
    let listCalls = 0
    const harness = mountHistoryComponent({
      list: () => listCalls++ === 0 ? Promise.resolve(pageFor([initialRow])) : pageRequest.promise,
      refresh: () => rowRequest.promise,
    })
    await flushComponent()

    const refreshingRow = click(findButton(harness.root, 'Refresh delivery status for ShipFast to founder@example.com'))
    const loadingPage = click(findButton(harness.root, 'Refresh current outreach history page'))
    pageRequest.resolve(pageFor([newerLowerPrecedenceRow]))
    await loadingPage
    await flushComponent()
    expect(harness.state.rows[0]?.provider_event_at).toBe('2026-08-30T12:10:00.000900+00:00')

    rowRequest.resolve(olderStrongRow)
    await refreshingRow
    await flushComponent()
    expect(harness.state.rows[0]?.status).toBe('delivered')
    expect(harness.state.rows[0]?.provider_event_at).toBe('2026-08-30T12:10:00.000900+00:00')
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
    expect(html).toMatch(/role="row"[^>]*>\s*<div[^>]*role="cell"[^>]*aria-colspan="6"/)
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
    expect(html).toContain('active:text-release-paper')
    expect(html).toContain(send.request_id)
    expect(html).toContain(send.provider_email_id)
    expect(html).toContain(send.accepted_at)
    expect(html).toContain(send.provider_event_at)
    expect(html).toContain(send.last_synced_at)
    expect(html).toContain(send.created_at)
    expect(html).toContain('provider_refresh_failed')
    expect(html).not.toMatch(/href="https?:\/\/(?:bit\.ly|[^"]+[?&]utm_)/i)
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
    expect(firstPage).toMatch(/<button[^>]*disabled[^>]*aria-label="Previous outreach history page"/)
    expect(firstPage).toMatch(/<button[^>]*disabled[^>]*aria-label="Next outreach history page"/)
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
        expect(callback === visibilityCallback).toBe(true)
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

})
