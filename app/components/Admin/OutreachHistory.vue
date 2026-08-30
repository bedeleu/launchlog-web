<script lang="ts">
import type { OutreachDeliveryStatus, OutreachEmailSend } from '~/composables/useOutreachSend'
import type { OutreachEmailSendPage } from '~/composables/useOutreachHistory'

interface OutreachHistoryRefreshOptions {
  isVisible: () => boolean
  refresh: () => Promise<void> | void
  setInterval: (callback: () => void, milliseconds: number) => unknown
  clearInterval: (id: unknown) => void
  addVisibilityListener: (callback: () => void) => void
  removeVisibilityListener: (callback: () => void) => void
}

function startOutreachHistoryRefresh(options: OutreachHistoryRefreshOptions): () => void {
  let wasVisible = options.isVisible()

  const refreshIfVisible = () => {
    const visible = options.isVisible()
    if (visible) void options.refresh()
    wasVisible = visible
  }
  const handleVisibilityChange = () => {
    const visible = options.isVisible()
    if (visible && !wasVisible) void options.refresh()
    wasVisible = visible
  }

  const intervalId = options.setInterval(refreshIfVisible, 10_000)
  options.addVisibilityListener(handleVisibilityChange)

  return () => {
    options.clearInterval(intervalId)
    options.removeVisibilityListener(handleVisibilityChange)
  }
}

async function showLatestOutreachPage(
  setPage: (page: number) => void,
  load: (page: number, silent: boolean, force?: boolean) => Promise<void>,
): Promise<void> {
  setPage(1)
  await load(1, true, true)
}
</script>

<script setup lang="ts">
interface StatusPresentation {
  label: string
  help: string
  tone: 'neutral' | 'signal' | 'warning' | 'destructive'
}

const statusPresentations: Record<OutreachDeliveryStatus, StatusPresentation> = {
  pending: {
    label: 'Pending',
    help: 'LaunchLog is preparing the provider request.',
    tone: 'neutral',
  },
  accepted: {
    label: 'Accepted',
    help: 'Accepted by Resend for delivery.',
    tone: 'neutral',
  },
  sent: {
    label: 'Sent',
    help: 'Resend began delivery to the recipient server.',
    tone: 'neutral',
  },
  delivered: {
    label: 'Delivered',
    help: 'The recipient server accepted the email. Inbox placement is not guaranteed.',
    tone: 'signal',
  },
  delivery_delayed: {
    label: 'Delayed',
    help: 'The provider reported a temporary delivery delay.',
    tone: 'warning',
  },
  bounced: {
    label: 'Bounced',
    help: 'The recipient server rejected the email.',
    tone: 'destructive',
  },
  complained: {
    label: 'Complained',
    help: 'The provider reported a spam complaint.',
    tone: 'destructive',
  },
  failed: {
    label: 'Failed',
    help: 'The delivery attempt failed.',
    tone: 'destructive',
  },
  suppressed: {
    label: 'Suppressed',
    help: 'The provider suppressed this delivery.',
    tone: 'destructive',
  },
  canceled: {
    label: 'Canceled',
    help: 'The provider canceled this delivery.',
    tone: 'destructive',
  },
  scheduled: {
    label: 'Scheduled',
    help: 'The provider reports this delivery as scheduled.',
    tone: 'neutral',
  },
  opened: {
    label: 'Opened',
    help: 'The provider reports an open event for this email.',
    tone: 'signal',
  },
  clicked: {
    label: 'Clicked',
    help: 'The provider reports a click event for this email.',
    tone: 'signal',
  },
  unknown: {
    label: 'Unknown',
    help: 'The provider status could not be normalized.',
    tone: 'warning',
  },
}

const statusPrecedence: Record<OutreachDeliveryStatus, number> = {
  unknown: 0,
  pending: 10,
  accepted: 20,
  scheduled: 30,
  sent: 40,
  delivery_delayed: 50,
  delivered: 60,
  opened: 70,
  clicked: 80,
  failed: 90,
  bounced: 100,
  suppressed: 110,
  complained: 120,
  canceled: 130,
}

