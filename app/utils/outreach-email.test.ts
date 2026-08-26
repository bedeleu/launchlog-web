import { describe, expect, mock, test } from 'bun:test'
import { buildOutreachEmail, copyOutreachText, isSafePreviewUrl } from './outreach-email'

describe('buildOutreachEmail', () => {
  test('builds the exact private-preview template from public context', () => {
    const previewUrl = `https://launchlog.ai/preview/${'a'.repeat(64)}`

    expect(buildOutreachEmail({
      firstName: ' Maya ',
      appName: ' ShipFast ',
      sourceName: ' Product Hunt ',
      previewUrl: ` ${previewUrl} `,
    })).toEqual({
      subject: 'I made a LaunchLog preview for ShipFast',
      body: [
        'Hi Maya,',
        '',
        'I found ShipFast on Product Hunt and thought it would be a good fit for LaunchLog.',
        '',
        'I made a private preview so you can see how it would look:',
        previewUrl,
        '',
        'No listing has been published on LaunchLog. You can review it first and decide whether you want to publish.',
        '',
        'If this is not relevant, just let me know and I will not follow up.',
        '',
        'Alex',
        'LaunchLog.ai — The log of what just shipped.',
      ].join('\n'),
    })
  })

  test('omits optional personalization cleanly when no name or preview link is provided', () => {
    const email = buildOutreachEmail({
      firstName: ' ',
      appName: 'QuietKit',
      sourceName: 'Indie Hackers',
      previewUrl: '',
    })

    expect(email.subject).toBe('A LaunchLog idea for QuietKit')
    expect(email.body).toBe([
      'Hi,',
      '',
      'I found QuietKit on Indie Hackers and thought it would be a good fit for LaunchLog.',
      '',
      'No listing has been published on LaunchLog. I wanted to ask if you would like to see a private preview first.',
      '',
      'If this is not relevant, just let me know and I will not follow up.',
      '',
      'Alex',
      'LaunchLog.ai — The log of what just shipped.',
    ].join('\n'))
    expect(email.body).not.toContain('undefined')
  })

  test('requires the app and source names', () => {
    expect(() => buildOutreachEmail({ appName: '', sourceName: 'Product Hunt' }))
      .toThrow('App name is required.')
    expect(() => buildOutreachEmail({ appName: 'ShipFast', sourceName: ' ' }))
      .toThrow('Source platform is required.')
  })
})

describe('preview link and clipboard boundaries', () => {
  test('accepts only clean HTTPS preview links', () => {
    const token = 'aB3'.repeat(21) + 'z'
    const previewUrl = `https://launchlog.ai/preview/${token}`

    expect(token).toHaveLength(64)
    expect(isSafePreviewUrl(` ${previewUrl} `)).toBe(true)
    expect(isSafePreviewUrl(`http://launchlog.ai/preview/${token}`)).toBe(false)
    expect(isSafePreviewUrl(`https://user:pass@launchlog.ai/preview/${token}`)).toBe(false)
    expect(isSafePreviewUrl(`https://launchlog.ai/preview/${token}?email=hidden`)).toBe(false)
    expect(isSafePreviewUrl(`https://launchlog.ai/preview/${token}#details`)).toBe(false)
    expect(isSafePreviewUrl(`https://evil.example/preview/${token}`)).toBe(false)
    expect(isSafePreviewUrl('https://launchlog.ai/pricing')).toBe(false)
    expect(isSafePreviewUrl('https://launchlog.ai/preview/too-short')).toBe(false)
    expect(isSafePreviewUrl('not a url')).toBe(false)
  })

  test('writes the exact requested text through the injected clipboard boundary', async () => {
    const writeText = mock(async (_text: string) => undefined)

    await copyOutreachText('Subject line\n\nMessage body', { writeText })

    expect(writeText.mock.calls).toEqual([['Subject line\n\nMessage body']])
  })

  test('rejects empty copy attempts and propagates clipboard failures', async () => {
    const writeText = mock(async () => { throw new Error('Clipboard unavailable') })

    await expect(copyOutreachText(' ', { writeText })).rejects.toThrow('Nothing to copy.')
    await expect(copyOutreachText('Message', { writeText })).rejects.toThrow('Clipboard unavailable')
  })
})
