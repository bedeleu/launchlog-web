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
      <div class="mx-auto flex min-h-12 max-w-[96rem] flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 sm:px-6 lg:px-8">
        <NuxtLink to="/" aria-label="LaunchLog home" class="inline-flex shrink-0 items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-release-focus">
          <img src="/images/logo.webp" alt="" width="30" height="30" class="size-7">
          <span class="text-base font-semibold tracking-[-0.025em]">LaunchLog<span class="text-release-paper-muted">.ai</span></span>
        </NuxtLink>
        <p class="flex items-center gap-1.5 text-[11px] text-release-paper-muted sm:text-xs">
          <LockKeyhole class="size-3.5 shrink-0" aria-hidden="true" />
          Your private listing preview
        </p>
      </div>
    </header>
    <main id="main-content" tabindex="-1" class="flex-1 focus:outline-none">
      <slot />
    </main>
    <footer class="mx-auto flex w-full max-w-[96rem] flex-col justify-between gap-4 px-4 py-6 text-xs text-release-paper-muted sm:flex-row sm:px-6 lg:px-8">
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
