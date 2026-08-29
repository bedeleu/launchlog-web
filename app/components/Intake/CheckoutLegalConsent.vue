<script setup lang="ts">
const termsAccepted = defineModel<boolean>('termsAccepted', { default: false })
const immediatePerformanceRequested = defineModel<boolean>('immediatePerformanceRequested', { default: false })

withDefaults(defineProps<{
  locale: 'en' | 'ro'
  termsUrl: string
  alternateTermsUrl: string
  termsDocument: string
  acceptanceText: string
  performanceRequestText: string
  attempted?: boolean
  disabled?: boolean
}>(), {
  attempted: false,
  disabled: false,
})
</script>

<template>
  <fieldset class="border-y border-release-seam" :disabled="disabled" :lang="locale">
    <legend class="sr-only">Contract decisions</legend>

    <div class="group grid min-h-16 grid-cols-[1.25rem_1fr] gap-3 border-b border-release-seam py-4 text-left has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-release-focus">
      <input
        id="checkout-terms-accepted"
        v-model="termsAccepted"
        type="checkbox"
        class="peer sr-only"
        :aria-invalid="attempted && !termsAccepted"
        aria-labelledby="checkout-terms-label"
        aria-describedby="checkout-terms-detail"
      >
      <label for="checkout-terms-accepted" class="mt-0.5 flex size-5 cursor-pointer items-center justify-center border border-release-paper-muted bg-release-ink font-mono text-[11px] text-release-ink transition-colors peer-checked:border-release-signal peer-checked:bg-release-signal peer-disabled:cursor-not-allowed peer-disabled:opacity-50">
        <span v-if="termsAccepted" aria-hidden="true">✓</span>
        <span class="sr-only">{{ locale === 'ro' ? 'Confirmă acceptarea Termenilor afișați' : 'Confirm the displayed Terms decision' }}</span>
      </label>
      <div>
        <label id="checkout-terms-label" for="checkout-terms-accepted" class="block cursor-pointer text-sm font-medium leading-6 text-release-paper">
          {{ acceptanceText }}
        </label>
        <span id="checkout-terms-detail" class="mt-1 block text-xs leading-5 text-release-paper-muted">
          <a :href="termsUrl" target="_blank" rel="noopener" class="text-release-blaze underline underline-offset-4">
            {{ locale === 'ro' ? 'Deschide pagina publicată în română' : 'Open the published English Terms page' }}
          </a>
          ·
          <a :href="alternateTermsUrl" target="_blank" rel="noopener" class="underline underline-offset-4">
            {{ locale === 'ro' ? 'English Terms' : 'Termenii în română' }}
          </a>
        </span>
        <details class="mt-3 border border-release-seam bg-release-rail">
          <summary class="flex min-h-11 cursor-pointer list-none items-center px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-release-paper-muted transition-colors hover:text-release-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-release-focus [&::-webkit-details-marker]:hidden">
            {{ locale === 'ro' ? 'Citește copia exactă acceptată' : 'Read the exact accepted snapshot' }}
          </summary>
          <pre
            tabindex="0"
            :aria-label="locale === 'ro' ? 'Copia exactă a Termenilor acceptați' : 'Exact accepted Terms snapshot'"
            class="max-h-72 overflow-y-auto whitespace-pre-wrap border-t border-release-seam p-3 font-sans text-xs leading-5 text-release-paper-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-release-focus"
          >{{ termsDocument }}</pre>
        </details>
        <span v-if="attempted && !termsAccepted" class="mt-1 block text-xs text-release-warning" role="alert">{{ locale === 'ro' ? 'Acceptă Termenii pentru a continua.' : 'Accept the Terms to continue.' }}</span>
      </div>
    </div>

    <div class="group grid min-h-16 grid-cols-[1.25rem_1fr] gap-3 py-4 text-left has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-release-focus">
      <input
        id="checkout-immediate-performance"
        v-model="immediatePerformanceRequested"
        type="checkbox"
        class="peer sr-only"
        :aria-invalid="attempted && !immediatePerformanceRequested"
        aria-labelledby="checkout-performance-label"
      >
      <label for="checkout-immediate-performance" class="mt-0.5 flex size-5 cursor-pointer items-center justify-center border border-release-paper-muted bg-release-ink font-mono text-[11px] text-release-ink transition-colors peer-checked:border-release-signal peer-checked:bg-release-signal peer-disabled:cursor-not-allowed peer-disabled:opacity-50">
        <span v-if="immediatePerformanceRequested" aria-hidden="true">✓</span>
        <span class="sr-only">{{ locale === 'ro' ? 'Confirmă solicitarea de executare imediată afișată' : 'Confirm the displayed immediate-performance request' }}</span>
      </label>
      <div>
        <label id="checkout-performance-label" for="checkout-immediate-performance" class="block cursor-pointer text-sm font-medium leading-6 text-release-paper">
          {{ performanceRequestText }}
        </label>
        <span v-if="attempted && !immediatePerformanceRequested" class="mt-1 block text-xs text-release-warning" role="alert">{{ locale === 'ro' ? 'Confirmă solicitarea de executare imediată pentru a continua.' : 'Confirm your immediate-performance request to continue.' }}</span>
      </div>
    </div>
  </fieldset>
</template>
