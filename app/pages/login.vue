<script setup lang="ts">
const { user, loginWithGoogle, sendMagicLink, completeMagicLink, logout } = useAuth()
const route = useRoute()

const email = ref('')
const status = ref<string | null>(null)
const error = ref<string | null>(null)
const redirectTo = computed(() => typeof route.query.redirect === 'string' ? route.query.redirect : '/admin/listings')

const finishLogin = async () => {
  await navigateTo(redirectTo.value)
}

onMounted(async () => {
  try {
    const r = await completeMagicLink()
    if (r) {
      status.value = `Magic link consumed — signed in as ${r.user.email}`
      await finishLogin()
    }
  } catch (e: any) {
    error.value = e?.message ?? 'Magic link verification failed'
  }
})

const onGoogle = async () => {
  error.value = null
  try {
    const r = await loginWithGoogle()
    if (r) {
      status.value = `Signed in as ${r.user.email}`
      await finishLogin()
    }
  } catch (e: any) {
    error.value = e?.message ?? 'Google sign-in failed'
  }
}

const onMagic = async () => {
  error.value = null
  try {
    await sendMagicLink(email.value)
    status.value = `Magic link sent to ${email.value}`
  } catch (e: any) {
    error.value = e?.message ?? 'Could not send magic link'
  }
}

useSeoMeta({ title: 'Sign in | LaunchLog' })
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
    <h1 class="text-3xl font-bold">
      Sign in to LaunchLog
    </h1>

    <div v-if="user" class="mt-8 space-y-4">
      <p>
        Signed in as <strong>{{ user.email }}</strong>
      </p>
      <NuxtLink
        :to="redirectTo"
        class="inline-flex rounded border border-white/10 px-4 py-2 hover:bg-white/5"
      >
        Continue
      </NuxtLink>
      <button class="rounded border border-white/10 px-4 py-2 hover:bg-white/5" @click="logout">
        Sign out
      </button>
    </div>

    <div v-else class="mt-8 space-y-6">
      <button
        class="w-full rounded border border-white/10 px-4 py-2 hover:bg-white/5"
        @click="onGoogle"
      >
        Continue with Google
      </button>

      <form class="space-y-3" @submit.prevent="onMagic">
        <input
          v-model="email"
          type="email"
          required
          placeholder="you@example.com"
          class="placeholder:text-brand-muted focus:border-brand-accent w-full rounded border border-white/10 bg-transparent px-3 py-2 text-white focus:outline-none"
        >
        <button class="w-full rounded border border-white/10 px-4 py-2 hover:bg-white/5" type="submit">
          Send magic link
        </button>
      </form>
    </div>

    <p v-if="status" class="text-brand-success mt-6">
      {{ status }}
    </p>
    <p v-if="error" class="text-brand-warning mt-6">
      {{ error }}
    </p>
  </main>
</template>
