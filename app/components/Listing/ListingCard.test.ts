import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('./ListingCard.vue', import.meta.url)), 'utf8')
const fallback = readFileSync(fileURLToPath(new URL('./ListingShotFallback.vue', import.meta.url)), 'utf8')

describe('directory Featured typography', () => {
  test('keeps long names and descriptions useful inside the narrow text column', () => {
    expect(source).toContain('line-clamp-3 text-xl leading-6 tracking-[-0.025em] 2xl:text-2xl 2xl:leading-7')
    expect(source).toContain('line-clamp-4 text-sm leading-6')
    expect(source).not.toContain('line-clamp-2 text-3xl leading-[1.1] tracking-tight')
  })
})

describe('release cover material', () => {
  test('is a square-cornered plate, not a rounded shadow card', () => {
    expect(source).not.toContain('rounded-xl')
    expect(source).not.toContain('rounded-full')
    expect(source).not.toContain('shadow-')
    expect(source).not.toContain('backdrop-blur')
  })

  test('carries no retired AI visual language', () => {
    expect(source).not.toContain('linear-gradient')
    expect(source).not.toMatch(/violet|purple|indigo|mauve/i)
    expect(fallback).not.toContain('linear-gradient')
    expect(fallback).not.toMatch(/violet|purple|indigo|mauve/i)
  })

  test('uses the Release Catalog materials instead of the brand-* compatibility aliases', () => {
    expect(source).toContain('border-release-seam')
    expect(source).toContain('bg-release-rail')
    expect(source).toContain('text-release-paper-muted')
    expect(source).not.toContain('brand-')
    expect(source).not.toContain('border-white/')
    expect(source).not.toContain('bg-white/[')
    expect(fallback).not.toContain('brand-')
  })

  test('keeps a stable capture frame without cropping Featured evidence', () => {
    expect(source).toContain('aspect-[16/10]')
    expect(source).toContain('loading="lazy"')
    expect(source).toContain('width="960"')
    expect(source).toContain('height="600"')
    expect(source).toContain("isPriorityPlacement.value || props.listing.tier === 'featured'")
    expect(source).toContain("? 'object-contain object-top'")
    expect(source).not.toContain("isDirectorySpotlight ? 'absolute inset-0'")
  })

  test('stays link-free so the grid keeps owning the anchor', () => {
    expect(source).not.toContain('<a ')
    expect(source).not.toContain('NuxtLink')
  })
})

describe('directory Featured row balance', () => {
  test('keeps the Featured capture content-driven at the horizontal breakpoint', () => {
    expect(source).toContain('lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]')
    expect(source).toContain('lg:aspect-[16/10] lg:h-auto lg:self-start')
    expect(source).not.toContain('lg:aspect-auto lg:h-full lg:border-b-0 lg:border-r')
    expect(source).toContain('gap-3 p-5 lg:gap-2 lg:justify-center lg:p-4 2xl:gap-2 2xl:p-5')
    expect(source).toContain('line-clamp-4 text-sm leading-6 lg:leading-5 2xl:leading-6')
  })

  test('compacts the directory companion without cropping its capture', () => {
    expect(source).toContain("const isDirectoryCompanion = computed(() => props.variant === 'directory-companion')")
    expect(source).toContain('border-b lg:aspect-[16/10]')
    expect(source).not.toContain('lg:aspect-video')
    expect(source).toContain('isDirectoryCompanion.value || isPriorityPlacement.value')
    expect(source).toContain('gap-2 p-4 lg:gap-1 lg:p-2')
    expect(source).toContain('line-clamp-2 text-sm leading-6 lg:line-clamp-1 lg:leading-5')
    expect(source).toContain("isDirectoryCompanion.value ? 'lg:pt-1.5 lg:leading-4' : ''")
  })
})

describe('ledger register', () => {
  test('closes the cover on a perforated rule', () => {
    expect(source).toContain('border-t border-dashed')
  })

  test('prints the tier as a register word, never as a pill', () => {
    expect(source).toContain('{{ listing.tier }}')
    expect(source).not.toContain('Paid placement')
    expect(source).toContain('Priority placement')
  })

  test('prints the real listing date as the edition marker', () => {
    expect(source).toContain('releaseEdition')
    expect(source).toContain('listing.published_at')
    // The edition marker is a date LaunchLog actually holds, not an invented
    // catalog number or barcode borrowed from the approved comp.
    expect(source).not.toMatch(/LL-\d{4}-\d{4}/)
  })
})

describe('Featured obi band', () => {
  test('is a warm paper strip, so the tier reads from material and structure', () => {
    expect(source).toContain('bg-release-paper')
    expect(source).toContain('text-release-ink')
  })

  test('never reclaims the blaze accent the directory reserves for action', () => {
    expect(source).not.toContain('release-blaze')
  })
})

describe('missing capture fallback', () => {
  test('is quiet catalog stock with no colour wash and no tinted mark', () => {
    expect(fallback).not.toContain('rounded-xl')
    expect(fallback).not.toContain('shadow-')
    expect(fallback).toContain('bg-release-ink')
    expect(fallback).toContain('border-dashed')
  })

  test('uses the same capture vocabulary as the Release primitives', () => {
    expect(fallback).toContain('Capture in progress')
    expect(fallback).toContain('Website capture unavailable')
  })
})

describe('obi responsive split', () => {
  test('splits into two columns only where the card is actually wide enough', () => {
    // The directory Featured card becomes double-width at lg; the homepage
    // spotlight at md. Splitting at sm stranded a three-line register beside a
    // one-line descriptor on a single-column card at 768.
    expect(source).toContain('md:flex-row md:items-baseline md:justify-between md:gap-x-4')
    expect(source).toContain('lg:flex-row lg:items-baseline lg:justify-between lg:gap-x-4')
    expect(source).not.toContain('sm:flex-row sm:items-baseline sm:justify-between sm:gap-x-4')
  })
})
