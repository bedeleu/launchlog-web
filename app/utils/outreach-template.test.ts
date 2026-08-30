import { describe, expect, test } from 'bun:test'
import type { OutreachContext } from './outreach-template'
import * as outreachTemplate from './outreach-template'
import {
  buildOutreachDraft,
  isSafePreviewUrl,
  outreachContextSchema,
  outreachSendSchema,
  parseOutreachPreviewUrl,
  shouldPreventOutreachEnterSubmit,
  verifyOutreachPreview,
} from './outreach-template'

type SubjectOption = {
  value: 'preview' | 'fit' | 'source'
  label: string
  subject: string
}

type SubjectContract = {
  outreachSubjectVariants?: readonly string[]
  buildOutreachSubjectOptions?: (context: OutreachContext) => SubjectOption[]
}

const subjectContract = outreachTemplate as SubjectContract
const outreachSubjectVariants = subjectContract.outreachSubjectVariants ?? []
const buildOutreachSubjectOptions = (context: OutreachContext): SubjectOption[] => {
  expect(subjectContract.buildOutreachSubjectOptions).toBeFunction()
  return subjectContract.buildOutreachSubjectOptions?.(context) ?? []
}

describe('minimal outreach draft', () => {
  test('offers the three exact deterministic subjects without leaking the greeting name', () => {
    const previewUrl = `https://launchlog.ai/preview/${'aB3z'.repeat(16)}`
    const context = outreachContextSchema.parse({
      recipientEmail: ' founder@example.com ',
      firstName: ' Maya ',
      productName: ' ShipFast ',
      sourceName: ' Product Hunt ',
      previewUrl: ` ${previewUrl} `,
    })

    expect(outreachSubjectVariants).toEqual(['preview', 'fit', 'source'])
    expect(buildOutreachSubjectOptions(context)).toEqual([
      {
        value: 'preview',
        label: 'Private preview',
        subject: 'I made a private LaunchLog preview for ShipFast',
      },
      {
        value: 'fit',
        label: 'Product fit',
        subject: 'ShipFast could be a fit for LaunchLog',
      },
      {
        value: 'source',
        label: 'Discovery source',
        subject: 'Found ShipFast on Product Hunt',
      },
    ])
    expect(buildOutreachSubjectOptions(context).map(option => option.subject)).not.toContain('Maya')
  })

  test('builds the exact preview email with the required operator footer', () => {
    const previewUrl = `https://launchlog.ai/preview/${'aB3z'.repeat(16)}`
    const context = outreachContextSchema.parse({
      recipientEmail: 'founder@example.com',
      firstName: 'Maya',
      productName: 'ShipFast',
      sourceName: 'Product Hunt',
      previewUrl,
    })

    const draft = buildOutreachDraft(context, 'preview')

    expect(draft).toEqual({
      subject: 'I made a private LaunchLog preview for ShipFast',
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
        'AB Solutions SRL · Timișoara, Romania',
      ].join('\n'),
    })
    expect(draft.text).not.toMatch(/street|strada|postal/i)
  })

  test('uses the fallback preview subject and supports fit and source choices without a preview', () => {
    const context = outreachContextSchema.parse({
      recipientEmail: 'founder@example.com',
      firstName: '',
      productName: 'QuietKit',
      sourceName: 'Indie Hackers',
      previewUrl: '',
    })

    expect(buildOutreachSubjectOptions(context)).toEqual([
      { value: 'preview', label: 'Private preview', subject: 'A LaunchLog idea for QuietKit' },
      { value: 'fit', label: 'Product fit', subject: 'QuietKit could be a fit for LaunchLog' },
      { value: 'source', label: 'Discovery source', subject: 'Found QuietKit on Indie Hackers' },
    ])
    expect(buildOutreachDraft(context, 'fit').subject).toBe('QuietKit could be a fit for LaunchLog')
    expect(buildOutreachDraft(context, 'source').subject).toBe('Found QuietKit on Indie Hackers')
    expect(buildOutreachDraft(context, 'preview')).toEqual({
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
        'AB Solutions SRL · Timișoara, Romania',
      ].join('\n'),
    })
  })

  test('extracts and canonicalizes only a clean LaunchLog preview URL with a 64-character token', () => {
    const token = 'aB3z'.repeat(16)
    const canonical = `https://launchlog.ai/preview/${token}`

    expect(parseOutreachPreviewUrl(canonical)).toEqual({ token, url: canonical })
    expect(parseOutreachPreviewUrl(` https://launchlog.ai/path/../preview/${token} `)).toBeNull()
    expect(isSafePreviewUrl(`https://launchlog.ai/preview/${token}`)).toBe(true)
    expect(isSafePreviewUrl(`http://launchlog.ai/preview/${token}`)).toBe(false)
    expect(isSafePreviewUrl(`https://launchlog.ai/preview/${token}?email=x`)).toBe(false)
    expect(isSafePreviewUrl(`https://evil.test/preview/${token}`)).toBe(false)
    expect(isSafePreviewUrl('not-a-url')).toBe(false)

    const parsed = outreachContextSchema.parse({
      recipientEmail: 'founder@example.com',
      firstName: '',
      productName: 'QuietKit',
      sourceName: 'Uneed',
      previewUrl: ` ${canonical} `,
    })
    expect(parsed.previewUrl).toBe(canonical)
  })

  test('accepts only the matching ready and non-expired preview response', () => {
    const token = 'p'.repeat(64)
    const now = Date.parse('2026-08-30T12:00:00Z')

    expect(verifyOutreachPreview({
      token,
      status: 'ready',
      expires_at: '2026-09-06T12:00:00Z',
    }, token, now)).toEqual({ ok: true })

    expect(verifyOutreachPreview({
      token: 'q'.repeat(64),
      status: 'ready',
      expires_at: '2026-09-06T12:00:00Z',
    }, token, now)).toEqual({
      ok: false,
      message: 'The preview response did not match this link.',
    })

    expect(verifyOutreachPreview({
      token,
      status: 'generating',
      expires_at: '2026-09-06T12:00:00Z',
    }, token, now)).toEqual({
      ok: false,
      message: 'The preview is not ready yet.',
    })

    expect(verifyOutreachPreview({
      token,
      status: 'failed',
      expires_at: '2026-09-06T12:00:00Z',
    }, token, now)).toEqual({
      ok: false,
      message: 'The preview is not ready yet.',
    })

    expect(verifyOutreachPreview(null, token, now)).toEqual({
      ok: false,
      message: 'The preview response did not match this link.',
    })

    expect(verifyOutreachPreview({
      token,
      status: 'ready',
      expires_at: '2026-08-30T11:59:59Z',
    }, token, now)).toEqual({
      ok: false,
      message: 'The preview has expired.',
    })

    expect(verifyOutreachPreview({
      token,
      status: 'ready',
      expires_at: null,
    }, token, now)).toEqual({
      ok: false,
      message: 'The preview expiry could not be verified.',
    })
  })

  test('prevents Enter submission from single-line controls only', () => {
    expect(shouldPreventOutreachEnterSubmit('INPUT')).toBe(true)
    expect(shouldPreventOutreachEnterSubmit('SELECT')).toBe(true)
    expect(shouldPreventOutreachEnterSubmit('TEXTAREA')).toBe(false)
    expect(shouldPreventOutreachEnterSubmit('BUTTON')).toBe(false)
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
