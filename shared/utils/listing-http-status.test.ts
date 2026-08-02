import { describe, expect, it } from 'bun:test'
import {
  extractHttpStatus,
  listingAbsenceStatus,
} from './listing-http-status'

describe('extractHttpStatus', () => {
  it.each([
    [{ statusCode: 404 }, 404],
    [{ status: 410 }, 410],
    [{ data: { statusCode: 404 } }, 404],
    [{ response: { status: 410 } }, 410],
  ] as const)('extracts direct and nested HTTP statuses', (error, expected) => {
    expect(extractHttpStatus(error)).toBe(expected)
  })
})

describe('listingAbsenceStatus', () => {
  it('classifies an upstream 404 as not found', () => {
    expect(listingAbsenceStatus({ statusCode: 404 }, undefined)).toBe(404)
  })

  it('classifies an upstream 410 as withdrawn', () => {
    expect(listingAbsenceStatus({ response: { status: 410 } }, undefined)).toBe(410)
  })

  it('classifies an empty successful response as not found', () => {
    expect(listingAbsenceStatus(undefined, null)).toBe(404)
  })

  it.each([
    { statusCode: 500 },
    new Error('network unavailable'),
  ])('does not classify upstream or network failures as missing', (error) => {
    expect(listingAbsenceStatus(error, undefined)).toBeUndefined()
  })
})
