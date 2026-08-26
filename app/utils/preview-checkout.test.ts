import { describe, expect, test } from 'bun:test'
import { buildPreviewTextEdit, resolvePreviewCheckout } from './preview-checkout'

describe('preview checkout recovery', () => {
  test('an active reservation restores the server-side tier and email over a stale browser draft', () => {
    expect(resolvePreviewCheckout({
      checkoutReserved: true,
      previewTier: 'featured',
      previewEmail: 'paid@example.com',
      draftTier: 'basic',
      draftEmail: 'stale@example.com',
    })).toEqual({
      locked: true,
      tier: 'featured',
      email: 'paid@example.com',
    })
  })

  test('a fresh preview uses the draft choice and otherwise defaults to Standard', () => {
    expect(resolvePreviewCheckout({
      checkoutReserved: false,
      previewTier: 'basic',
      previewEmail: null,
      draftTier: 'featured',
      draftEmail: 'maker@example.com',
    })).toEqual({
      locked: false,
      tier: 'featured',
      email: 'maker@example.com',
    })

    expect(resolvePreviewCheckout({
      checkoutReserved: false,
      previewTier: null,
      previewEmail: null,
      draftTier: null,
      draftEmail: null,
    }).tier).toBe('basic')
  })

  test('the pre-checkout edit saves listing copy only, never buyer identity or plan', () => {
    expect(buildPreviewTextEdit({
      title: 'Maker',
      tagline: '',
      description: 'A useful product.',
    })).toEqual({
      title: 'Maker',
      tagline: null,
      description: 'A useful product.',
    })
  })
})
