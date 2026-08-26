import { describe, expect, it } from 'bun:test'
import { findPublicPlan } from './public-plans'

describe('findPublicPlan', () => {
  it('defaults missing or unknown input to Standard', () => {
    expect(findPublicPlan(undefined).tier).toBe('basic')
    expect(findPublicPlan(null).tier).toBe('basic')
    expect(findPublicPlan('retired-tier').tier).toBe('basic')
  })

  it('keeps an explicit Featured selection', () => {
    expect(findPublicPlan('featured').tier).toBe('featured')
  })
})
