<script setup lang="ts">
definePageMeta({ middleware: 'admin' })
useHead({ title: 'Admin · Add a listing', meta: [{ name: 'robots', content: 'noindex,nofollow' }] })
</script>

<template>
  <main class="mx-auto max-w-3xl px-6 py-16 sm:py-20">
    <NuxtLink to="/admin/listings" class="text-sm text-brand-muted hover:text-brand-accent">
      ← Back to listings
    </NuxtLink>
    <h1 class="mt-5 text-4xl font-bold tracking-tight text-brand-fg">
      Add a listing
    </h1>
    <p class="mt-3 max-w-2xl text-base leading-7 text-brand-muted">
      Drop the website URL and review the generated preview. As admin, you can publish Standard or Featured without Stripe.
    </p>
    <div class="mt-8">
      <IntakePreviewForm />
    </div>
  </main>
</template>
