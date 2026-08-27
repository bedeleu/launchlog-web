import { describe, expect, test } from 'bun:test'
import {
  buildOutreachDraft,
  isSafePreviewUrl,
  outreachContextSchema,
  outreachSendSchema,
} from './outreach-template'

describe('minimal outreach draft', () => {
  test('builds the exact preview email after trimming context', () => {
    const previewUrl = `https://launchlog.ai/preview/${'aB3z'.repeat(16)}`
    const context = outreachContextSchema.parse({
      recipientEmail: ' founder@example.com ',
      firstName: ' Maya ',
      productName: ' ShipFast ',
      sourceName: ' Product Hunt ',
      previewUrl: ` ${previewUrl} `,
    })

    expect(buildOutreachDraft(context)).toEqual({
      subject: 'I made a LaunchLog preview for ShipFast',
      text: [
        'Hi Maya,',
        '',
        'I found ShipFast on Product Hunt and thought it would be a good fit for LaunchLog.',
        '',
        'I made a private preview so you can see how it would look:',
        previewUrl,
        '',
        'Nothing has been published. You can review it first and decide whether you want to publish.',
        '',
        'If this is not relevant, just let me know and I will not follow up.',
        '',
        'Alex',
        'LaunchLog.ai — The log of what just shipped.',
      ].join('\n'),
    })
  })

  test('uses a neutral greeting and preview question when optional fields are empty', () => {
    const context = outreachContextSchema.parse({
      recipientEmail: 'founder@example.com',
      firstName: '',
      productName: 'QuietKit',
      sourceName: 'Indie Hackers',
      previewUrl: '',
    })

    expect(buildOutreachDraft(context)).toEqual({
      subject: 'A LaunchLog idea for QuietKit',
      text: [
        'Hi,',
        '',
        'I found QuietKit on Indie Hackers and thought it would be a good fit for LaunchLog.',
        '',
        'Nothing has been published. Would you like me to make a private preview first?',
        '',
        'If this is not relevant, just let me know and I will not follow up.',
        '',
        'Alex',
        'LaunchLog.ai — The log of what just shipped.',
      ].join('\n'),
    })
  })

  test('accepts only a clean LaunchLog preview URL with a 64-character token', () => {
    const token = 'aB3z'.repeat(16)
    expect(isSafePreviewUrl(`https://launchlog.ai/preview/${token}`)).toBe(true)
    expect(isSafePreviewUrl(`http://launchlog.ai/preview/${token}`)).toBe(false)
    expect(isSafePreviewUrl(`https://launchlog.ai/preview/${token}?email=x`)).toBe(false)
    expect(isSafePreviewUrl(`https://evil.test/preview/${token}`)).toBe(false)
    expect(isSafePreviewUrl('not-a-url')).toBe(false)
  })

  test('rejects invalid context and unsafe final send fields', () => {
    expect(outreachContextSchema.safeParse({
      recipientEmail: 'bad',
      firstName: '',
      productName: "Ship\nFast",
      sourceName: '',
      previewUrl: '',
    }).success).toBe(false)

    expect(outreachSendSchema.safeParse({
      recipientEmail: 'founder@example.com',
      subject: "Hello\nBcc: victim@example.com",
      text: 'Body',
    }).success).toBe(false)

    expect(outreachSendSchema.safeParse({
      recipientEmail: 'founder@example.com',
      subject: 'Hello',
      text: '   ',
    }).success).toBe(false)
  })
})
