import { defineStore, skipHydrate } from 'pinia'
import { useLocalStorage } from '@vueuse/core'
import type { PlanTier } from '~/composables/usePlans'
import type { Preview } from '~/composables/usePreviews'
import type { PersistedPreviewDraft } from '~/utils/intake-retention'
import {
  createIntakeLastUrlExpiry,
  createFailClosedJsonSerializer,
  isPersistedPreviewDraft,
  pruneExpiredIntakeState,
  resolvePreviewCreatedMeasurement,
  resolveRetainedLastUrl,
} from '~/utils/intake-retention'

type PreviewDraft = PersistedPreviewDraft

const isPlanTier = (value: string | null | undefined): value is PlanTier =>
  value === 'basic' || value === 'featured'

const normalizeUrlKey = (value: string | null | undefined): string | null => {
  if (!value) return null

  try {
    const url = new URL(value)
    url.protocol = url.protocol.toLowerCase()
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '')
    url.hash = ''

    if (url.pathname !== '/') {
      url.pathname = url.pathname.replace(/\/+$/, '')
    }

    return url.toString()
  }
  catch {
    return null
  }
}

const isExpired = (draft: PreviewDraft): boolean =>
  draft.expiresAt ? new Date(draft.expiresAt).getTime() <= Date.now() : false

const toDraft = (preview: Preview, existing?: PreviewDraft): PreviewDraft => ({
  token: preview.token,
  sourceUrl: preview.source_url,
  url: preview.url,
  domain: preview.domain,
  title: existing?.title ?? preview.title ?? '',
  tagline: existing?.tagline ?? preview.tagline ?? '',
  description: existing?.description ?? preview.description ?? '',
  email: existing?.email ?? preview.email ?? '',
  // A draft persisted before the two-plan model may carry a retired tier;
  // never trust a stored value the validator no longer accepts.
  tier: isPlanTier(existing?.tier)
    ? existing.tier
    : (isPlanTier(preview.tier) ? preview.tier : 'basic'),
  screenshotUrl: preview.screenshot_url,
  status: preview.status,
  previewCreatedMeasurementPending: existing?.previewCreatedMeasurementPending
    ?? preview.created_new_preview === true,
  expiresAt: preview.expires_at,
  updatedAt: new Date().toISOString(),
})

