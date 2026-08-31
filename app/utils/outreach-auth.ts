const authorizationStatuses = new Set([401, 403])

export class OutreachAuthorizationError extends Error {
  constructor() {
    super('Not authenticated')
    this.name = 'OutreachAuthorizationError'
  }
}

export const isOutreachAuthorizationError = (error: unknown): boolean => (
  error instanceof OutreachAuthorizationError
  || (error instanceof Error && error.name === 'OutreachAuthorizationError')
)

export const normalizeOutreachAuthorizationError = (error: unknown): unknown => {
  if (!error || typeof error !== 'object') return error

  const candidate = error as {
    status?: unknown
    statusCode?: unknown
    response?: { status?: unknown }
  }
  const status = candidate.response?.status ?? candidate.statusCode ?? candidate.status

  return typeof status === 'number' && authorizationStatuses.has(status)
    ? new OutreachAuthorizationError()
    : error
}

export interface OutreachAuthorizationGuardOptions {
  clearSensitive: () => void
  currentPath: () => string
  redirectToLogin: (location: string) => Promise<void>
}

export interface OutreachAuthorizationGuard {
  handleAuthorizationLoss: () => Promise<void>
  handleAuthStateChange: (current: unknown, previous: unknown) => void
}

export const createOutreachAuthorizationGuard = (
  options: OutreachAuthorizationGuardOptions,
): OutreachAuthorizationGuard => {
  let redirecting = false

  const handleAuthorizationLoss = async (): Promise<void> => {
    if (redirecting) return
    redirecting = true
    options.clearSensitive()

    try {
      const path = options.currentPath()
      await options.redirectToLogin(`/login?redirect=${encodeURIComponent(path)}`)
    }
    finally {
      redirecting = false
    }
  }

  const handleAuthStateChange = (current: unknown, previous: unknown): void => {
    if (previous !== null && previous !== undefined && current === null) {
      void handleAuthorizationLoss()
    }
  }

  return { handleAuthorizationLoss, handleAuthStateChange }
}
