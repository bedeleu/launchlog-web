export interface OutreachEmailInput {
  firstName?: string
  appName: string
  sourceName: string
  previewUrl?: string
}

export interface OutreachEmailDraft {
  subject: string
  body: string
}

export interface ClipboardWriter {
  writeText: (text: string) => Promise<void>
}

const LAUNCHLOG_PREVIEW_ORIGIN = 'https://launchlog.ai'
const LAUNCHLOG_PREVIEW_PATH = /^\/preview\/[A-Za-z0-9]{64}$/

export function isSafePreviewUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())

    return url.origin === LAUNCHLOG_PREVIEW_ORIGIN
      && url.username === ''
      && url.password === ''
      && url.search === ''
      && url.hash === ''
      && LAUNCHLOG_PREVIEW_PATH.test(url.pathname)
  }
  catch {
    return false
  }
}

export function buildOutreachEmail(input: OutreachEmailInput): OutreachEmailDraft {
  const firstName = input.firstName?.trim() ?? ''
  const appName = input.appName.trim()
  const sourceName = input.sourceName.trim()
  const previewUrl = input.previewUrl?.trim() ?? ''

  if (!appName) throw new Error('App name is required.')
  if (!sourceName) throw new Error('Source platform is required.')
  if (previewUrl && !isSafePreviewUrl(previewUrl)) {
    throw new Error('Preview link must be a clean HTTPS URL.')
  }

  const subject = previewUrl
    ? `I made a LaunchLog preview for ${appName}`
    : `A LaunchLog idea for ${appName}`

  const body = previewUrl
    ? [
        `Hi${firstName ? ` ${firstName}` : ''},`,
        '',
        `I found ${appName} on ${sourceName} and thought it would be a good fit for LaunchLog.`,
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
      ]
    : [
        `Hi${firstName ? ` ${firstName}` : ''},`,
        '',
        `I found ${appName} on ${sourceName} and thought it would be a good fit for LaunchLog.`,
        '',
        'No listing has been published on LaunchLog. I wanted to ask if you would like to see a private preview first.',
        '',
        'If this is not relevant, just let me know and I will not follow up.',
        '',
        'Alex',
        'LaunchLog.ai — The log of what just shipped.',
      ]

  return { subject, body: body.join('\n') }
}

export async function copyOutreachText(text: string, clipboard: ClipboardWriter): Promise<void> {
  if (!text.trim()) throw new Error('Nothing to copy.')

  await clipboard.writeText(text)
}