export const useIntakeStore = defineStore('intake', () => {
  const removeCorruptStorageKey = (key: string) => {
    try {
      window.localStorage.removeItem(key)
    }
    catch {
      // Inaccessible storage cannot be retained or used by the app.
    }
  }
  // Browser storage owns these refs. Nuxt's SSR Pinia payload contains only
  // request-local defaults and must never overwrite a newer local draft during
  // hydration (especially the one-shot Preview Created readiness marker).
  const lastUrl = skipHydrate(useLocalStorage('launchlog:intake:last-url', ''))
  const lastUrlExpiresAt = skipHydrate(useLocalStorage<string | null>('launchlog:intake:last-url-expires-at', null))
  const latestToken = skipHydrate(useLocalStorage<string | null>('launchlog:intake:latest-token', null))
  const drafts = skipHydrate(useLocalStorage<Record<string, PreviewDraft>>(
    'launchlog:intake:drafts',
    {},
    {
      serializer: createFailClosedJsonSerializer(
        () => ({}),
        () => removeCorruptStorageKey('launchlog:intake:drafts'),
      ),
    },
  ))
  // Normalized-URL → token index, so ANY previously-previewed URL (not just the
  // last) resolves to its saved token in O(1).
  const previewByUrlKey = skipHydrate(useLocalStorage<Record<string, string>>(
    'launchlog:intake:url-index',
    {},
    {
      serializer: createFailClosedJsonSerializer(
        () => ({}),
        () => removeCorruptStorageKey('launchlog:intake:url-index'),
      ),
    },
  ))
  // One-shot handoff of the tier chosen on /pricing → /submit. Consumed when a
  // preview is created or resumed; after that the draft is the source of truth,
  // so polling and refreshes never reset the user's choice.
  const preferredTier = skipHydrate(useLocalStorage<PlanTier | null>('launchlog:intake:preferred-tier', null))

  const pruneExpiredDrafts = () => {
    const pruned = pruneExpiredIntakeState({
      drafts: drafts.value,
      latestToken: latestToken.value,
      urlIndex: previewByUrlKey.value,
    }, Date.now(), isPersistedPreviewDraft)
    if (!pruned.changed) return

    drafts.value = pruned.drafts
    latestToken.value = pruned.latestToken
    previewByUrlKey.value = pruned.urlIndex
  }

  const pruneLastUrl = () => {
    const retained = resolveRetainedLastUrl(lastUrl.value, lastUrlExpiresAt.value)
    if (!retained.changed) return

    lastUrl.value = retained.value
    lastUrlExpiresAt.value = retained.expiresAt
  }

  if (import.meta.client) {
    pruneExpiredDrafts()
    pruneLastUrl()
    if (preferredTier.value !== null && !isPlanTier(preferredTier.value)) {
      preferredTier.value = null
    }
  }

  const latestDraft = computed(() =>
    latestToken.value ? drafts.value[latestToken.value] ?? null : null,
  )

  const rememberSubmittedUrl = (url: string, previewExpiry?: string | null) => {
    const expiresAt = createIntakeLastUrlExpiry(Date.now(), previewExpiry)
    const retained = resolveRetainedLastUrl(url, expiresAt)
    lastUrl.value = retained.value
    lastUrlExpiresAt.value = retained.expiresAt
  }

  const rememberPreview = (preview: Preview) => {
    pruneExpiredDrafts()
    const existing = drafts.value[preview.token]
    drafts.value = {
      ...drafts.value,
      [preview.token]: toDraft(preview, existing),
    }
    latestToken.value = preview.token
    rememberSubmittedUrl(preview.source_url || preview.url, preview.expires_at)

    const index = { ...previewByUrlKey.value }
    for (const candidate of [preview.source_url, preview.url]) {
      const key = normalizeUrlKey(candidate)
      if (key) index[key] = preview.token
    }
    previewByUrlKey.value = index
  }

  const updateDraft = (token: string, patch: Partial<Omit<PreviewDraft, 'token'>>) => {
    const existing = drafts.value[token]
    if (!existing) return
    drafts.value = {
      ...drafts.value,
      [token]: {
        ...existing,
        ...patch,
        updatedAt: new Date().toISOString(),
      },
    }
  }

  const getDraft = (token: string) => drafts.value[token] ?? null

  const consumePreviewCreatedMeasurement = (preview: Preview): boolean => {
    const existing = drafts.value[preview.token]
    if (!existing) return false

    const outcome = resolvePreviewCreatedMeasurement(
      existing.previewCreatedMeasurementPending === true,
      preview.status,
    )
    if (outcome.nextPending !== existing.previewCreatedMeasurementPending) {
      updateDraft(preview.token, {
        previewCreatedMeasurementPending: outcome.nextPending,
      })
    }

    return outcome.shouldTrack
  }

  const setPreferredTier = (tier: PlanTier) => {
    preferredTier.value = tier
  }

  /** Applies the pending choice to this preview's draft, then clears it. */
  const applyPreferredTier = (token: string) => {
    const tier = preferredTier.value
    preferredTier.value = null
    if (!tier || !isPlanTier(tier)) return

    updateDraft(token, { tier })
  }

  const previewForUrl = (url: string): PreviewDraft | null => {
    pruneExpiredDrafts()
    const key = normalizeUrlKey(url)
    if (!key) return null

    const token = previewByUrlKey.value[key]
    const draft = token ? drafts.value[token] : null
    if (!draft) return null
    if (draft.status === 'converted' || isExpired(draft)) return null

    return draft
  }

  return {
    drafts,
    lastUrl,
    latestToken,
    latestDraft,
    previewByUrlKey,
    preferredTier,
    rememberSubmittedUrl,
    rememberPreview,
    updateDraft,
    getDraft,
    consumePreviewCreatedMeasurement,
    setPreferredTier,
    applyPreferredTier,
    previewForUrl,
  }
})
