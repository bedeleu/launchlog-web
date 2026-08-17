export type PlanTier = 'basic' | 'premium' | 'featured'

export interface Plan {
  tier: PlanTier
  name: string
  /** Annual price, e.g. "$24.99". */
  priceLabel: string
  /** Optional crossed-out anchor price. */
  compareAtLabel?: string
  /** Monthly equivalent, e.g. "$2.08". */
  monthlyLabel: string
  features: string[]
  /** Short marketing badge, e.g. "Best visibility". */
  badge?: string
  /** The hero/most-valuable tier. */
  highlight?: boolean
}

// Pricing per D-058 (annual, USD). Monthly = annual / 12, for the "just $X/mo" framing.
const PLANS: Plan[] = [
  {
    tier: 'basic',
    name: 'Basic',
    priceLabel: '$24.99',
    monthlyLabel: '$2.08',
    features: [
      'Standard card in the directory',
      'Real website screenshot',
      'Included in sitemap, llms.txt and Markdown',
      'schema.org structured data',
      'Listed for a full year while your subscription is active',
    ],
  },
  {
    tier: 'premium',
    name: 'Premium',
    priceLabel: '$59.99',
    monthlyLabel: '$5.00',
    badge: 'Priority placement',
    features: [
      'Everything in Basic',
      'Double-width priority card in browse and category results',
      'Placed above the Basic listings on the same directory page',
      'Order among Premium listings is re-seeded daily',
      'Listed for a full year while your subscription is active',
    ],
  },
  {
    tier: 'featured',
    name: 'Featured',
    priceLabel: '$99',
    compareAtLabel: '$149',
    monthlyLabel: '$8.25',
    badge: 'Best value',
    highlight: true,
    features: [
      'Everything in Premium',
      'Editorial spotlight card, first on eligible browse and category pages',
      'Eligible for one of up to three Homepage Featured slots',
      'Dedicated Featured badge',
      'Launch discount from $149',
    ],
  },
]

export const usePlans = () => {
  const findPlan = (tier: string | null | undefined): Plan =>
    PLANS.find(p => p.tier === tier) ?? PLANS[1]!

  return { plans: PLANS, findPlan }
}
