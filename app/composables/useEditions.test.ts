import { describe, expect, test } from 'bun:test'
import type { EditionItem } from '#shared/types/editions'
import { createEditionClient, normalizeEditionPage } from './useEditions'

const API = 'https://api.launchlog.test'

const summary = {
  slug: '2026-w35',
  week_starts_at: '2026-08-24',
  week_ends_at: '2026-08-30',
  introduction: 'A frozen public record.',
  published_at: '2026-08-31T00:00:00+00:00',
  modified_at: '2026-08-31T00:05:00+00:00',
  item_count: 1,
  path: '/shipped/2026-w35',
}

const currentItem = {
  kind: 'new_listing',
  position: 1,
  shipped_at: '2026-08-27',
  source_week_starts_at: null,
  carried_over: false,
  name: 'Current launch',
  tagline: 'Still live.',
  tier_label: 'Featured',
  image_url: null,
  current: true,
  listing_path: '/listing/current-launch',
  provenance_url: 'https://proof.example/current-launch',
  include_in_item_list: true,
} satisfies EditionItem

const archive = (page = 1, data: unknown[] = [summary]) => ({
  data,
  meta: {
    current_page: page,
    last_page: 2,
    per_page: 24,
    total: 25,
  },
})

const detail = (items: EditionItem[] = [currentItem]) => ({
  data: {
    slug: summary.slug,
    week_starts_at: summary.week_starts_at,
    week_ends_at: summary.week_ends_at,
    introduction: summary.introduction,
    published_at: summary.published_at,
    modified_at: summary.modified_at,
    path: summary.path,
    items,
  },
})

describe('edition discovery client', () => {
  test.each([undefined, '1', 1])('normalizes page one from %p', (raw) => {
    expect(normalizeEditionPage(raw)).toBe(1)
  })

  test.each([
    '',
    '0',
    '-1',
    '1.2',
    '01',
    'no',
    '9999999999',
    [['1']],
    [['1', '2']],
    2,
    null,
  ])('rejects non-canonical page input %p', (raw) => {
    expect(() => normalizeEditionPage(raw)).toThrow('Invalid edition page')
  })

  test('requests the exact archive page and accepts a truthful empty first page', async () => {
    const calls: Array<{ url: string, options?: Record<string, unknown> }> = []
    const client = createEditionClient(async (url, options) => {
      calls.push({ url: String(url), options })
      return {
        data: [],
        meta: { current_page: 1, last_page: 1, per_page: 24, total: 0 },
      }
    }, API)

    await expect(client.fetchArchive(1)).resolves.toMatchObject({
      data: [],
      meta: { current_page: 1, last_page: 1, per_page: 24, total: 0 },
    })
    expect(calls).toEqual([{
      url: `${API}/api/v1/discovery/editions?page=1`,
      options: { timeout: 5000 },
    }])
  })

  test('requests the exact detail slug without widening the endpoint', async () => {
    const calls: Array<{ url: string, options?: Record<string, unknown> }> = []
    const response = detail()
    const client = createEditionClient(async (url, options) => {
      calls.push({ url: String(url), options })
      return response
    }, API)

    await expect(client.fetchDetail('2026-w35')).resolves.toEqual(response.data)
    expect(calls).toEqual([{
      url: `${API}/api/v1/discovery/editions/2026-w35`,
      options: { timeout: 5000 },
    }])
  })

  test.each([
    ['archive 404', 'archive', { statusCode: 404 }, 404],
    ['archive outage', 'archive', { response: { status: 503 } }, 503],
    ['archive transport failure', 'archive', new TypeError('offline'), 503],
    ['detail 404', 'detail', { status: 404 }, 404],
    ['detail outage', 'detail', { response: { status: 500 } }, 503],
  ] as const)('maps %s without inventing an empty result', async (_name, method, failure, status) => {
    const client = createEditionClient(async () => Promise.reject(failure), API)
    const request = method === 'archive'
      ? client.fetchArchive(1)
      : client.fetchDetail('2026-w35')

    await expect(request).rejects.toMatchObject({ statusCode: status })
  })

  test.each(['not-an-edition', '2026-W35', '2026-w00', '2026-w54', '2026-w35/extra'])(
    'rejects malformed detail slug %s as 404 before fetching',
    async (slug) => {
      let calls = 0
      const client = createEditionClient(async () => {
        calls += 1
        return detail()
      }, API)

      await expect(client.fetchDetail(slug)).rejects.toMatchObject({ statusCode: 404 })
      expect(calls).toBe(0)
    },
  )

  test.each([
    ['pagination that does not describe the requested page', archive(1)],
    ['a malformed summary row', archive(2, [{ ...summary, path: '/shipped/wrong' }])],
    ['a malformed detail envelope', { data: { ...detail().data, items: 'nope' } }],
    ['an incoherent withdrawn item', detail([{
      ...currentItem,
      current: false,
      listing_path: '/listing/must-not-link',
      provenance_url: 'https://proof.example/must-not-link',
      include_in_item_list: true,
    }])],
  ] as const)('fails closed with 503 for %s', async (_name, response) => {
    const client = createEditionClient(async () => response, API)
    const request = 'items' in (response.data as Record<string, unknown>)
      ? client.fetchDetail('2026-w35')
      : client.fetchArchive(2)

    await expect(request).rejects.toMatchObject({ statusCode: 503 })
  })
})
