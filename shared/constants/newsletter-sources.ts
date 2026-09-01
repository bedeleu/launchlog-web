export const NEWSLETTER_SOURCES = [
  'homepage',
  'shipped_archive',
  'shipped_edition',
] as const

export type NewsletterSource = typeof NEWSLETTER_SOURCES[number]
