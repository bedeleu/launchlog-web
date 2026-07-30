// Narrow shape for values caught from $fetch/Firebase rejections.
// It only normalizes an unknown caught value so existing fallback chains keep
// their exact order — it must never log, translate, mutate, or mask errors.
export interface ErrorLike {
  data?: {
    message?: string
    error?: string
  }
  message?: string
}

export function toErrorLike(error: unknown): ErrorLike {
  return typeof error === 'object' && error !== null ? error as ErrorLike : {}
}
