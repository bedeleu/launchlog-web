import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('./login.vue', import.meta.url)), 'utf8')

describe('login authentication UI', () => {
  test('uses the official Google G asset instead of a homemade letter badge', () => {
    expect(source).toContain('src="/images/google-g.png"')
    expect(source).toContain('alt=""')
    expect(source).not.toContain('>G</span>')
  })

  test('routes Firebase failures through customer-facing messages', () => {
    expect(source).toContain('firebaseAuthErrorMessage')
    expect(source).not.toContain('toErrorLike')
    expect(source).not.toContain("message ?? 'Google sign-in failed.'")
  })
})
