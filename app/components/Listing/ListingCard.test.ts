import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('./ListingCard.vue', import.meta.url)), 'utf8')

describe('directory Featured typography', () => {
  test('keeps long names and descriptions useful inside the narrow text column', () => {
    expect(source).toContain("line-clamp-3 text-xl leading-6 tracking-tight 2xl:text-2xl 2xl:leading-7")
    expect(source).toContain("line-clamp-4 text-sm leading-6")
    expect(source).not.toContain("line-clamp-2 text-3xl leading-[1.1] tracking-tight")
  })
})
