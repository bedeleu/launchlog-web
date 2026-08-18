// app/composables/useBreadcrumbs.ts
// Injects BreadcrumbList JSON-LD. Call inside <script setup> of a page.
export function useBreadcrumbs(trail: Array<{ name: string; path: string }>) {
  const config = useRuntimeConfig()
  const site = `https://${config.public.domain || 'launchlog.ai'}`
  useHead({
    script: [
      {
        key: 'breadcrumbs',
        type: 'application/ld+json',
        innerHTML: serializeJsonLd({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: trail.map((t, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: t.name,
            item: `${site}${t.path}`,
          })),
        }),
      },
    ],
  })
}
