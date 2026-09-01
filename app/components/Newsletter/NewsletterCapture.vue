<script setup lang="ts">
import type { NewsletterSource } from '#shared/constants/newsletter-sources'
import { normalizeNewsletterEmail } from '~/composables/useNewsletter'

const props = defineProps<{ source: NewsletterSource }>()
const newsletter = useNewsletter()
const email = ref('')
const state = ref<'idle' | 'submitting' | 'success' | 'error'>('idle')
const error = ref('')

async function submit(): Promise<void> {
  const normalized = normalizeNewsletterEmail(email.value)

  if (!normalized) {
    state.value = 'error'
    error.value = 'Enter a valid email address.'
    return
  }

  state.value = 'submitting'
  error.value = ''

  try {
    await newsletter.subscribe(normalized, props.source)
    email.value = ''
    state.value = 'success'
  }
  catch {
    state.value = 'error'
    error.value = 'Subscription is temporarily unavailable. Try again.'
  }
}
</script>

<template>
  <section
    class="grid border border-release-seam bg-release-rail lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.78fr)]"
    :data-newsletter-source="source"
    aria-labelledby="newsletter-title"
  >
    <div class="border-b border-release-seam p-5 sm:p-6 lg:border-r lg:border-b-0">
      <p class="release-kicker">Weekly dispatch</p>
      <h2 id="newsletter-title" class="mt-2 text-xl font-semibold tracking-[-0.025em] text-release-paper sm:text-2xl">
        The weekly shipping log
      </h2>
      <p class="mt-2 max-w-2xl text-sm leading-6 text-release-paper-muted">
        One concise weekly edition of products that genuinely shipped. No launch-day noise.
      </p>
      <p class="mt-3 font-mono text-[0.66rem] leading-5 tracking-[0.06em] text-release-paper-muted uppercase">
        Double opt-in · unsubscribe anytime ·
        <NuxtLink to="/privacy" class="text-release-blaze underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-release-focus">
          Privacy policy
        </NuxtLink>
      </p>
    </div>

    <div class="flex items-center p-5 sm:p-6">
      <form
        v-if="state !== 'success'"
        class="w-full"
        novalidate
        :aria-busy="state === 'submitting'"
        @submit.prevent="submit"
      >
        <label :for="`newsletter-${source}`" class="font-mono text-[0.66rem] font-semibold tracking-[0.14em] text-release-paper-muted uppercase">
          Email address
        </label>
        <div class="mt-2 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <input
            :id="`newsletter-${source}`"
            v-model="email"
            class="release-field h-11 px-3 text-sm"
            type="email"
            inputmode="email"
            autocomplete="email"
            maxlength="254"
            required
            placeholder="you@company.com"
            :disabled="state === 'submitting'"
            :aria-invalid="error ? 'true' : undefined"
            :aria-describedby="error ? `newsletter-${source}-error` : undefined"
          >
          <button class="release-action min-w-32" type="submit" :disabled="state === 'submitting'">
            {{ state === 'submitting' ? 'Subscribing…' : 'Subscribe' }}
          </button>
        </div>
        <p
          v-if="error"
          :id="`newsletter-${source}-error`"
          class="mt-2 text-sm text-release-warning"
          role="alert"
        >
          {{ error }}
        </p>
      </form>

      <p v-else class="border-l-2 border-release-signal pl-4 text-sm font-medium leading-6 text-release-paper" role="status" aria-live="polite">
        Check your inbox to confirm your subscription.
      </p>
    </div>
  </section>
</template>
