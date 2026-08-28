<script setup lang="ts">
definePageMeta({ middleware: 'admin' })
useHead({ title: 'Admin · Add a listing', meta: [{ name: 'robots', content: 'noindex,nofollow' }] })
</script>

<template>
  <div class="min-h-screen bg-release-ink">
    <ReleaseShell
      eyebrow="Operator desk · URL intake"
      title="Add a listing by URL."
      description="Drop the website URL and review the generated preview. It is the same URL-first flow customers use; admin placements can publish as Standard or Featured without Stripe."
    >
      <NuxtLink to="/admin/listings" class="mb-6 inline-flex font-mono text-xs font-semibold uppercase tracking-[0.1em] text-release-paper-muted underline decoration-release-seam underline-offset-4 hover:text-release-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-warning">
        ← Back to listings
      </NuxtLink>
      <IntakePreviewForm />
    </ReleaseShell>
  </div>
</template>
