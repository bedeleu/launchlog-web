<script setup lang="ts">
import { ArrowRight, LogOut, Mail } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { firebaseAuthErrorMessage } from '~/utils/auth-error'

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
    error.value = firebaseAuthErrorMessage(linkError, 'magic-verify')
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
    error.value = firebaseAuthErrorMessage(linkError, 'magic-verify')
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
    error.value = firebaseAuthErrorMessage(googleError, 'google')
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
    error.value = firebaseAuthErrorMessage(emailError, 'magic-send')
  }
  finally {
    busy.value = null
  }
}

useHead({ title: 'Sign in · LaunchLog', meta: [{ name: 'robots', content: 'noindex,nofollow' }] })
</script>

<template>
  <div class="flex min-h-[calc(100vh-5rem)] items-center bg-release-ink px-4 py-12 sm:px-6">
    <section class="release-panel mx-auto grid w-full max-w-5xl border-t-4 border-t-release-blaze md:grid-cols-[0.9fr_1.1fr]">
      <div class="border-b border-release-seam bg-release-paper p-7 text-release-ink sm:p-10 md:border-r md:border-b-0">
        <p class="release-kicker">
          Customer access
        </p>
        <h1 class="mt-5 max-w-sm text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
          Return to what you shipped.
        </h1>
        <p class="mt-5 max-w-sm text-sm leading-7 text-[#575044]">
          Edit your public listing, manage its subscription, and inspect the discovery facts published by LaunchLog.
        </p>
        <div class="mt-10 border-l-2 border-release-blaze pl-4 font-mono text-xs leading-5 text-[#575044]">
          Password-free access. Use Google or a secure link sent to the email attached to your listing.
        </div>
      </div>

      <div class="p-7 sm:p-10">
        <template v-if="mounted && user">
          <p class="release-kicker text-release-paper-muted">
            Signed in
          </p>
          <p class="mt-3 truncate text-lg font-medium text-release-paper">
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
          <p class="release-kicker">
            Cross-device sign-in
          </p>
          <h2 class="mt-3 text-xl font-semibold text-release-paper">
            Confirm your email
          </h2>
          <p class="mt-2 text-sm leading-6 text-release-paper-muted">
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
                class="release-field h-11 px-3"
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
          <p class="release-kicker">Account record</p>
          <h2 class="mt-3 text-xl font-semibold text-release-paper">
            Sign in to your dashboard
          </h2>
          <p class="mt-2 text-sm text-release-paper-muted">
            Choose the same email used for your LaunchLog purchase.
          </p>

          <Button
            class="mt-7 w-full border-[#8e918f] bg-[#131314] text-[#e3e3e3] hover:bg-[#1f1f20]"
            size="lg"
            variant="outline"
            :disabled="busy !== null"
            @click="onGoogle"
          >
            <AppSpinner v-if="busy === 'google'" color="text-current" label="Signing in with Google" />
            <img v-else src="/images/google-g.png" alt="" width="20" height="20" class="h-5 w-auto shrink-0" aria-hidden="true">
            Continue with Google
          </Button>

          <div class="my-7 flex items-center gap-3" aria-hidden="true">
            <span class="h-px flex-1 bg-release-seam" />
            <span class="text-[11px] font-semibold uppercase tracking-[0.2em] text-release-paper-muted">or email</span>
            <span class="h-px flex-1 bg-release-seam" />
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
                class="release-field h-11 px-3"
              />
            </div>
            <Button class="w-full" size="lg" type="submit" :disabled="busy !== null">
              <AppSpinner v-if="busy === 'email'" color="text-current" label="Sending sign-in link" />
              <Mail v-else aria-hidden="true" />
              {{ busy === 'email' ? 'Sending…' : 'Email me a sign-in link' }}
            </Button>
          </form>
        </template>

        <p v-if="status" class="mt-6 border border-release-signal/40 border-l-2 bg-release-rail px-4 py-3 text-sm leading-6 text-release-signal" role="status">
          {{ status }}
        </p>
        <p v-if="error" class="mt-6 border border-release-destructive border-l-2 bg-release-rail px-4 py-3 text-sm leading-6 text-release-destructive" role="alert">
          {{ error }}
        </p>
      </div>
    </section>
  </div>
</template>
