import { describe, expect, test } from 'bun:test'

const component = (name: string) => Bun.file(new URL(name, import.meta.url)).text()

describe('Release Catalog reading shell', () => {
  test('owns one page heading, a restrained measure, and no operational rail', async () => {
    const source = await component('./ReadingShell.vue')

    expect(source.match(/<h1/g)?.length).toBe(1)
    expect(source).toContain('max-w-5xl')
    expect(source).toContain('max-w-3xl')
    expect(source).not.toContain('ReleaseActionRail')
    expect(source).not.toMatch(/violet|purple|indigo|mauve|linear-gradient/i)
  })

  test('keeps long-form links visibly authored and keyboard discoverable', async () => {
    const css = await Bun.file(new URL('../../assets/css/tailwind.css', import.meta.url)).text()

    expect(css).toContain('.reading-prose a')
    expect(css).toContain('.reading-prose a:focus-visible')
    expect(css).toContain('outline: 2px solid var(--release-focus)')
  })

  test('keeps the operator, public mailbox, legal routes, and status route in the footer', async () => {
    const footer = await Bun.file(new URL('../Footer.vue', import.meta.url)).text()

    expect(footer).toContain('SITE_IDENTITY.publicEmail')
    expect(footer).toContain('legalName')
    for (const route of ['/privacy', '/terms', '/cookies', '/dmca', '/status']) {
      expect(footer).toContain(`to: '${route}'`)
    }
  })

  test('keeps footer links on a minimum 24px touch target', async () => {
    const footer = await Bun.file(new URL('../Footer.vue', import.meta.url)).text()

    expect(footer).toContain('class="mt-6 inline-flex min-h-6 items-center')
    expect(footer).toContain('class="inline-flex min-h-6 min-w-6 items-center justify-center')
    expect(footer).toContain('class="inline-flex min-h-6 items-center text-sm')
    expect(footer.match(/class="inline-flex min-h-6 items-center font-mono/g) ?? []).toHaveLength(3)
  })
})
