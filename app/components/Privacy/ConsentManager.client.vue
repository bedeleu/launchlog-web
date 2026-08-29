<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  SwitchRoot,
  SwitchThumb,
} from 'reka-ui'

const {
  consent,
  preferencesOpen,
  globalPrivacyControl,
  initialized,
  initialize,
  refreshFromStorage,
  rejectOptional,
  save,
  openPreferences,
  restorePreferencesFocus,
  syncFromStorage,
} = usePrivacyConsent()
const copy = {
  choices: 'Privacy choices',
  control: 'Privacy control',
  heading: 'Your visit, your choice',
  summary: 'Essential storage keeps sign-in and private previews working. Optional analytics and Meta advertising measurement run only if you accept them.',
  gpc: 'Global Privacy Control detected. Meta advertising measurement stays off on this browser.',
  read: 'Read our',
  privacy: 'Privacy Policy',
  cookies: 'Cookie Policy',
  accept: 'Accept optional',
  reject: 'Reject optional',
  manage: 'Manage choices',
  center: 'Privacy center',
  dialogSummary: 'Optional analytics and advertising measurement are off by default. Choose each purpose separately and change them at any time.',
  close: 'Close privacy choices',
  essential: 'Essential storage',
  essentialBody: 'Keeps sign-in, private-preview recovery and your privacy choice working.',
  always: 'Always on',
  analytics: 'Self-hosted analytics',
  analyticsBody: 'Sends approved public pageviews and funnel events to Plausible. Private URLs, tokens, Stripe Session IDs and Reddit click IDs are blocked.',
  analyticsLabel: 'Analytics',
  advertising: 'Meta advertising measurement',
  advertisingBody: 'Loads Meta Pixel on approved public pages and sends consented funnel events through Meta Conversions API. Private preview tokens and Stripe Session IDs are never sent.',
  advertisingLabel: 'Meta advertising measurement',
  save: 'Save choices',
  rejectOptional: 'Reject optional',
}

const draftAnalytics = ref(false)
const draftAdvertising = ref(false)
const decisionAnnouncement = ref('')
const showBanner = computed(() => initialized.value && consent.value === null)

const chooseFromBanner = async (accepted: boolean) => {
  save(accepted, accepted)
  decisionAnnouncement.value = accepted ? copy.accept : copy.reject
  await nextTick()
  document.querySelector<HTMLElement>('#main-content')?.focus({ preventScroll: true })
}

watch(preferencesOpen, async (open, wasOpen) => {
  if (open) {
    draftAnalytics.value = consent.value?.analytics === true
    draftAdvertising.value = consent.value?.advertising === true && !globalPrivacyControl.value
    return
  }

  if (wasOpen) {
    await nextTick()
    restorePreferencesFocus()
  }
})

onMounted(() => {
  initialize()
  window.addEventListener('storage', syncFromStorage)
  window.addEventListener('focus', refreshFromStorage)
  window.addEventListener('pageshow', refreshFromStorage)
})

onBeforeUnmount(() => {
  window.removeEventListener('storage', syncFromStorage)
  window.removeEventListener('focus', refreshFromStorage)
  window.removeEventListener('pageshow', refreshFromStorage)
})
</script>

