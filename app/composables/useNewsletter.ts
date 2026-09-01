import type { NewsletterSource } from '#shared/constants/newsletter-sources'

type Fetcher = (url: string, options?: Record<string, unknown>) => Promise<unknown>

const NEWSLETTER_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeNewsletterEmail(value: string): string | null {
  const email = value.trim().toLowerCase()

  if (!email || email.length > 254 || !NEWSLETTER_EMAIL.test(email)) return null
  return email
}

export function createNewsletterClient(fetcher: Fetcher, apiUrl: string) {
  const base = apiUrl.replace(/\/+$/, '')

  return {
    async capability(): Promise<boolean> {
      try {
        const response = await fetcher(
          `${base}/api/v1/newsletter/capability`,
          { timeout: 5000 },
        )

        return typeof response === 'object'
          && response !== null
          && !Array.isArray(response)
          && (response as Record<string, unknown>).enabled === true
      }
      catch {
        return false
      }
    },

    async subscribe(email: string, source: NewsletterSource): Promise<void> {
      await fetcher(`${base}/api/v1/newsletter/subscriptions`, {
        method: 'POST',
        body: { email, source },
        timeout: 8000,
      })
    },
  }
}

export function useNewsletter() {
  const apiUrl = useRuntimeConfig().public.apiUrl as string
  return createNewsletterClient($fetch as unknown as Fetcher, apiUrl)
}
