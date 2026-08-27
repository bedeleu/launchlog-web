import { z } from 'zod'

const previewPath = /^\/preview\/[A-Za-z0-9]{64}$/
const singleLine = (message: string, max: number) => z.string()
  .trim()
  .min(1, message)
  .max(max, `Maximum ${max} characters.`)
  .refine(value => !/[\r\n]/.test(value), 'Use one line only.')

export function isSafePreviewUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())

    return url.origin === 'https://launchlog.ai'
      && url.username === ''
      && url.password === ''
      && url.search === ''
      && url.hash === ''
      && previewPath.test(url.pathname)
  }
  catch {
    return false
  }
}

export const outreachContextSchema = z.object({
  recipientEmail: z.string().trim().email('Enter a valid recipient email.').max(255),
  firstName: z.string().trim().max(80).refine(value => !/[\r\n]/.test(value), 'Use one line only.'),
  productName: singleLine('Enter the product or app name.', 120),
  sourceName: singleLine('Enter where you found the product.', 120),
  previewUrl: z.string().trim().max(2048).refine(
    value => value === '' || isSafePreviewUrl(value),
    'Paste a clean LaunchLog private preview URL.',
  ),
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

export function buildOutreachDraft(context: OutreachContext): OutreachDraft {
  const greeting = `Hi${context.firstName ? ` ${context.firstName}` : ''},`
  const common = [
    greeting,
    '',
    `I found ${context.productName} on ${context.sourceName} and thought it would be a good fit for LaunchLog.`,
    '',
  ]

  if (context.previewUrl) {
    return {
      subject: `I made a LaunchLog preview for ${context.productName}`,
      text: [
        ...common,
        'I made a private preview so you can see how it would look:',
        context.previewUrl,
        '',
        'Nothing has been published. You can review it first and decide whether you want to publish.',
        '',
        'If this is not relevant, just let me know and I will not follow up.',
        '',
        'Alex',
        'LaunchLog.ai — The log of what just shipped.',
      ].join('\n'),
    }
  }

  return {
    subject: `A LaunchLog idea for ${context.productName}`,
    text: [
      ...common,
      'Nothing has been published. Would you like me to make a private preview first?',
      '',
      'If this is not relevant, just let me know and I will not follow up.',
      '',
      'Alex',
      'LaunchLog.ai — The log of what just shipped.',
    ].join('\n'),
  }
}