<template>
  <div data-privacy-consent-root lang="en">
    <section
    v-if="showBanner"
    :aria-label="copy.choices"
    class="fixed inset-x-3 bottom-3 z-[70] mx-auto max-h-[calc(100dvh-1.5rem)] max-w-4xl overflow-y-auto overscroll-contain border border-release-seam bg-release-ink p-5 shadow-[0_24px_80px_rgba(0,0,0,0.65)] sm:inset-x-6 sm:p-6"
  >
    <div class="grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
      <div>
        <p class="release-kicker">{{ copy.control }}</p>
        <h2 class="mt-2 text-xl font-semibold tracking-[-0.025em] text-[#f6f1e7]">
          {{ copy.heading }}
        </h2>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-release-paper-muted">
          {{ copy.summary }}
        </p>
        <p v-if="globalPrivacyControl" class="mt-2 font-mono text-[11px] uppercase tracking-[0.1em] text-release-signal">
          {{ copy.gpc }}
        </p>
        <p class="mt-3 text-xs leading-5 text-release-paper-muted">
          {{ copy.read }} <NuxtLink to="/privacy" class="text-release-blaze underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-release-focus">{{ copy.privacy }}</NuxtLink>
          and <NuxtLink to="/cookies" class="text-release-blaze underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-release-focus">{{ copy.cookies }}</NuxtLink>.
        </p>
      </div>

      <div class="grid min-w-64 gap-2 sm:grid-cols-2 md:grid-cols-1">
        <button type="button" class="consent-choice release-action-secondary w-full" @click="chooseFromBanner(true)">
          {{ copy.accept }}
        </button>
        <button type="button" class="consent-choice release-action-secondary w-full" @click="chooseFromBanner(false)">
          {{ copy.reject }}
        </button>
        <button
          type="button"
          class="min-h-11 px-3 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-release-paper-muted hover:text-[#f6f1e7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-release-focus sm:col-span-2 md:col-span-1"
          @click="openPreferences"
        >
          {{ copy.manage }}
        </button>
      </div>
    </div>
    </section>

    <p class="sr-only" role="status" aria-live="polite">{{ decisionAnnouncement }}</p>

    <DialogRoot v-model:open="preferencesOpen">
      <DialogPortal>
        <DialogOverlay class="fixed inset-0 z-[80] bg-black/75 backdrop-blur-[2px]" />
        <DialogContent
        class="release-panel fixed top-1/2 left-1/2 z-[81] max-h-[min(90vh,46rem)] w-[min(calc(100vw-2rem),42rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto p-0 text-[#f6f1e7] shadow-[0_28px_100px_rgba(0,0,0,0.75)] focus:outline-none"
      >
        <div class="border-b border-release-seam p-5 sm:p-7">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="release-kicker">{{ copy.center }}</p>
              <DialogTitle class="mt-2 text-2xl font-semibold tracking-[-0.03em]">
                {{ copy.choices }}
              </DialogTitle>
              <DialogDescription class="mt-2 max-w-xl text-sm leading-6 text-release-paper-muted">
                {{ copy.dialogSummary }}
              </DialogDescription>
            </div>
            <DialogClose
              class="flex size-11 shrink-0 items-center justify-center border border-release-seam font-mono text-lg text-release-paper-muted hover:border-release-blaze hover:text-release-blaze focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-release-focus"
              :aria-label="copy.close"
            >
              ×
            </DialogClose>
          </div>
        </div>

        <div class="divide-y divide-release-seam border-b border-release-seam">
          <div class="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-7">
            <div>
              <h3 class="font-semibold">{{ copy.essential }}</h3>
              <p class="mt-1 text-sm leading-6 text-release-paper-muted">
                {{ copy.essentialBody }}
              </p>
            </div>
            <span class="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-release-signal">{{ copy.always }}</span>
          </div>

          <div class="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-7">
            <div>
              <h3 class="font-semibold">{{ copy.analytics }}</h3>
              <p class="mt-1 text-sm leading-6 text-release-paper-muted">
                {{ copy.analyticsBody }}
              </p>
            </div>
            <SwitchRoot
              v-model="draftAnalytics"
              :aria-label="copy.analyticsLabel"
              class="relative h-7 w-12 shrink-0 border border-release-seam bg-release-rail transition-colors data-[state=checked]:border-release-signal data-[state=checked]:bg-release-signal focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-release-focus"
            >
              <SwitchThumb class="block size-5 translate-x-0.5 bg-release-paper transition-transform data-[state=checked]:translate-x-[1.35rem] data-[state=checked]:bg-release-ink" />
            </SwitchRoot>
          </div>

          <div class="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-7">
            <div>
              <h3 class="font-semibold">{{ copy.advertising }}</h3>
              <p class="mt-1 text-sm leading-6 text-release-paper-muted">
                {{ copy.advertisingBody }}
              </p>
            </div>
            <SwitchRoot
              v-model="draftAdvertising"
              :aria-label="copy.advertisingLabel"
              :disabled="globalPrivacyControl"
              class="relative h-7 w-12 shrink-0 border border-release-seam bg-release-rail transition-colors data-[state=checked]:border-release-signal data-[state=checked]:bg-release-signal disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-release-focus"
            >
              <SwitchThumb class="block size-5 translate-x-0.5 bg-release-paper transition-transform data-[state=checked]:translate-x-[1.35rem] data-[state=checked]:bg-release-ink" />
            </SwitchRoot>
          </div>
        </div>

        <div class="grid gap-3 p-5 sm:grid-cols-2 sm:p-7">
          <button type="button" class="release-action w-full" @click="save(draftAnalytics, draftAdvertising)">
            {{ copy.save }}
          </button>
          <button type="button" class="release-action-secondary w-full" @click="rejectOptional">
            {{ copy.rejectOptional }}
          </button>
        </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </div>
</template>
