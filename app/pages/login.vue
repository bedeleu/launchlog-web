<script setup lang="ts">
import { ArrowRight, LogOut, Mail } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toErrorLike } from '~/utils/error-like'

const { user, loginWithGoogle, sendMagicLink, completeMagicLink, logout, waitForAuthReady } = useAuth()
const route = useRoute()

const email = ref('')
const confirmationEmail = ref('')
const status = ref<string | null>(null)
const error = ref<string | null>(null)
const busy = ref<'google' | 'email' | 'link' | null>(null)
const mounted = ref(false)
const needsEmailConfirmation = ref(false)
const redirectTo = computed(() => safeAuthRedirect(route.query.redirect))

async function finishLogin() {
  await navigateTo(redirectTo.value)
}

async function processMagicLink(confirmedEmail?: string) {
  const result = await completeMagicLink(confirmedEmail)
  if (!result) return

  if (result.status === 'email_required') {
    needsEmailConfirmation.value = true
    return
  }

  status.value = `Signed in as ${result.user.email ?? 'your LaunchLog account'}`
  await finishLogin()
}

onMounted(async () => {
  await waitForAuthReady()
  mounted.value = true
  busy.value = 'link'
  try {
    await processMagicLink()
  }
  catch (linkError: unknown) {
    error.value = toErrorLike(linkError).message ?? 'Magic link verification failed.'
  }
  finally {
    busy.value = null
  }
})

async function confirmMagicEmail() {
  error.value = null
  busy.value = 'link'
  try {
    await processMagicLink(confirmationEmail.value)
  }
  catch (linkError: unknown) {
    error.value = toErrorLike(linkError).message ?? 'Magic link verification failed.'
  }
  finally {
    busy.value = null
  }
}

async function onGoogle() {
  error.value = null
  busy.value = 'google'
  try {
    const result = await loginWithGoogle()
    if (result) await finishLogin()
  }
  catch (googleError: unknown) {
    error.value = toErrorLike(googleError).message ?? 'Google sign-in failed.'
  }
  finally {
    busy.value = null
  }
}

async function onMagic() {
  error.value = null
  status.value = null
  busy.value = 'email'
  try {
    await sendMagicLink(email.value, redirectTo.value)
    status.value = `A secure sign-in link was sent to ${email.value}.`
  }
  catch (emailError: unknown) {
    error.value = toErrorLike(emailError).message ?? 'The magic link could not be sent.'
  }
  finally {
    busy.value = null
  }
}

useHead({ title: 'Sign in · LaunchLog', meta: [{ name: 'robots', content: 'noindex,nofollow' }] })
</script>

