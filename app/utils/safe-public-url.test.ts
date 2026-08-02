import { expect, test } from 'bun:test'
import { safeExternalHttpUrl } from './safe-public-url'

test('allows configured HTTP status pages and rejects unsafe external URLs', () => {
  expect(safeExternalHttpUrl(' https://status.example.com/incidents ')).toBe('https://status.example.com/incidents')
  expect(safeExternalHttpUrl('http://status.example.com')).toBe('http://status.example.com/')
  expect(safeExternalHttpUrl('javascript:alert(1)')).toBeNull()
  expect(safeExternalHttpUrl('data:text/html,unsafe')).toBeNull()
  expect(safeExternalHttpUrl('not a url')).toBeNull()
  expect(safeExternalHttpUrl('')).toBeNull()
})
