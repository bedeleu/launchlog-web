<script setup lang="ts">
import { LockKeyhole } from '@lucide/vue'
</script>

<template>
  <div class="preview-shell flex min-h-screen flex-col bg-release-ink font-sans text-[#f6f1e7] antialiased">
    <PrivacyConsentManager />
    <a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-release-paper focus:px-5 focus:py-3 focus:text-release-ink">
      Skip to preview
    </a>
    <header class="border-b border-release-seam">
      <div class="mx-auto flex min-h-20 max-w-[84rem] flex-wrap items-center justify-between gap-x-5 gap-y-2 px-5 py-4 sm:px-8 lg:px-12">
        <NuxtLink to="/" aria-label="LaunchLog home" class="inline-flex shrink-0 items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-release-focus">
          <img src="/images/logo.webp" alt="" width="30" height="30" class="size-7">
          <span class="text-lg font-semibold tracking-[-0.025em]">LaunchLog<span class="text-release-paper-muted">.ai</span></span>
        </NuxtLink>
        <p class="flex items-center gap-2 text-xs text-release-paper-muted sm:text-sm">
          <LockKeyhole class="size-3.5 shrink-0" aria-hidden="true" />
          Your private listing preview
        </p>
      </div>
    </header>
    <main id="main-content" tabindex="-1" class="flex-1 focus:outline-none">
      <slot />
    </main>
    <footer class="mx-auto flex w-full max-w-[84rem] flex-col justify-between gap-4 px-5 py-8 text-xs text-release-paper-muted sm:flex-row sm:px-8 lg:px-12">
      <p>The log of what just shipped.</p>
      <nav aria-label="Preview support" class="flex flex-wrap gap-x-6 gap-y-3">
        <NuxtLink to="/contact" class="underline-offset-4 hover:text-release-paper hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-release-focus">Need a hand?</NuxtLink>
        <NuxtLink to="/privacy" class="underline-offset-4 hover:text-release-paper hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-release-focus">Privacy</NuxtLink>
        <NuxtLink to="/terms" class="underline-offset-4 hover:text-release-paper hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-release-focus">Terms</NuxtLink>
      </nav>
    </footer>
  </div>
</template>

<style scoped>
.preview-shell {
  color-scheme: dark;
  caret-color: var(--release-focus);
  scrollbar-color: var(--release-paper-muted) var(--release-ink);
}

.preview-shell :deep(::selection) {
  background: var(--release-paper);
  color: var(--release-ink);
}
</style>
