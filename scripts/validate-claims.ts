import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'

interface ClaimPattern {
  pattern: RegExp
  message: string
}

export interface ClaimViolation {
  file: string
  line: number
  match: string
  message: string
}

const CLAIM_PATTERNS: ClaimPattern[] = [
  { pattern: /\bLaunchLog Premium\b/gi, message: 'Premium was retired by D-065' },
  { pattern: /\$?59\.99\b/g, message: 'Retired Premium price' },
  { pattern: /\$149(?:\.00)?\b/g, message: 'Retired Featured anchor price' },
  { pattern: /\bhuman[- ]reviewed\b/gi, message: 'Listings publish after checkout and are moderated post-publication' },
  { pattern: /not scraped or auto[- ]approved/gi, message: 'False moderation claim' },
  { pattern: /engineered to be cited/gi, message: 'Unsupported citation promise' },
  { pattern: /built to be cited/gi, message: 'Unsupported citation promise' },
  { pattern: /\bread and cite\b/gi, message: 'Unsupported citation promise' },
  { pattern: /\bcitable source\b/gi, message: 'Unsupported citation promise' },
  { pattern: /\bcite it accurately\b/gi, message: 'Unsupported citation promise' },
  { pattern: /format LLMs read best/gi, message: 'Unverified format preference claim' },
  { pattern: /credibility signal to (?:both )?users and search engines/gi, message: 'Unverified ranking or trust signal claim' },
  { pattern: /make your product citable/gi, message: 'Unsupported citation promise' },
  { pattern: /from submitted product to indexed launch profile/gi, message: 'Indexing cannot be guaranteed' },
  { pattern: /\bpermanent(?:ly)?[^\n]{0,40}(?:listing|product page)\b/gi, message: 'Listings remain live only while the subscription is active' },
  { pattern: /around 90% of web journeys/gi, message: 'Unattributed changing statistic' },
  { pattern: /\bbasic\s+(?:plan|package|listing)\b/gi, message: 'Standard is the customer-facing plan name' },
]

const SCAN_EXTENSIONS = new Set(['.md', '.ts', '.vue'])
const SCAN_PATHS = [
  'PRODUCT.md',
  'nuxt.config.ts',
  'app/app.vue',
  'app/pages',
  'app/components',
  'app/composables',
  'server/routes',
  'shared/constants',
]
const IGNORE_NAMES = new Set(['node_modules', '.nuxt', '.output', 'dist'])

const shouldSkipLine = (line: string): boolean =>
  /^\s*(?:\/\/|\/\*|\*|<!--)/.test(line)

export function scanClaimContent(content: string, file: string): ClaimViolation[] {
  const violations: ClaimViolation[] = []

  for (const [index, line] of content.split('\n').entries()) {
    if (shouldSkipLine(line)) continue

    for (const claim of CLAIM_PATTERNS) {
      claim.pattern.lastIndex = 0
      const match = claim.pattern.exec(line)

      if (match) {
        violations.push({
          file,
          line: index + 1,
          match: match[0],
          message: claim.message,
        })
      }
    }
  }

  return violations
}

function collectFiles(path: string): string[] {
  const stat = statSync(path)

  if (!stat.isDirectory()) {
    return SCAN_EXTENSIONS.has(extname(path)) ? [path] : []
  }

  return readdirSync(path).flatMap((name) => {
    if (IGNORE_NAMES.has(name) || name.endsWith('.test.ts')) return []

    return collectFiles(join(path, name))
  })
}

export function validatePublicClaims(root = process.cwd()): ClaimViolation[] {
  return SCAN_PATHS.flatMap((path) => {
    const absolutePath = join(root, path)

    return collectFiles(absolutePath).flatMap(file =>
      scanClaimContent(readFileSync(file, 'utf8'), relative(root, file)),
    )
  })
}

if (import.meta.main) {
  const violations = validatePublicClaims()

  if (violations.length > 0) {
    console.error(`Found ${violations.length} blocked public claim(s):`)
    for (const violation of violations) {
      console.error(`${violation.file}:${violation.line} — "${violation.match}" — ${violation.message}`)
    }
    process.exit(1)
  }

  console.log('Public claim gate passed.')
}