const emptyMeta: OutreachEmailSendPage['meta'] = {
  current_page: 1,
  from: null,
  last_page: 1,
  per_page: 20,
  to: null,
  total: 0,
}

const history = useOutreachHistory()
const rows = ref<OutreachEmailSend[]>([])
const meta = ref<OutreachEmailSendPage['meta']>({ ...emptyMeta })
const currentPage = ref(1)
const loading = ref(true)
const silentRefreshing = ref(false)
const refreshingIds = ref(new Set<string>())
const error = ref<string | null>(null)
const refreshError = ref<string | null>(null)
const openRows = ref(new Set<string>())
let requestVersion = 0
let stopAutoRefresh: (() => void) | null = null
let disposed = false

const statusPresentation = (status: OutreachDeliveryStatus): StatusPresentation => (
  statusPresentations[status]
)

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const formatDate = (value: string): string => dateFormatter.format(new Date(value))
const formatTimestamp = (value: string | null): string => value ? dateFormatter.format(new Date(value)) : '—'
const safeDiagnosticCode = (value: string | null): string | null => {
  if (!value) return null
  return /^[a-z0-9_-]{1,64}$/i.test(value) ? value : 'Unavailable'
}
const isRowOpen = (id: string): boolean => openRows.value.has(id)
const isRowRefreshing = (id: string): boolean => refreshingIds.value.has(id)
const timestampValue = (value: string | null): number => value ? Date.parse(value) : Number.NEGATIVE_INFINITY

const freshestSend = (current: OutreachEmailSend, incoming: OutreachEmailSend): OutreachEmailSend => {
  const currentTuple = [
    timestampValue(current.updated_at),
    timestampValue(current.provider_event_at),
    timestampValue(current.last_synced_at),
    statusPrecedence[current.status],
  ]
  const incomingTuple = [
    timestampValue(incoming.updated_at),
    timestampValue(incoming.provider_event_at),
    timestampValue(incoming.last_synced_at),
    statusPrecedence[incoming.status],
  ]

  for (let index = 0; index < currentTuple.length; index += 1) {
    if (incomingTuple[index] === currentTuple[index]) continue
    return (incomingTuple[index] ?? Number.NEGATIVE_INFINITY) > (currentTuple[index] ?? Number.NEGATIVE_INFINITY)
      ? incoming
      : current
  }

  return incoming
}

const mergePageRows = (incomingRows: OutreachEmailSend[]): OutreachEmailSend[] => {
  const currentById = new Map(rows.value.map(row => [row.id, row]))
  return incomingRows.map((incoming) => {
    const current = currentById.get(incoming.id)
    return current ? freshestSend(current, incoming) : incoming
  })
}

const setRowRefreshing = (id: string, refreshing: boolean) => {
  const next = new Set(refreshingIds.value)
  if (refreshing) next.add(id)
  else next.delete(id)
  refreshingIds.value = next
}

