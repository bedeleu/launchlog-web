import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createPinia, defineStore, setActivePinia, skipHydrate } from 'pinia'
import { ref } from 'vue'
import {
  createIntakeLastUrlExpiry,
  createFailClosedJsonSerializer,
  isPersistedPreviewDraft,
  pruneExpiredIntakeState,
  resolvePreviewCreatedMeasurement,
  resolveRetainedLastUrl,
} from './intake-retention'
import type { PersistedPreviewDraft } from './intake-retention'

const NOW = Date.parse('2026-08-29T12:00:00.000Z')
const PREVIEW_TOKEN = 'p'.repeat(64)
const EXPIRED_TOKEN = 'e'.repeat(64)
const ACTIVE_TOKEN = 'a'.repeat(64)
const FUTURE_TOKEN = 'f'.repeat(64)

type TestDraft = {
  expiresAt: string | null
  email: string
}

const isTestDraft = (value: unknown): value is TestDraft => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false

  const draft = value as Record<string, unknown>
  return (draft.expiresAt === null || typeof draft.expiresAt === 'string')
    && typeof draft.email === 'string'
}

describe('private preview browser retention', () => {
  test('counts only a newly-created preview that reaches ready and consumes every terminal outcome', () => {
    expect(resolvePreviewCreatedMeasurement(true, 'generating')).toEqual({
      nextPending: true,
      shouldTrack: false,
    })
    expect(resolvePreviewCreatedMeasurement(true, 'ready')).toEqual({
      nextPending: false,
      shouldTrack: true,
    })
    expect(resolvePreviewCreatedMeasurement(true, 'failed')).toEqual({
      nextPending: false,
      shouldTrack: false,
    })
    expect(resolvePreviewCreatedMeasurement(false, 'ready')).toEqual({
      nextPending: false,
      shouldTrack: false,
    })
  })

  test('removes expired drafts and every token index that points to them', () => {
    expect(pruneExpiredIntakeState({
      drafts: {
        expired: { expiresAt: '2026-08-29T11:59:59.000Z', email: 'private@example.com' },
        active: { expiresAt: '2026-08-30T12:00:00.000Z', email: 'active@example.com' },
      },
      latestToken: 'expired',
      urlIndex: {
        'https://expired.example/': 'expired',
        'https://active.example/': 'active',
      },
    }, NOW)).toEqual({
      drafts: {
        active: { expiresAt: '2026-08-30T12:00:00.000Z', email: 'active@example.com' },
      },
      latestToken: null,
      urlIndex: { 'https://active.example/': 'active' },
      changed: true,
    })
  })

  test('keeps active and non-expiring drafts unchanged', () => {
    const state = {
      drafts: {
        active: { expiresAt: '2026-08-30T12:00:00.000Z' },
        durable: { expiresAt: null },
      },
      latestToken: 'active',
      urlIndex: { active: 'active', durable: 'durable' },
    }
    expect(pruneExpiredIntakeState(state, NOW)).toEqual({ ...state, changed: false })
  })

  test('fails closed instead of crashing when persisted containers are corrupt', () => {
    expect(pruneExpiredIntakeState<TestDraft>({
      drafts: null,
      latestToken: 42,
      urlIndex: ['not', 'an', 'index'],
    } as never, NOW, isTestDraft)).toEqual({
      drafts: {},
      latestToken: null,
      urlIndex: {},
      changed: true,
    })
  })

  test('removes malformed raw JSON instead of retaining it across every app load', () => {
    const removed: string[] = []
    const serializer = createFailClosedJsonSerializer(
      () => ({} as Record<string, unknown>),
      () => removed.push('removed'),
    )

    expect(serializer.read('{private-email:broken-json')).toEqual({})
    expect(removed).toEqual(['removed'])
    expect(serializer.read('{"safe":true}')).toEqual({ safe: true })
    expect(serializer.write({ safe: true })).toBe('{"safe":true}')
  })

  test('drops malformed drafts and index entries through the supplied runtime validator', () => {
    expect(pruneExpiredIntakeState<TestDraft>({
      drafts: {
        valid: { expiresAt: '2026-08-30T12:00:00.000Z', email: 'valid@example.com' },
        malformed: { expiresAt: '2026-08-30T12:00:00.000Z', email: 42 },
      },
      latestToken: 'malformed',
      urlIndex: {
        valid: 'valid',
        malformed: 'malformed',
        invalidToken: 123,
      },
    } as never, NOW, isTestDraft)).toEqual({
      drafts: {
        valid: { expiresAt: '2026-08-30T12:00:00.000Z', email: 'valid@example.com' },
      },
      latestToken: null,
      urlIndex: { valid: 'valid' },
      changed: true,
    })
  })

  test('caps last-URL retention at seven days or the earlier preview expiry', () => {
    expect(createIntakeLastUrlExpiry(NOW)).toBe('2026-09-05T12:00:00.000Z')
    expect(createIntakeLastUrlExpiry(NOW, '2026-08-31T12:00:00.000Z')).toBe('2026-08-31T12:00:00.000Z')
    expect(createIntakeLastUrlExpiry(NOW, 'not-a-date')).toBe('2026-09-05T12:00:00.000Z')
  })

  test('keeps a last URL only with a valid, unexpired companion timestamp', () => {
    expect(resolveRetainedLastUrl(
      'https://product.example/launch',
      '2026-08-30T12:00:00.000Z',
      NOW,
    )).toEqual({
      value: 'https://product.example/launch',
      expiresAt: '2026-08-30T12:00:00.000Z',
      changed: false,
    })
    expect(resolveRetainedLastUrl('https://expired.example', '2026-08-29T11:59:59.000Z', NOW))
      .toEqual({ value: '', expiresAt: null, changed: true })
    expect(resolveRetainedLastUrl('https://legacy-without-expiry.example', null, NOW))
      .toEqual({ value: '', expiresAt: null, changed: true })
    expect(resolveRetainedLastUrl('not-a-public-url', '2026-08-30T12:00:00.000Z', NOW))
      .toEqual({ value: '', expiresAt: null, changed: true })
    expect(resolveRetainedLastUrl('', null, NOW))
      .toEqual({ value: '', expiresAt: null, changed: false })
  })

  test('accepts only complete persisted preview drafts with a matching supported shape', () => {
    const valid = {
      token: PREVIEW_TOKEN,
      sourceUrl: 'https://product.example',
      url: 'https://product.example',
      domain: 'product.example',
      title: 'Product',
      tagline: 'A useful product',
      description: 'A complete persisted preview draft.',
      email: 'maker@example.com',
      tier: 'featured',
      screenshotUrl: null,
      status: 'ready',
      previewCreatedMeasurementPending: true,
      expiresAt: '2026-08-30T12:00:00.000Z',
      updatedAt: '2026-08-29T11:00:00.000Z',
    }

    expect(isPersistedPreviewDraft(valid, PREVIEW_TOKEN)).toBe(true)
    expect(isPersistedPreviewDraft({
      ...valid,
      expiresAt: '2026-08-30T12:00:00.123456Z',
    }, PREVIEW_TOKEN)).toBe(true)
    expect(isPersistedPreviewDraft(valid, 'different-map-key')).toBe(false)
    expect(isPersistedPreviewDraft({ ...valid, tier: 'retired-plan' })).toBe(false)
    expect(isPersistedPreviewDraft({ ...valid, email: 42 })).toBe(false)
    expect(isPersistedPreviewDraft({ ...valid, updatedAt: 'not-a-date' })).toBe(false)
    expect(isPersistedPreviewDraft({ ...valid, token: 'too-short' })).toBe(false)
    expect(isPersistedPreviewDraft({ ...valid, status: 'impossible' })).toBe(false)
    expect(isPersistedPreviewDraft({ ...valid, previewCreatedMeasurementPending: 'yes' })).toBe(false)
    expect(isPersistedPreviewDraft({ ...valid, sourceUrl: 'javascript:alert(1)' })).toBe(false)
    expect(isPersistedPreviewDraft({ ...valid, domain: 'Product.Example' })).toBe(false)
    expect(isPersistedPreviewDraft({ ...valid, email: 'not-an-email' })).toBe(false)
    expect(isPersistedPreviewDraft({ ...valid, title: 'x'.repeat(201) })).toBe(false)
    expect(isPersistedPreviewDraft({ ...valid, screenshotUrl: 'data:text/plain,private' })).toBe(false)
    expect(isPersistedPreviewDraft(null)).toBe(false)
  })

  test('removes a persisted private draft after seven days even when legacy state has no expiry', () => {
    const baseDraft = {
      token: PREVIEW_TOKEN,
      sourceUrl: 'https://product.example',
      url: 'https://product.example',
      domain: 'product.example',
      title: 'Product',
      tagline: 'A useful product',
      description: 'A complete persisted preview draft.',
      email: 'maker@example.com',
      tier: 'basic' as const,
      screenshotUrl: null,
      status: 'ready',
      expiresAt: null,
    }

    const pruned = pruneExpiredIntakeState({
      drafts: {
        [EXPIRED_TOKEN]: {
          ...baseDraft,
          token: EXPIRED_TOKEN,
          updatedAt: '2026-08-22T11:59:59.000Z',
        },
        [ACTIVE_TOKEN]: {
          ...baseDraft,
          token: ACTIVE_TOKEN,
          updatedAt: '2026-08-29T11:00:00.000Z',
        },
      },
      latestToken: EXPIRED_TOKEN,
      urlIndex: { expired: EXPIRED_TOKEN, active: ACTIVE_TOKEN },
    }, NOW, isPersistedPreviewDraft)

    expect(Object.keys(pruned.drafts)).toEqual([ACTIVE_TOKEN])
    expect(pruned.latestToken).toBeNull()
    expect(pruned.urlIndex).toEqual({ active: ACTIVE_TOKEN })
    expect(pruned.changed).toBe(true)
  })

  test('fails closed for a future updatedAt instead of extending retention on every load', () => {
    const draft: PersistedPreviewDraft = {
      token: FUTURE_TOKEN,
      sourceUrl: 'https://product.example',
      url: 'https://product.example',
      domain: 'product.example',
      title: 'Product',
      tagline: 'A useful product',
      description: 'A complete persisted preview draft.',
      email: 'maker@example.com',
      tier: 'basic',
      screenshotUrl: null,
      status: 'ready',
      expiresAt: null,
      updatedAt: '2026-09-29T12:00:00.000Z',
    }

    expect(pruneExpiredIntakeState({
      drafts: { [FUTURE_TOKEN]: draft },
      latestToken: FUTURE_TOKEN,
      urlIndex: { 'https://product.example': FUTURE_TOKEN },
    }, NOW, isPersistedPreviewDraft)).toEqual({
      drafts: {},
      latestToken: null,
      urlIndex: {},
      changed: true,
    })
  })

  test('does not let special record keys poison draft or index membership', () => {
    const draft = { expiresAt: '2026-08-30T12:00:00.000Z', email: 'private@example.com' }
    const rawDrafts = Object.fromEntries([['__proto__', draft]]) as Record<string, TestDraft>
    const rawUrlIndex = Object.fromEntries([
      ['__proto__', '__proto__'],
      ['https://product.example', '__proto__'],
    ]) as Record<string, string>

    const pruned = pruneExpiredIntakeState({
      drafts: rawDrafts,
      latestToken: '__proto__',
      urlIndex: rawUrlIndex,
    }, NOW, isTestDraft)

    expect(Object.keys(pruned.drafts)).toEqual([])
    expect(Object.getPrototypeOf(pruned.drafts)).toBe(Object.prototype)
    expect(pruned.latestToken).toBeNull()
    expect(pruned.urlIndex).toEqual({})
    expect(pruned.changed).toBe(true)
  })

  test('runs pruning when the intake store starts and before local recovery', () => {
    const source = readFileSync(fileURLToPath(new URL('../stores/intake.ts', import.meta.url)), 'utf8')
    expect(source).toContain('pruneExpiredDrafts()')
    expect(source.match(/pruneExpiredDrafts\(\)/g)?.length).toBeGreaterThanOrEqual(2)
  })

  test('validates a submitted URL before writing its bounded retention state', () => {
    const source = readFileSync(fileURLToPath(new URL('../stores/intake.ts', import.meta.url)), 'utf8')
    expect(source).toContain('resolveRetainedLastUrl(url, expiresAt)')
  })

  test('keeps browser-owned intake refs out of SSR hydration', () => {
    const source = readFileSync(fileURLToPath(new URL('../stores/intake.ts', import.meta.url)), 'utf8')
    const storageRefs = source.match(/useLocalStorage(?:<[^;]+?>)?\(/gu)?.length ?? 0
    const protectedRefs = source.match(/skipHydrate\(useLocalStorage/gu)?.length ?? 0

    expect(storageRefs).toBe(6)
    expect(protectedRefs).toBe(storageRefs)
  })

  test('preserves one pending ready event through Pinia SSR hydration and consumes it exactly once', () => {
    const pinia = createPinia()
    pinia.state.value['intake-hydration-ready-probe'] = {
      drafts: { preview: { pending: false } },
    }
    setActivePinia(pinia)

    const browserDrafts = ref({ preview: { pending: true } })
    const useProbe = defineStore('intake-hydration-ready-probe', () => ({
      drafts: skipHydrate(browserDrafts),
    }))
    const probe = useProbe()

    let pending = probe.drafts.preview.pending
    let eventCount = 0
    for (const status of ['generating', 'ready', 'ready']) {
      const outcome = resolvePreviewCreatedMeasurement(pending, status)
      pending = outcome.nextPending
      if (outcome.shouldTrack) eventCount++
    }

    expect(probe.drafts.preview.pending).toBeTrue()
    expect(pending).toBeFalse()
    expect(eventCount).toBe(1)
  })

  test('preserves a pending marker through hydration but emits zero when generation fails', () => {
    const pinia = createPinia()
    pinia.state.value['intake-hydration-failed-probe'] = {
      drafts: { preview: { pending: false } },
    }
    setActivePinia(pinia)

    const browserDrafts = ref({ preview: { pending: true } })
    const useProbe = defineStore('intake-hydration-failed-probe', () => ({
      drafts: skipHydrate(browserDrafts),
    }))
    const probe = useProbe()
    const generating = resolvePreviewCreatedMeasurement(probe.drafts.preview.pending, 'generating')
    const failed = resolvePreviewCreatedMeasurement(generating.nextPending, 'failed')

    expect(probe.drafts.preview.pending).toBeTrue()
    expect(failed).toEqual({ nextPending: false, shouldTrack: false })
  })
})
