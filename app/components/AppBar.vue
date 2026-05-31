<script setup lang="ts">
import { Menu, Search, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'

const route = useRoute()
const open = ref(false)
const { user, isAdmin, logout, waitForAuthReady } = useAuth()
const admin = ref(false)

const nav = [
  { label: 'Home', to: '/' },
  { label: 'Browse All', to: '/browse-all' },
  { label: 'Tech Products', to: '/tech-products' },
  { label: 'Featured', to: '/featured' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'Blog', to: '/blog' },
]

const isActive = (to: string) =>
  to === '/' ? route.path === '/' : route.path === to || route.path.startsWith(`${to}/`)

const signOut = async () => {
  await logout()
  await navigateTo('/')
}

onMounted(async () => {
  await waitForAuthReady()
  admin.value = await isAdmin()
})

// Close the mobile drawer on navigation.
watch(() => route.path, () => { open.value = false })
watch(user, async () => {
  admin.value = user.value ? await isAdmin() : false
})
</script>

<template>
  <header class="sticky top-0 z-50 border-b border-brand-border bg-brand-bg/80 backdrop-blur-md">
    <!-- thin accent rule along the very top, like the reference -->
    <div class="h-0.5 w-full bg-gradient-to-r from-brand-accent/0 via-brand-accent/70 to-brand-accent/0" />

    <div class="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
      <!-- Brand -->
      <NuxtLink to="/" class="flex shrink-0 items-center gap-2.5">
        <img src="/images/logo.webp" alt="LaunchLog" width="32" height="32" class="size-8">
        <span class="text-lg font-bold tracking-tight text-brand-fg">
          LaunchLog<span class="text-brand-muted">.ai</span>
        </span>
      </NuxtLink>

      <!-- Desktop nav -->
      <nav class="hidden items-center gap-1 lg:flex">
        <NuxtLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          class="rounded-md px-3 py-2 text-sm font-medium transition-colors"
          :class="isActive(item.to)
            ? 'bg-white/[0.06] text-brand-fg'
            : 'text-brand-muted hover:text-brand-fg'"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>

      <!-- Desktop actions -->
      <div class="hidden items-center gap-2 lg:flex">
        <NuxtLink to="/browse-all" aria-label="Search products" class="rounded-md p-2 text-brand-muted transition-colors hover:text-brand-fg">
          <Search class="size-5" />
        </NuxtLink>
        <NuxtLink v-if="admin" to="/admin/listings" class="px-3 py-2 text-sm font-medium text-emerald-300 transition-colors hover:text-brand-fg">
          Admin
        </NuxtLink>
        <NuxtLink v-if="user && !admin" to="/dashboard" class="px-3 py-2 text-sm font-medium text-brand-muted transition-colors hover:text-brand-fg">
          Dashboard
        </NuxtLink>
        <button v-if="user" type="button" class="px-3 py-2 text-sm font-medium text-brand-muted transition-colors hover:text-brand-fg" @click="signOut">
          Sign out
        </button>
        <NuxtLink v-else to="/login" class="px-3 py-2 text-sm font-medium text-brand-muted transition-colors hover:text-brand-fg">
          Login
        </NuxtLink>
        <Button as-child>
          <NuxtLink to="/submit">Get started</NuxtLink>
        </Button>
      </div>

      <!-- Mobile toggle -->
      <button
        class="rounded-md p-2 text-brand-fg lg:hidden"
        :aria-expanded="open"
        aria-label="Toggle menu"
        @click="open = !open"
      >
        <component :is="open ? X : Menu" class="size-6" />
      </button>
    </div>

    <!-- Mobile drawer -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <div v-if="open" class="border-t border-brand-border bg-brand-bg lg:hidden">
        <nav class="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
          <NuxtLink
            v-for="item in nav"
            :key="item.to"
            :to="item.to"
            class="rounded-md px-3 py-2.5 text-sm font-medium transition-colors"
            :class="isActive(item.to) ? 'bg-white/[0.06] text-brand-fg' : 'text-brand-muted hover:text-brand-fg'"
          >
            {{ item.label }}
          </NuxtLink>
          <div class="mt-2 flex items-center gap-2 border-t border-brand-border pt-3">
            <NuxtLink v-if="admin" to="/admin/listings" class="flex-1 rounded-md px-3 py-2.5 text-center text-sm font-medium text-emerald-300 hover:text-brand-fg">
              Admin
            </NuxtLink>
            <NuxtLink v-else-if="user" to="/dashboard" class="flex-1 rounded-md px-3 py-2.5 text-center text-sm font-medium text-brand-muted hover:text-brand-fg">
              Dashboard
            </NuxtLink>
            <NuxtLink v-else to="/login" class="flex-1 rounded-md px-3 py-2.5 text-center text-sm font-medium text-brand-muted hover:text-brand-fg">
              Login
            </NuxtLink>
            <button v-if="user" type="button" class="flex-1 rounded-md px-3 py-2.5 text-center text-sm font-medium text-brand-muted hover:text-brand-fg" @click="signOut">
              Sign out
            </button>
            <Button as-child class="flex-1">
              <NuxtLink to="/submit">Get started</NuxtLink>
            </Button>
          </div>
        </nav>
      </div>
    </Transition>
  </header>
</template>
