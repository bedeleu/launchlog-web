import { describe, expect, test } from 'bun:test'
import { resolvePreviewAuthAccess } from './preview-auth-access'

const never = new Promise<void>(() => {})

describe('preview auth access', () => {
  test('resolves an authenticated admin after Firebase restores the session', async () => {
    expect(await resolvePreviewAuthAccess({
      waitForAuthReady: async () => {},
      hasUser: () => true,
      isAdmin: async () => true,
      timeoutMs: 20,
    })).toEqual({ kind: 'ready', isAdmin: true })
  })

  test('resolves a customer when no Firebase user is signed in', async () => {
    expect(await resolvePreviewAuthAccess({
      waitForAuthReady: async () => {},
      hasUser: () => false,
      isAdmin: async () => true,
      timeoutMs: 20,
    })).toEqual({ kind: 'ready', isAdmin: false })
  })

  test('fails closed when Firebase never finishes restoring auth', async () => {
    expect(await resolvePreviewAuthAccess({
      waitForAuthReady: () => never,
      hasUser: () => true,
      isAdmin: async () => true,
      timeoutMs: 5,
    })).toEqual({ kind: 'unavailable', isAdmin: false })
  })

  test('fails closed when the claims lookup never settles', async () => {
    expect(await resolvePreviewAuthAccess({
      waitForAuthReady: async () => {},
      hasUser: () => true,
      isAdmin: () => never.then(() => true),
      timeoutMs: 5,
    })).toEqual({ kind: 'unavailable', isAdmin: false })
  })

  test('fails closed when Firebase rejects the auth check', async () => {
    expect(await resolvePreviewAuthAccess({
      waitForAuthReady: async () => {
        throw new Error('offline')
      },
      hasUser: () => true,
      isAdmin: async () => true,
      timeoutMs: 20,
    })).toEqual({ kind: 'unavailable', isAdmin: false })
  })
})
