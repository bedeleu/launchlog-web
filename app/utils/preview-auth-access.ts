interface PreviewAuthAccessInput {
  waitForAuthReady: () => Promise<void>
  hasUser: () => boolean
  isAdmin: () => Promise<boolean>
  timeoutMs?: number
}

interface PreviewAuthAccessResult {
  kind: 'ready' | 'unavailable'
  isAdmin: boolean
}

export const PREVIEW_AUTH_TIMEOUT_MS = 8_000

const beforeDeadline = async <T>(operation: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeout: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('preview_auth_timeout')), timeoutMs)
      }),
    ])
  }
  finally {
    if (timeout) clearTimeout(timeout)
  }
}

export const resolvePreviewAuthAccess = async ({
  waitForAuthReady,
  hasUser,
  isAdmin,
  timeoutMs = PREVIEW_AUTH_TIMEOUT_MS,
}: PreviewAuthAccessInput): Promise<PreviewAuthAccessResult> => {
  try {
    const admin = await beforeDeadline((async () => {
      await waitForAuthReady()
      return hasUser() ? await isAdmin() : false
    })(), timeoutMs)

    return { kind: 'ready', isAdmin: admin }
  }
  catch {
    return { kind: 'unavailable', isAdmin: false }
  }
}
