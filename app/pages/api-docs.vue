<script setup lang="ts">
const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const pageUrl = `${siteUrl}/api-docs`
const apiBase = `${config.public.apiUrl.replace(/\/+$/, '')}/api/v1`
const description
  = 'The implemented LaunchLog listing, discovery, private-preview and authenticated customer-dashboard API routes.'

interface Endpoint {
  method: 'GET' | 'PATCH' | 'POST'
  path: string
  description: string
}

const publicEndpoints: Endpoint[] = [
  {
    method: 'GET',
    path: '/listings',
    description: 'Returns published listings in a Laravel pagination envelope with data, links and meta.',
  },
  {
    method: 'GET',
    path: '/listings/{slug}',
    description: 'Returns one published listing by slug. A withdrawn public slug returns 410; an unknown or never-published slug returns 404.',
  },
  {
    method: 'GET',
    path: '/discovery/listings',
    description: 'Returns the complete, unpaginated published discovery feed ordered by slug. Each item has slug, name, tagline and updated_at.',
  },
  {
    method: 'GET',
    path: '/previews/{token}',
    description: 'Returns an active private preview addressed by its opaque token. Unknown and expired previews return 404.',
  },
  {
    method: 'GET',
    path: '/previews/{token}/conversion',
    description: 'Reports pending, converted or expired checkout-conversion state. A converted response includes the listing slug.',
  },
]

const dashboardEndpoints: Endpoint[] = [
  {
    method: 'GET',
    path: '/dashboard/listings',
    description: 'Returns every listing owned by the authenticated user, including subscription summary and deterministic receipt facts.',
  },
  {
    method: 'GET',
    path: '/dashboard/listings/{id}',
    description: 'Returns one owned listing. A listing owned by someone else is not disclosed and returns 404.',
  },
  {
    method: 'PATCH',
    path: '/dashboard/listings/{id}',
    description: 'Updates only name, tagline and description on an owned listing.',
  },
  {
    method: 'POST',
    path: '/dashboard/listings/{id}/billing-portal',
    description: 'Creates a Stripe Billing Portal session for an owned listing with a billable subscription.',
  },
]

const listParams = [
  { name: 'category', type: 'string', description: 'Category slug.' },
  { name: 'kind', type: 'tech', description: 'Restricts results to the implemented tech-category set.' },
  { name: 'tier', type: 'enum', description: 'basic or featured.' },
  { name: 'tech', type: 'string', description: 'Exact tech-stack entry.' },
  { name: 'tag', type: 'string', description: 'Tag slug.' },
  { name: 'q', type: 'string', description: 'Full-text query over name, tagline and description.' },
  { name: 'sort', type: 'enum', description: 'priority (default) or recent.' },
  { name: 'per_page', type: 'integer', description: 'Page size, clamped to 1–100; defaults to 24. Not valid with view=directory.' },
  { name: 'page', type: 'integer', description: 'Pagination page.' },
  { name: 'view', type: 'directory', description: 'Paginates by the 30 visual slots of a directory page instead of by a fixed record count: a Featured row spends 2 slots for the card plus 1 for its real basic companion, an ordinary basic listing spends 1, and at most three Featured rows open a page. Adds slot_capacity and slots_used to meta. Requires sort=priority and cannot be combined with tier or per_page — those combinations return 422 on the conflicting field.' },
]

const publicExample = `curl "${apiBase}/listings?tier=featured&sort=recent"`
const discoveryExample = `curl "${apiBase}/discovery/listings"`
const previewExample = `curl "${apiBase}/previews/{token}"`
const dashboardExample = `curl \\
  -H "Authorization: Bearer {firebase_id_token}" \\
  "${apiBase}/dashboard/listings"`
const updateExample = `curl -X PATCH \\
  -H "Authorization: Bearer {firebase_id_token}" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Updated name","tagline":"Updated tagline","description":"Updated description"}' \\
  "${apiBase}/dashboard/listings/{id}"`

const methodClass: Record<Endpoint['method'], string> = {
  GET: 'border-release-paper-muted text-release-paper',
  PATCH: 'border-release-warning text-release-warning',
  POST: 'border-release-blaze text-release-blaze',
}

useSeoMeta({
  title: 'API Documentation — LaunchLog',
  description,
  ogTitle: 'API Documentation — LaunchLog',
  ogDescription: description,
  ogUrl: pageUrl,
  ogType: 'website',
  twitterTitle: 'API Documentation — LaunchLog',
  twitterDescription: description,
})

useHead({
  link: [{ rel: 'canonical', href: pageUrl }],
  script: [
    {
      key: 'launchlog-apidocs-schema',
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: 'API Documentation — LaunchLog',
        description,
        inLanguage: 'en-US',
        isPartOf: { '@id': `${siteUrl}/#website` },
      }),
    },
  ],
})
</script>

