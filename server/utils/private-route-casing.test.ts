import { describe, expect, test } from 'bun:test'
import { canonicalPrivatePath } from './private-route-casing'

describe('canonicalPrivatePath', () => {
  test('leaves an already-canonical private path alone', () => {
    for (const path of ['/admin', '/admin/listings', '/dashboard', '/login', '/checkout/success', '/preview/Kept-As-Is']) {
      expect(canonicalPrivatePath(path)).toBeNull()
    }
  })

  test('leaves public paths alone entirely', () => {
    for (const path of ['/', '/about', '/About', '/blog', '/Blog', '/listing/2nodoc-com', '/Listing/2nodoc-com', '/pricing']) {
      expect(canonicalPrivatePath(path)).toBeNull()
    }
  })

  test('canonicalises a mis-cased private route', () => {
    expect(canonicalPrivatePath('/Admin')).toBe('/admin')
    expect(canonicalPrivatePath('/aDmIn')).toBe('/admin')
    expect(canonicalPrivatePath('/ADMIN')).toBe('/admin')
    expect(canonicalPrivatePath('/Dashboard')).toBe('/dashboard')
    expect(canonicalPrivatePath('/LOGIN')).toBe('/login')
  })

  test('canonicalises nested static private routes in full', () => {
    expect(canonicalPrivatePath('/Admin/listings')).toBe('/admin/listings')
    expect(canonicalPrivatePath('/Admin/Listings')).toBe('/admin/listings')
    expect(canonicalPrivatePath('/Checkout/Success')).toBe('/checkout/success')
  })

  // The segment after /preview is a case-sensitive credential, not a route name. Lowercasing it
  // would hand the visitor a token that no longer resolves.
  test('never rewrites the preview token', () => {
    expect(canonicalPrivatePath('/Preview/MiXeD-Case-Token')).toBe('/preview/MiXeD-Case-Token')
    expect(canonicalPrivatePath('/PREVIEW/aB-cD_eF')).toBe('/preview/aB-cD_eF')
    expect(canonicalPrivatePath('/preview/MiXeD-Case-Token')).toBeNull()
  })

  // A prefix must match a whole segment, otherwise an unrelated public route that merely starts
  // with the same letters would be redirected into a private path that does not exist.
  test('only matches on a segment boundary', () => {
    for (const path of ['/administration', '/Administration', '/logins', '/previewer', '/checkouts']) {
      expect(canonicalPrivatePath(path)).toBeNull()
    }
  })

  test('never returns a value equal to its input, so it cannot loop', () => {
    for (const path of ['/Admin', '/aDmIn', '/Checkout/Success', '/Preview/Kept-As-Is']) {
      expect(canonicalPrivatePath(path)).not.toBe(path)
    }
  })
})
