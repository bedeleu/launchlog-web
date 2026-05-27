<script setup lang="ts">
const { user } = useAuth()
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-16">
    <p class="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
      Curated directory for indie tech
    </p>
    <h1 class="mt-6 max-w-3xl text-5xl font-bold tracking-normal text-white md:text-7xl">
      Get Listed.
      <span class="block text-gray-600">Get Found.</span>
    </h1>
    <p class="mt-6 max-w-2xl text-lg text-gray-300">
      LaunchLog is the log of what just shipped, engineered to be cited by
      ChatGPT, Perplexity, Claude, and Gemini.
    </p>

    <p class="text-brand-muted mt-10 text-sm">
      <template v-if="user">
        Signed in as <strong class="text-white">{{ user.email }}</strong> —
        <NuxtLink to="/dashboard" class="text-brand-accent underline">
          Dashboard
        </NuxtLink>
      </template>
      <template v-else>
        <NuxtLink to="/login" class="text-brand-accent underline">
          Sign in
        </NuxtLink>
        to submit your product.
      </template>
    </p>
  </main>
</template>