<template>
  <ContentReadingShell
    wide
    label="Developer reference · API v1"
    title="API documentation"
    intro="Implemented listing and customer-dashboard routes. Public reads require no API key; customer routes require a current Firebase ID token."
  >
    <template #meta>
      <ContentReadingMeta
        :items="[
        { label: 'Base', value: apiBase },
        { label: 'Public reads', value: 'No key' },
        { label: 'Customer auth', value: 'Firebase token' },
        ]"
      />
    </template>

    <section class="grid border-t border-l border-release-seam md:grid-cols-2">
      <div class="border-r border-b border-release-seam p-6">
        <p class="release-kicker">Runtime base URL</p>
        <p class="mt-4 break-all font-mono text-sm text-[#f6f1e7]">{{ apiBase }}</p>
      </div>
      <div class="border-r border-b border-release-seam p-6">
        <p class="release-kicker">Customer authentication</p>
        <p class="mt-4 text-sm leading-7 text-release-paper-muted">Send <code class="border border-release-seam bg-release-rail px-1.5 py-1 font-mono text-xs text-[#f6f1e7]">Authorization: Bearer &lt;firebase_id_token&gt;</code>. Ownership is enforced by the API.</p>
      </div>
    </section>

    <section class="mt-14">
      <p class="release-kicker">Public surface</p>
      <h2 class="mt-3 text-3xl font-semibold tracking-tight text-[#f6f1e7]">Public GET routes</h2>
      <p class="mt-3 max-w-3xl leading-7 text-release-paper-muted">
        Listing and discovery data is public. Preview tokens grant access to private preview data,
        so treat each token as sensitive and do not share it.
      </p>
      <div class="mt-6 border-t border-release-seam">
        <div v-for="endpoint in publicEndpoints" :key="endpoint.path" class="grid gap-3 border-b border-release-seam py-5 sm:grid-cols-[64px_260px_1fr] sm:items-start sm:gap-5">
          <span class="inline-flex w-fit items-center border px-2 py-0.5 font-mono text-xs font-semibold" :class="methodClass[endpoint.method]">
            {{ endpoint.method }}
          </span>
          <code class="break-all font-mono text-sm text-[#f6f1e7]">{{ endpoint.path }}</code>
          <p class="text-sm leading-6 text-release-paper-muted">
            {{ endpoint.description }}
          </p>
        </div>
      </div>
    </section>

    <section class="mt-14">
      <p class="release-kicker">Query contract</p>
      <h2 class="mt-3 text-3xl font-semibold tracking-tight text-[#f6f1e7]">Listing query parameters</h2>
      <div class="mt-6 border-t border-release-seam">
        <div v-for="param in listParams" :key="param.name" class="grid gap-2 border-b border-release-seam py-4 sm:grid-cols-[150px_90px_1fr] sm:items-baseline sm:gap-4">
          <code class="font-mono text-sm text-release-blaze">{{ param.name }}</code>
          <span class="font-mono text-xs text-release-paper-muted">{{ param.type }}</span>
          <span class="text-sm leading-6 text-release-paper-muted">{{ param.description }}</span>
        </div>
      </div>
      <div class="mt-6 grid gap-4 lg:grid-cols-3">
        <pre v-for="example in [publicExample, discoveryExample, previewExample]" :key="example" class="overflow-x-auto border border-release-seam bg-release-rail p-4 font-mono text-xs leading-6 text-[#f6f1e7]"><code>{{ example }}</code></pre>
      </div>
    </section>

    <section class="mt-14">
      <p class="release-kicker">Authenticated surface</p>
      <h2 class="mt-3 text-3xl font-semibold tracking-tight text-[#f6f1e7]">Customer dashboard</h2>
      <div class="mt-6 border-t border-release-seam">
        <div v-for="endpoint in dashboardEndpoints" :key="endpoint.path" class="grid gap-3 border-b border-release-seam py-5 sm:grid-cols-[64px_280px_1fr] sm:items-start sm:gap-5">
          <span class="inline-flex w-fit items-center border px-2 py-0.5 font-mono text-xs font-semibold" :class="methodClass[endpoint.method]">
            {{ endpoint.method }}
          </span>
          <code class="break-all font-mono text-sm text-[#f6f1e7]">{{ endpoint.path }}</code>
          <p class="text-sm leading-6 text-release-paper-muted">
            {{ endpoint.description }}
          </p>
        </div>
      </div>
      <div class="mt-6 grid gap-4 lg:grid-cols-2">
        <div>
          <p class="release-kicker mb-2">List owned listings</p>
          <pre class="overflow-x-auto border border-release-seam bg-release-rail p-4 font-mono text-xs leading-6 text-[#f6f1e7]"><code>{{ dashboardExample }}</code></pre>
        </div>
        <div>
          <p class="release-kicker mb-2">Update editable fields</p>
          <pre class="overflow-x-auto border border-release-seam bg-release-rail p-4 font-mono text-xs leading-6 text-[#f6f1e7]"><code>{{ updateExample }}</code></pre>
        </div>
      </div>
    </section>

    <section class="mt-14 border-l-2 border-release-blaze bg-release-rail p-6 md:p-8">
      <p class="release-kicker">Response boundaries</p>
      <ul class="mt-5 list-square space-y-3 pl-5 leading-7 text-release-paper-muted marker:text-release-blaze">
        <li>Public listing routes expose published listing fields, never owner or Stripe identifiers.</li>
        <li>The discovery feed is intentionally unpaginated and narrower than the public listing resource.</li>
        <li>Dashboard list responses are owner-scoped and unpaginated. The update route rejects protected fields such as tier, status, URL and slug.</li>
        <li>The billing-portal route returns a short-lived Stripe URL; it does not change the subscription by itself.</li>
      </ul>
    </section>
  </ContentReadingShell>
</template>