<template>
  <main class="relative isolate flex min-h-[calc(100vh-5rem)] items-center overflow-hidden px-4 py-12 sm:px-6">
    <div class="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
      <div class="absolute left-1/2 top-0 h-px w-[min(56rem,90vw)] -translate-x-1/2 bg-gradient-to-r from-transparent via-brand-accent/60 to-transparent" />
      <div class="absolute left-1/2 top-0 h-72 w-[32rem] -translate-x-1/2 rounded-full bg-brand-accent/[0.07] blur-3xl" />
    </div>

    <section class="mx-auto grid w-full max-w-4xl overflow-hidden rounded-2xl border border-brand-border bg-[#0d1220]/95 shadow-2xl shadow-black/30 md:grid-cols-[0.85fr_1.15fr]">
      <div class="border-b border-brand-border bg-white/[0.025] p-7 sm:p-10 md:border-b-0 md:border-r">
        <p class="text-xs font-semibold uppercase tracking-[0.24em] text-brand-accent">
          Customer access
        </p>
        <h1 class="mt-5 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Return to what you shipped.
        </h1>
        <p class="mt-5 text-sm leading-7 text-brand-muted">
          Edit your public listing, manage its subscription, and inspect the discovery facts published by LaunchLog.
        </p>
        <div class="mt-10 border-l border-brand-accent/40 pl-4 text-xs leading-5 text-brand-muted">
          Password-free access. Use Google or a secure link sent to the email attached to your listing.
        </div>
      </div>

      <div class="p-7 sm:p-10">
        <template v-if="mounted && user">
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">
            Signed in
          </p>
          <p class="mt-3 truncate text-lg font-medium text-white">
            {{ user.email ?? 'LaunchLog customer' }}
          </p>
          <Button class="mt-7 w-full" size="lg" as-child>
            <NuxtLink :to="redirectTo">
              Continue to dashboard
              <ArrowRight aria-hidden="true" />
            </NuxtLink>
          </Button>
          <Button class="mt-3 w-full" size="lg" variant="ghost" @click="logout">
            <LogOut aria-hidden="true" />
            Sign out
          </Button>
        </template>

        <template v-else-if="needsEmailConfirmation">
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-brand-accent">
            Cross-device sign-in
          </p>
          <h2 class="mt-3 text-xl font-semibold text-white">
            Confirm your email
          </h2>
          <p class="mt-2 text-sm leading-6 text-brand-muted">
            Enter the address that received this sign-in link to finish securely.
          </p>

          <form class="mt-7 space-y-4" @submit.prevent="confirmMagicEmail">
            <div class="space-y-2">
              <Label for="magic-link-email">Email address</Label>
              <Input
                id="magic-link-email"
                v-model="confirmationEmail"
                type="email"
                inputmode="email"
                autocomplete="email"
                required
                placeholder="you@example.com"
                :disabled="busy !== null"
                class="h-11 border-brand-border bg-black/10 text-white focus-visible:border-brand-accent focus-visible:ring-brand-accent/30"
              />
            </div>
            <Button class="w-full" size="lg" type="submit" :disabled="busy !== null">
              <AppSpinner v-if="busy === 'link'" color="text-current" label="Verifying sign-in link" />
              <Mail v-else aria-hidden="true" />
              {{ busy === 'link' ? 'Verifying…' : 'Finish sign in' }}
            </Button>
          </form>

          <Button class="mt-3 w-full" variant="ghost" @click="needsEmailConfirmation = false">
            Use another sign-in method
          </Button>
        </template>

        <template v-else>
          <h2 class="text-xl font-semibold text-white">
            Sign in to your dashboard
          </h2>
          <p class="mt-2 text-sm text-brand-muted">
            Choose the same email used for your LaunchLog purchase.
          </p>

          <Button
            class="mt-7 w-full border-brand-border bg-white/[0.03] hover:bg-white/[0.07]"
            size="lg"
            variant="outline"
            :disabled="busy !== null"
            @click="onGoogle"
          >
            <AppSpinner v-if="busy === 'google'" color="text-current" label="Signing in with Google" />
            <span v-else class="flex size-5 items-center justify-center rounded-full bg-white text-xs font-bold text-[#0A0E1A]" aria-hidden="true">G</span>
            Continue with Google
          </Button>

          <div class="my-7 flex items-center gap-3" aria-hidden="true">
            <span class="h-px flex-1 bg-brand-border" />
            <span class="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-muted">or email</span>
            <span class="h-px flex-1 bg-brand-border" />
          </div>

          <form class="space-y-4" @submit.prevent="onMagic">
            <div class="space-y-2">
              <Label for="customer-email">Email address</Label>
              <Input
                id="customer-email"
                v-model="email"
                type="email"
                inputmode="email"
                autocomplete="email"
                required
                placeholder="you@example.com"
                :disabled="busy !== null"
                class="h-11 border-brand-border bg-black/10 text-white focus-visible:border-brand-accent focus-visible:ring-brand-accent/30"
              />
            </div>
            <Button class="w-full" size="lg" type="submit" :disabled="busy !== null">
              <AppSpinner v-if="busy === 'email'" color="text-current" label="Sending sign-in link" />
              <Mail v-else aria-hidden="true" />
              {{ busy === 'email' ? 'Sending…' : 'Email me a sign-in link' }}
            </Button>
          </form>
        </template>

        <p v-if="status" class="mt-6 rounded-lg border border-brand-success/20 bg-brand-success/[0.06] px-4 py-3 text-sm leading-6 text-emerald-200" role="status">
          {{ status }}
        </p>
        <p v-if="error" class="mt-6 rounded-lg border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-sm leading-6 text-red-200" role="alert">
          {{ error }}
        </p>
      </div>
    </section>
  </main>
</template>
