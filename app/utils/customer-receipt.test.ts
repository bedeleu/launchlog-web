import { expect, test } from 'bun:test'
import { receiptUnavailableLabel } from './customer-receipt'

test('uses pending only while a listing can still become public', () => {
  expect(receiptUnavailableLabel('draft')).toBe('Pending')
  expect(receiptUnavailableLabel('pending_review')).toBe('Pending')
  expect(receiptUnavailableLabel('archived')).toBe('Not published')
  expect(receiptUnavailableLabel('rejected')).toBe('Not published')
  expect(receiptUnavailableLabel('spam')).toBe('Not published')
  expect(receiptUnavailableLabel('published')).toBe('Unavailable')
})
