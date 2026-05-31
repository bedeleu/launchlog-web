// app/composables/useFaqSchema.ts
// Injects FAQPage JSON-LD from a list of Q/A pairs. Call inside <script setup>.
export function useFaqSchema(faqs: Array<{ q: string; a: string }>, key = 'faq') {
  useHead({
    script: [
      {
        key,
        type: 'application/ld+json',
        innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqs.map((f) => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a },
          })),
        }),
      },
    ],
  })
}
