import { defineStore } from 'pinia'
import { useLocalStorage } from '@vueuse/core'
import type { PlanTier } from '~/composables/usePlans'
import type { Preview } from '~/composables/usePreviews'

type PreviewDraft = {
  token: string
  sourceUrl: string
  url: string
  domain: string
  title: string
  tagline: string
  description: string
  email: string
  tier: PlanTier
  screenshotUrl: string | null
  status: string
  expiresAt: string | null
  updatedAt: string
}

const isPlanTier = (value: string | null | undefined): value is PlanTier =>
  value === 'basic' || value === 'premium' || value === 'featured'

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
  tier: existing?.tier ?? (isPlanTier(preview.tier) ? preview.tier : 'featured'),
  screenshotUrl: preview.screenshot_url,
  status: preview.status,
  expiresAt: preview.expires_at,
  updatedAt: new Date().toISOString(),
})

export const useIntakeStore = defineStore('intake', () => {
  const lastUrl = useLocalStorage('launchlog:intake:last-url', '')
  const latestToken = useLocalStorage<string | null>('launchlog:intake:latest-token', null)
  const drafts = useLocalStorage<Record<string, PreviewDraft>>('launchlog:intake:drafts', {})

  const latestDraft = computed(() =>
    latestToken.value ? drafts.value[latestToken.value] ?? null : null,
  )

  const rememberSubmittedUrl = (url: string) => {
    lastUrl.value = url
  }

  const rememberPreview = (preview: Preview) => {
    const existing = drafts.value[preview.token]
    drafts.value = {
      ...drafts.value,
      [preview.token]: toDraft(preview, existing),
    }
    latestToken.value = preview.token
    lastUrl.value = preview.source_url || preview.url
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

  const findReusableDraft = (url: string): PreviewDraft | null => {
    const wanted = normalizeUrlKey(url)
    if (!wanted) return null

    return Object.values(drafts.value)
      .filter(draft => draft.status !== 'converted' && !isExpired(draft))
      .find((draft) => {
        const source = normalizeUrlKey(draft.sourceUrl)
        const canonical = normalizeUrlKey(draft.url)

        return source === wanted || canonical === wanted
      }) ?? null
  }

  return {
    drafts,
    lastUrl,
    latestToken,
    latestDraft,
    rememberSubmittedUrl,
    rememberPreview,
    updateDraft,
    getDraft,
    findReusableDraft,
  }
})
