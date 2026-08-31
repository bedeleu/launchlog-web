import { z } from 'zod'

const previewPath = /^\/preview\/([A-Za-z0-9]{64})$/
const singleLine = (message: string, max: number) => z.string()
  .trim()
  .min(1, message)
  .max(max, `Maximum ${max} characters.`)
  .refine(value => !/[\r\n]/.test(value), 'Use one line only.')

export interface OutreachPreviewReference {
  token: string
  url: string
}

export type OutreachPreviewVerification =
  | { ok: true }
  | { ok: false, message: string }

export const outreachSubjectVariants = ['preview', 'fit', 'source'] as const
export type OutreachSubjectVariant = typeof outreachSubjectVariants[number]

export interface OutreachSubjectOption {
  value: OutreachSubjectVariant
  label: string
  subject: string
}

export function parseOutreachPreviewUrl(value: string): OutreachPreviewReference | null {
  try {
    const candidate = value.trim()
    const url = new URL(candidate)
    const match = url.pathname.match(previewPath)

    if (url.origin !== 'https://launchlog.ai'
      || url.username !== ''
      || url.password !== ''
      || url.search !== ''
      || url.hash !== ''
      || match === null) {
      return null
    }

    const token = match[1]
    if (!token) return null

    const canonicalUrl = `https://launchlog.ai/preview/${token}`
    if (candidate !== canonicalUrl) return null

    return {
      token,
      url: canonicalUrl,
    }
  }
  catch {
    return null
  }
}

export function isSafePreviewUrl(value: string): boolean {
  return parseOutreachPreviewUrl(value) !== null
}

export function verifyOutreachPreview(
  preview: unknown,
  expectedToken: string,
  now = Date.now(),
): OutreachPreviewVerification {
  if (!preview || typeof preview !== 'object') {
    return { ok: false, message: 'The preview response did not match this link.' }
  }

  const candidate = preview as Record<string, unknown>
  if (candidate.token !== expectedToken) {
    return { ok: false, message: 'The preview response did not match this link.' }
  }
  if (candidate.status === 'expired') {
    return { ok: false, message: 'The preview has expired.' }
  }
  if (candidate.status !== 'ready') {
    return { ok: false, message: 'The preview is not ready yet.' }
  }
  if (typeof candidate.expires_at !== 'string') {
    return { ok: false, message: 'The preview expiry could not be verified.' }
  }

  const expiresAt = Date.parse(candidate.expires_at)
  if (!Number.isFinite(expiresAt)) {
    return { ok: false, message: 'The preview expiry could not be verified.' }
  }
  if (expiresAt <= now) {
    return { ok: false, message: 'The preview has expired.' }
  }

  return { ok: true }
}

export function shouldPreventOutreachEnterSubmit(tagName: string): boolean {
  return ['INPUT', 'SELECT'].includes(tagName.toUpperCase())
}

const previewUrlSchema = z.string().trim().max(2048).refine(
  value => value === '' || isSafePreviewUrl(value),
  'Paste a clean LaunchLog private preview URL.',
).transform((value) => {
  if (value === '') return ''
  return parseOutreachPreviewUrl(value)?.url ?? value
})

export const outreachContextSchema = z.object({
  recipientEmail: z.string().trim().email('Enter a valid recipient email.').max(255),
  firstName: z.string().trim().max(80).refine(value => !/[\r\n]/.test(value), 'Use one line only.'),
  productName: singleLine('Enter the product or app name.', 120),
  sourceName: singleLine('Enter where you found the product.', 120),
  previewUrl: previewUrlSchema,
})

export const outreachSendSchema = z.object({
  recipientEmail: z.string().trim().email('Enter a valid recipient email.').max(255),
  subject: singleLine('Enter a subject.', 200),
  text: z.string().max(5000, 'Maximum 5,000 characters.').refine(
    value => /\S/u.test(value),
    'Enter the email message.',
  ),
})

export type OutreachContext = z.infer<typeof outreachContextSchema>
export type OutreachSendFields = z.infer<typeof outreachSendSchema>

export interface OutreachDraft {
  subject: string
  text: string
}

export function buildOutreachSubjectOptions(context: OutreachContext): OutreachSubjectOption[] {
  const preview = context.previewUrl ? parseOutreachPreviewUrl(context.previewUrl) : null
  const hasPreview = preview?.url === context.previewUrl

  return [
    {
      value: 'preview',
      label: 'Private preview',
      subject: hasPreview
        ? `Your private LaunchLog preview for ${context.productName}`
        : `A LaunchLog idea for ${context.productName}`,
    },
    {
      value: 'fit',
      label: 'Product fit',
      subject: hasPreview
        ? `${context.productName} on LaunchLog — private preview`
        : `${context.productName} could be a fit for LaunchLog`,
    },
    {
      value: 'source',
      label: 'Discovery source',
      subject: hasPreview
        ? `I prepared a LaunchLog preview for ${context.productName}`
        : `Found ${context.productName} on ${context.sourceName}`,
    },
  ]
}

export function buildOutreachDraft(
  context: OutreachContext,
  variant: OutreachSubjectVariant = 'preview',
): OutreachDraft {
  const greeting = `Hi${context.firstName ? ` ${context.firstName}` : ''},`
  const preview = context.previewUrl ? parseOutreachPreviewUrl(context.previewUrl) : null
  const subject = buildOutreachSubjectOptions(context)
    .find(option => option.value === variant)?.subject
  if (!subject) throw new Error('Invalid outreach subject variant')

  if (preview) {
    return {
      subject,
      text: [
        greeting,
        '',
        `I came across ${context.productName} on ${context.sourceName} and prepared a private, unpublished preview of how it could look in the LaunchLog catalog.`,
        '',
        'View the private preview:',
        preview.url,
        '',
        "Nothing has been published. If you'd like to claim it or adjust anything, just reply and I'll help.",
        '',
        'If this isn\'t relevant, reply "no" and I won\'t follow up.',
        '',
        'Alex',
        'LaunchLog.ai — The log of what just shipped.',
        'AB Solutions',
      ].join('\n'),
    }
  }

  return {
    subject,
    text: [
      greeting,
      '',
      `I found ${context.productName} on ${context.sourceName} and thought it would be a good fit for LaunchLog.`,
      '',
      'Nothing has been published. Would you like me to make a private preview first?',
      '',
      'If this is not relevant, just let me know and I will not follow up.',
      '',
      'Alex',
      'LaunchLog.ai — The log of what just shipped.',
      'AB Solutions',
    ].join('\n'),
  }
}
