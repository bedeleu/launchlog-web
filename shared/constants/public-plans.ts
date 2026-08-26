export type PlanTier = 'basic' | 'featured'

export interface PublicPlan {
  tier: PlanTier
  name: string
  annualPriceCents: number
  currency: 'USD'
  priceLabel: string
  monthlyLabel: string
  features: readonly string[]
  badge?: string
  highlight?: boolean
}

// D-065 is the commercial decision of record. All public web and machine-readable
// surfaces import these values so retired plans and prices cannot drift back in.
export const PUBLIC_PLANS: readonly PublicPlan[] = [
  {
    tier: 'basic',
    name: 'Standard',
    annualPriceCents: 2499,
    currency: 'USD',
    priceLabel: '$24.99',
    monthlyLabel: '$2.08',
    features: [
      'Standard listing card in the directory',
      'Real website screenshot',
      'Dedicated listing page with a direct link to your site',
      'schema.org structured data, Markdown and llms.txt surfaces',
      'Included in the sitemap and submitted via IndexNow',
      'Listed for a full year while your subscription is active',
    ],
  },
  {
    tier: 'featured',
    name: 'Featured',
    annualPriceCents: 9900,
    currency: 'USD',
    priceLabel: '$99',
    monthlyLabel: '$8.25',
    badge: 'Priority placement',
    highlight: true,
    features: [
      'Everything in Standard',
      'Editorial double-width Featured card on directory pages',
      'Featured before Standard within the same directory page',
      'Eligible for one of up to three homepage Featured slots',
      'Included on the Featured page',
      'Order among Featured listings is re-seeded daily',
    ],
  },
] as const

export const findPublicPlan = (tier: string | null | undefined): PublicPlan =>
  PUBLIC_PLANS.find(plan => plan.tier === tier) ?? PUBLIC_PLANS[0]!

export const annualPrice = (plan: PublicPlan): string =>
  (plan.annualPriceCents / 100).toFixed(2)