const toggleDetails = (id: string) => {
  const next = new Set(openRows.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  openRows.value = next
}

const load = async (page = currentPage.value, silent = false, force = false): Promise<void> => {
  if (!force && silent && (loading.value || silentRefreshing.value)) return

  const version = ++requestVersion
  if (silent) silentRefreshing.value = true
  else loading.value = true
  if (!silent) error.value = null
  refreshError.value = null

  try {
    const result = await history.list(page)
    if (disposed || version !== requestVersion) return
    rows.value = mergePageRows(result.data)
    meta.value = result.meta
    currentPage.value = result.meta.current_page
    error.value = null
    refreshError.value = null
  }
  catch {
    if (disposed || version !== requestVersion) return
    if (silent) refreshError.value = 'Delivery history could not be refreshed.'
    else error.value = 'Delivery history could not be loaded.'
  }
  finally {
    if (!disposed && version === requestVersion) {
      loading.value = false
      silentRefreshing.value = false
    }
  }
}

const goToPage = async (page: number): Promise<void> => {
  if (page < 1 || page > meta.value.last_page || page === currentPage.value) return
  currentPage.value = page
  await load(page)
}

const refreshRow = async (send: OutreachEmailSend): Promise<void> => {
  if (isRowRefreshing(send.id)) return

  setRowRefreshing(send.id, true)
  refreshError.value = null
  try {
    const refreshed = await history.refresh(send.id)
    if (disposed) return
    rows.value = rows.value.map(row => row.id === refreshed.id ? freshestSend(row, refreshed) : row)
  }
  catch {
    if (disposed) return
    refreshError.value = `Delivery status for ${send.product_name} could not be refreshed.`
  }
  finally {
    if (!disposed) setRowRefreshing(send.id, false)
  }
}

const showLatest = (): Promise<void> => showLatestOutreachPage(
  page => { currentPage.value = page },
  load,
)

defineExpose({ showLatest })

onMounted(() => {
  if (typeof document !== 'undefined') {
    const pageDocument = document
    stopAutoRefresh = startOutreachHistoryRefresh({
      isVisible: () => pageDocument.visibilityState === 'visible',
      refresh: () => load(currentPage.value, true),
      setInterval: (callback, milliseconds) => globalThis.setInterval(callback, milliseconds),
      clearInterval: id => globalThis.clearInterval(id as ReturnType<typeof setInterval>),
      addVisibilityListener: callback => pageDocument.addEventListener('visibilitychange', callback),
      removeVisibilityListener: callback => pageDocument.removeEventListener('visibilitychange', callback),
    })
  }

  void load(1)
})

onBeforeUnmount(() => {
  disposed = true
  requestVersion += 1
  stopAutoRefresh?.()
  stopAutoRefresh = null
})
</script>

<template>
  <section
    aria-labelledby="outreach-history-title"
    class="overflow-hidden border border-release-seam bg-release-rail text-release-paper"
  >
    <header class="flex flex-col gap-4 border-b border-release-seam px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
      <div>
        <p class="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-release-blaze">
          Delivery ledger / {{ String(currentPage).padStart(2, '0') }}
        </p>
        <h2 id="outreach-history-title" class="mt-1 text-lg font-semibold tracking-[-0.02em] text-[#f6f1e7]">
          Outreach history
        </h2>
        <p class="mt-1 text-sm text-release-paper-muted">
          {{ meta.total }} {{ meta.total === 1 ? 'attempt' : 'attempts' }} recorded
        </p>
      </div>

      <div class="flex min-h-9 items-center gap-3">
        <span
          v-if="silentRefreshing"
          class="inline-flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-release-paper-muted"
          role="status"
        >
          <AppSpinner size="size-3.5" label="Refreshing outreach history" />
          Refreshing…
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          class="rounded-none border-release-seam bg-transparent font-mono text-xs uppercase tracking-[0.12em] text-release-paper hover:border-release-blaze hover:bg-transparent hover:text-release-blaze focus-visible:ring-release-focus active:bg-release-ink disabled:opacity-45"
          :disabled="loading || silentRefreshing"
          aria-label="Refresh current outreach history page"
          @click="load(currentPage, true)"
        >
          Refresh page
        </Button>
      </div>
    </header>

    <div
      v-if="loading"
      class="flex min-h-48 items-center justify-center gap-3 px-5 py-12 text-sm text-release-paper-muted"
      aria-busy="true"
    >
      <AppSpinner label="Loading delivery ledger" />
      <span>Loading delivery ledger</span>
    </div>

    <div
      v-else-if="error"
      class="border-l-2 border-release-destructive bg-release-destructive/10 px-5 py-8"
      role="alert"
    >
      <p class="font-medium text-release-paper">{{ error }}</p>
      <p class="mt-1 text-sm text-release-paper-muted">The current page was not replaced.</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        class="mt-5 rounded-none border-release-seam bg-transparent font-mono text-xs uppercase tracking-[0.12em] text-release-paper hover:border-release-blaze hover:bg-transparent hover:text-release-blaze focus-visible:ring-release-focus active:bg-release-ink"
        @click="load(currentPage)"
      >
        Retry
      </Button>
    </div>

    <div v-else-if="rows.length === 0" class="px-5 py-12 text-center">
      <p class="font-mono text-xs uppercase tracking-[0.16em] text-release-paper">No outreach deliveries yet</p>
      <p class="mx-auto mt-2 max-w-md text-sm leading-6 text-release-paper-muted">
        Accepted attempts and provider lifecycle updates will appear here.
      </p>
    </div>

    <div v-else role="table" aria-label="Outreach delivery history" class="divide-y divide-release-seam">
      <div
        role="row"
        class="hidden grid-cols-[10rem_minmax(13rem,1.1fr)_minmax(15rem,1.5fr)_12rem_7rem_11rem] gap-4 bg-release-ink/50 px-5 py-2.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-release-paper-muted xl:grid"
      >
        <span role="columnheader">Created</span>
        <span role="columnheader">Recipient / product</span>
        <span role="columnheader">Subject</span>
        <span role="columnheader">Status</span>
        <span role="columnheader">Channel</span>
        <span role="columnheader" class="text-right">Record</span>
      </div>

      <div v-for="send in rows" :key="send.id" role="rowgroup" data-outreach-history-row>
        <div
          role="row"
          class="grid gap-x-5 gap-y-4 px-4 py-5 transition-colors hover:bg-release-ink/35 sm:grid-cols-2 sm:px-5 xl:grid-cols-[10rem_minmax(13rem,1.1fr)_minmax(15rem,1.5fr)_12rem_7rem_11rem] xl:items-start xl:gap-4"
          :class="isRowOpen(send.id) ? 'bg-release-ink/55' : ''"
        >
          <div role="cell" class="min-w-0">
            <span class="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-release-paper-muted xl:hidden">Created</span>
            <time :datetime="send.created_at" class="mt-1 block font-mono text-xs tabular-nums text-release-paper xl:mt-0">
              {{ formatDate(send.created_at) }}
            </time>
          </div>

          <div role="cell" class="min-w-0">
            <span class="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-release-paper-muted xl:hidden">Recipient / product</span>
            <p class="mt-1 truncate font-semibold text-[#f6f1e7] xl:mt-0">{{ send.product_name }}</p>
            <p class="mt-0.5 truncate font-mono text-xs text-release-paper-muted">{{ send.recipient_email }}</p>
            <p class="mt-1 text-xs text-release-paper-muted">via {{ send.source_name }}</p>
          </div>

          <div role="cell" class="min-w-0 sm:col-span-2 xl:col-span-1">
            <span class="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-release-paper-muted xl:hidden">Subject</span>
            <p class="mt-1 line-clamp-2 text-sm leading-5 text-release-paper xl:mt-0">{{ send.subject }}</p>
          </div>

          <div role="cell" class="min-w-0">
            <span class="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-release-paper-muted xl:hidden">Status</span>
            <div class="mt-1 flex items-center gap-2 xl:mt-0">
              <span
                class="size-2 shrink-0 border"
                :class="{
                  'border-release-signal bg-release-signal': statusPresentation(send.status).tone === 'signal',
                  'border-release-warning bg-release-warning': statusPresentation(send.status).tone === 'warning',
                  'border-release-destructive bg-release-destructive': statusPresentation(send.status).tone === 'destructive',
                  'border-release-paper-muted bg-transparent': statusPresentation(send.status).tone === 'neutral',
                }"
                aria-hidden="true"
              />
              <span class="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-release-paper">
                {{ statusPresentation(send.status).label }}
              </span>
            </div>
            <p class="mt-1.5 text-xs leading-4 text-release-paper-muted">
              {{ statusPresentation(send.status).help }}
            </p>
          </div>

          <div role="cell" class="min-w-0">
            <span class="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-release-paper-muted xl:hidden">Channel</span>
            <p class="mt-1 font-mono text-xs uppercase tracking-[0.08em] text-release-paper xl:mt-0">{{ send.delivery_channel }}</p>
          </div>

          <div role="cell" class="flex flex-wrap items-start justify-end gap-2 sm:col-span-2 xl:col-span-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="rounded-none border border-release-seam bg-transparent font-mono text-[0.68rem] uppercase tracking-[0.1em] text-release-paper hover:border-release-blaze hover:bg-transparent hover:text-release-blaze focus-visible:ring-release-focus active:bg-release-ink"
              :aria-expanded="isRowOpen(send.id)"
              :aria-controls="`outreach-details-${send.id}`"
              :aria-label="`${isRowOpen(send.id) ? 'Hide' : 'Show'} delivery details for ${send.product_name}`"
              @click="toggleDetails(send.id)"
            >
              {{ isRowOpen(send.id) ? 'Close' : 'Details' }}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              class="rounded-none border-release-seam bg-transparent font-mono text-[0.68rem] uppercase tracking-[0.1em] text-release-paper hover:border-release-blaze hover:bg-transparent hover:text-release-blaze focus-visible:ring-release-focus active:bg-release-ink disabled:cursor-not-allowed disabled:opacity-45"
              :disabled="isRowRefreshing(send.id)"
              :aria-label="`Refresh delivery status for ${send.product_name} to ${send.recipient_email}`"
              @click="refreshRow(send)"
            >
              <AppSpinner
                v-if="isRowRefreshing(send.id)"
                size="size-3.5"
                color="text-current"
                :label="`Refreshing delivery status for ${send.product_name}`"
              />
              {{ isRowRefreshing(send.id) ? 'Refreshing' : 'Refresh' }}
            </Button>
          </div>
        </div>

        <div
          v-if="isRowOpen(send.id)"
          role="row"
        >
          <div
            :id="`outreach-details-${send.id}`"
            role="cell"
            aria-colspan="6"
            class="border-l-2 border-l-release-blaze bg-release-ink/70 px-4 py-5 sm:px-6 xl:ml-[10rem]"
          >
          <div class="grid gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
            <dl class="space-y-4 text-sm">
              <div>
                <dt class="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-release-paper-muted">From</dt>
                <dd class="mt-1 break-words text-release-paper">{{ send.from_name }} &lt;{{ send.from_address }}&gt;</dd>
              </div>
              <div>
                <dt class="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-release-paper-muted">Reply-To</dt>
                <dd class="mt-1 break-all text-release-paper">{{ send.reply_to_address }}</dd>
              </div>
              <div>
                <dt class="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-release-paper-muted">To</dt>
                <dd class="mt-1 break-all text-release-paper">{{ send.recipient_email }}</dd>
              </div>
              <div>
                <dt class="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-release-paper-muted">Delivery channel</dt>
                <dd class="mt-1 font-mono uppercase text-release-paper">{{ send.delivery_channel }}</dd>
              </div>
            </dl>

            <dl class="space-y-4 text-sm">
              <div>
                <dt class="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-release-paper-muted">Product</dt>
                <dd class="mt-1 text-release-paper">{{ send.product_name }}</dd>
              </div>
              <div>
                <dt class="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-release-paper-muted">Source</dt>
                <dd class="mt-1 text-release-paper">{{ send.source_name }}</dd>
              </div>
              <div>
                <dt class="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-release-paper-muted">Subject variant</dt>
                <dd class="mt-1 font-mono uppercase text-release-paper">{{ send.subject_variant }}</dd>
              </div>
              <div>
                <dt class="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-release-paper-muted">Preview</dt>
                <dd class="mt-1">
                  <a
                    v-if="send.preview_url"
                    :href="send.preview_url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="break-all text-release-blaze underline decoration-release-seam underline-offset-4 hover:decoration-release-blaze focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus active:text-release-paper active:decoration-release-paper"
                  >
                    Open direct preview ↗
                  </a>
                  <span v-else class="text-release-paper-muted">—</span>
                </dd>
              </div>
            </dl>

            <dl class="space-y-4 text-sm sm:col-span-2 xl:col-span-1">
              <div>
                <dt class="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-release-paper-muted">Request ID</dt>
                <dd class="mt-1 break-all font-mono text-xs text-release-paper">{{ send.request_id }}</dd>
              </div>
              <div>
                <dt class="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-release-paper-muted">Provider ID</dt>
                <dd class="mt-1 break-all font-mono text-xs text-release-paper">{{ send.provider_email_id || '—' }}</dd>
              </div>
              <div v-if="safeDiagnosticCode(send.diagnostic_code)">
                <dt class="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-release-paper-muted">Diagnostic code</dt>
                <dd class="mt-1 break-all font-mono text-xs text-release-warning">{{ safeDiagnosticCode(send.diagnostic_code) }}</dd>
              </div>
            </dl>
          </div>

          <div class="mt-6 border-t border-release-seam pt-5">
            <p class="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-release-paper-muted">Exact subject</p>
            <p class="mt-2 text-sm leading-6 text-release-paper">{{ send.subject }}</p>
          </div>

          <div class="mt-5 border-t border-release-seam pt-5">
            <p class="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-release-paper-muted">Plain-text body</p>
            <pre class="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words border border-release-seam bg-release-rail p-4 font-mono text-xs leading-6 text-release-paper">{{ send.text }}</pre>
          </div>

          <dl class="mt-5 grid gap-4 border-t border-release-seam pt-5 text-xs sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <dt class="font-mono uppercase tracking-[0.12em] text-release-paper-muted">Accepted</dt>
              <dd class="mt-1 font-mono text-release-paper">
                <time v-if="send.accepted_at" :datetime="send.accepted_at">{{ formatTimestamp(send.accepted_at) }}</time>
                <span v-else>—</span>
              </dd>
            </div>
            <div>
              <dt class="font-mono uppercase tracking-[0.12em] text-release-paper-muted">Provider event</dt>
              <dd class="mt-1 font-mono text-release-paper">
                <time v-if="send.provider_event_at" :datetime="send.provider_event_at">{{ formatTimestamp(send.provider_event_at) }}</time>
                <span v-else>—</span>
              </dd>
            </div>
            <div>
              <dt class="font-mono uppercase tracking-[0.12em] text-release-paper-muted">Last synced</dt>
              <dd class="mt-1 font-mono text-release-paper">
                <time v-if="send.last_synced_at" :datetime="send.last_synced_at">{{ formatTimestamp(send.last_synced_at) }}</time>
                <span v-else>—</span>
              </dd>
            </div>
            <div>
              <dt class="font-mono uppercase tracking-[0.12em] text-release-paper-muted">Created</dt>
              <dd class="mt-1 font-mono text-release-paper">
                <time :datetime="send.created_at">{{ formatTimestamp(send.created_at) }}</time>
              </dd>
            </div>
          </dl>
          </div>
        </div>
      </div>
    </div>

    <p v-if="refreshError" class="border-t border-release-destructive/40 bg-release-destructive/10 px-5 py-3 text-sm text-release-paper" role="alert">
      {{ refreshError }}
    </p>

    <nav
      v-if="!loading && !error && rows.length > 0"
      class="flex flex-col gap-3 border-t border-release-seam bg-release-ink/35 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
      aria-label="Outreach history pagination"
    >
      <p class="font-mono text-[0.65rem] uppercase tracking-[0.12em] text-release-paper-muted">
        {{ meta.from }}–{{ meta.to }} / {{ meta.total }} · Page {{ currentPage }} of {{ meta.last_page }}
      </p>
      <div class="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          class="rounded-none border-release-seam bg-transparent font-mono text-xs uppercase tracking-[0.1em] text-release-paper hover:border-release-blaze hover:bg-transparent hover:text-release-blaze focus-visible:ring-release-focus active:bg-release-ink disabled:cursor-not-allowed disabled:opacity-45"
          :disabled="currentPage <= 1 || loading"
          aria-label="Previous outreach history page"
          @click="goToPage(currentPage - 1)"
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          class="rounded-none border-release-seam bg-transparent font-mono text-xs uppercase tracking-[0.1em] text-release-paper hover:border-release-blaze hover:bg-transparent hover:text-release-blaze focus-visible:ring-release-focus active:bg-release-ink disabled:cursor-not-allowed disabled:opacity-45"
          :disabled="currentPage >= meta.last_page || loading"
          aria-label="Next outreach history page"
          @click="goToPage(currentPage + 1)"
        >
          Next
        </Button>
      </div>
    </nav>
  </section>
</template>
