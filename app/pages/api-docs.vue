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
  GET: 'border-brand-success/30 bg-brand-success/10 text-brand-success',
  PATCH: 'border-brand-warning/30 bg-brand-warning/10 text-brand-warning',
  POST: 'border-brand-accent/30 bg-brand-accent/10 text-brand-accent',
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
  <main class="mx-auto max-w-6xl px-6 py-14 md:py-20">
    <header class="max-w-3xl">
      <p class="text-sm font-semibold uppercase tracking-[0.18em] text-brand-muted">
        Developers
      </p>
      <h1 class="mt-5 text-4xl font-bold tracking-normal text-white md:text-6xl">
        API Documentation
      </h1>
      <p class="mt-6 text-lg leading-8 text-brand-muted">
        Implemented listing and customer-dashboard routes. Public reads require
        no API key; customer routes require a current Firebase ID token.
      </p>
    </header>

    <section class="mt-12 grid gap-4 md:grid-cols-2">
      <div class="rounded-lg border border-brand-border bg-white/[0.03] p-6">
        <p class="text-xs font-semibold uppercase tracking-wider text-brand-muted">
          Runtime base URL
        </p>
        <p class="mt-3 break-all font-mono text-sm text-brand-accent">
          {{ apiBase }}
        </p>
      </div>
      <div class="rounded-lg border border-brand-border bg-white/[0.03] p-6">
        <p class="text-xs font-semibold uppercase tracking-wider text-brand-muted">
          Customer authentication
        </p>
        <p class="mt-3 text-sm leading-6 text-brand-muted">
          Send <span class="font-mono text-xs text-brand-fg">Authorization: Bearer &lt;firebase_id_token&gt;</span>.
          Ownership is enforced by the API for every dashboard listing.
        </p>
      </div>
    </section>

    <section class="mt-14">
      <h2 class="text-2xl font-semibold text-white">
        Public GET routes
      </h2>
      <p class="mt-3 max-w-3xl leading-7 text-brand-muted">
        Listing and discovery data is public. Preview tokens grant access to private preview data,
        so treat each token as sensitive and do not share it.
      </p>
      <div class="mt-6 divide-y divide-brand-border overflow-hidden rounded-lg border border-brand-border">
        <div v-for="endpoint in publicEndpoints" :key="endpoint.path" class="grid gap-2 p-5 sm:grid-cols-[64px_240px_1fr] sm:items-start sm:gap-5">
          <span class="inline-flex w-fit items-center rounded border px-2 py-0.5 font-mono text-xs font-semibold" :class="methodClass[endpoint.method]">
            {{ endpoint.method }}
          </span>
          <code class="break-all font-mono text-sm text-white">{{ endpoint.path }}</code>
          <p class="text-sm leading-6 text-brand-muted">
            {{ endpoint.description }}
          </p>
        </div>
      </div>
    </section>

    <section class="mt-14">
      <h2 class="text-2xl font-semibold text-white">
        Listing query parameters
      </h2>
      <div class="mt-6 overflow-hidden rounded-lg border border-brand-border">
        <div v-for="param in listParams" :key="param.name" class="grid gap-1 border-b border-brand-border p-4 last:border-b-0 sm:grid-cols-[150px_90px_1fr] sm:items-baseline sm:gap-4">
          <code class="font-mono text-sm text-brand-accent">{{ param.name }}</code>
          <span class="font-mono text-xs text-brand-muted">{{ param.type }}</span>
          <span class="text-sm leading-6 text-brand-muted">{{ param.description }}</span>
        </div>
      </div>
      <div class="mt-6 grid gap-4 lg:grid-cols-3">
        <pre class="overflow-x-auto rounded-lg border border-brand-border bg-black/40 p-4 font-mono text-xs leading-6 text-brand-fg/90"><code>{{ publicExample }}</code></pre>
        <pre class="overflow-x-auto rounded-lg border border-brand-border bg-black/40 p-4 font-mono text-xs leading-6 text-brand-fg/90"><code>{{ discoveryExample }}</code></pre>
        <pre class="overflow-x-auto rounded-lg border border-brand-border bg-black/40 p-4 font-mono text-xs leading-6 text-brand-fg/90"><code>{{ previewExample }}</code></pre>
      </div>
    </section>

    <section class="mt-14">
      <h2 class="text-2xl font-semibold text-white">
        Authenticated customer dashboard
      </h2>
      <div class="mt-6 divide-y divide-brand-border overflow-hidden rounded-lg border border-brand-border">
        <div v-for="endpoint in dashboardEndpoints" :key="endpoint.path" class="grid gap-2 p-5 sm:grid-cols-[64px_280px_1fr] sm:items-start sm:gap-5">
          <span class="inline-flex w-fit items-center rounded border px-2 py-0.5 font-mono text-xs font-semibold" :class="methodClass[endpoint.method]">
            {{ endpoint.method }}
          </span>
          <code class="break-all font-mono text-sm text-white">{{ endpoint.path }}</code>
          <p class="text-sm leading-6 text-brand-muted">
            {{ endpoint.description }}
          </p>
        </div>
      </div>
      <div class="mt-6 grid gap-4 lg:grid-cols-2">
        <div>
          <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-muted">
            List owned listings
          </p>
          <pre class="overflow-x-auto rounded-lg border border-brand-border bg-black/40 p-4 font-mono text-xs leading-6 text-brand-fg/90"><code>{{ dashboardExample }}</code></pre>
        </div>
        <div>
          <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-muted">
            Update editable fields
          </p>
          <pre class="overflow-x-auto rounded-lg border border-brand-border bg-black/40 p-4 font-mono text-xs leading-6 text-brand-fg/90"><code>{{ updateExample }}</code></pre>
        </div>
      </div>
    </section>

    <section class="mt-14 rounded-lg border border-brand-border bg-white/[0.02] p-6 md:p-8">
      <h2 class="text-xl font-semibold text-white">
        Response boundaries
      </h2>
      <ul class="mt-5 space-y-3 leading-7 text-brand-muted">
        <li>Public listing routes expose published listing fields, never owner or Stripe identifiers.</li>
        <li>The discovery feed is intentionally unpaginated and narrower than the public listing resource.</li>
        <li>Dashboard list responses are owner-scoped and unpaginated. The update route rejects protected fields such as tier, status, URL and slug.</li>
        <li>The billing-portal route returns a short-lived Stripe URL; it does not change the subscription by itself.</li>
      </ul>
    </section>
  </main>
</template>
