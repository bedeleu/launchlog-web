<script setup lang="ts">
import { LayoutDashboard, Menu, Search, ShieldCheck, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'

const route = useRoute()
const open = ref(false)
const { user, isAdmin, logout, waitForAuthReady } = useAuth()
const admin = ref(false)
const authReady = ref(false)

const nav = [
  { label: 'Home', to: '/' },
  { label: 'Browse All', to: '/browse-all' },
  { label: 'Tech Products', to: '/tech-products' },
  { label: 'Featured', to: '/featured' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'Blog', to: '/blog' },
  { label: 'Contact', to: '/contact' },
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
  authReady.value = true
})

// Close the mobile drawer on navigation.
watch(() => route.path, () => { open.value = false })
watch(user, async () => {
  admin.value = user.value ? await isAdmin() : false
})
</script>

<template>
  <header lang="en" class="sticky top-0 z-50 border-b border-release-seam bg-release-ink">
    <div class="grid h-1 grid-cols-[clamp(7rem,18vw,18rem)_1fr]" aria-hidden="true">
      <span class="bg-release-blaze" />
      <span class="bg-release-rail" />
    </div>

    <div class="mx-auto flex h-16 max-w-[96rem] items-center justify-between gap-4 border-x border-release-seam px-4 sm:px-6">
      <!-- Brand -->
      <NuxtLink to="/" class="flex shrink-0 items-center gap-2.5">
        <img src="/images/logo.webp" alt="LaunchLog" width="32" height="32" class="size-8">
        <span class="text-lg font-bold tracking-tight text-[#f6f1e7]">
          LaunchLog<span class="text-release-paper-muted">.ai</span>
        </span>
      </NuxtLink>

      <!-- Desktop nav -->
      <nav class="hidden items-center gap-1 lg:flex">
        <NuxtLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          class="border-b px-3 py-2 font-mono text-[0.72rem] font-semibold tracking-[0.05em] transition-colors"
          :class="isActive(item.to)
            ? 'border-release-blaze text-release-paper'
            : 'border-transparent text-release-paper-muted hover:border-release-seam hover:text-release-paper'"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>

      <!-- Desktop actions -->
      <div class="hidden items-center gap-2 lg:flex">
        <NuxtLink to="/browse-all" aria-label="Search products" class="border border-transparent p-2 text-release-paper-muted transition-colors hover:border-release-seam hover:text-release-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus">
          <Search class="size-5" />
        </NuxtLink>
        <template v-if="authReady">
          <Button
            v-if="user"
            as-child
            variant="outline"
            size="sm"
            class="text-release-paper"
          >
            <NuxtLink
              to="/dashboard"
              :aria-current="isActive('/dashboard') ? 'page' : undefined"
            >
              <LayoutDashboard aria-hidden="true" />
              Dashboard
            </NuxtLink>
          </Button>
          <NuxtLink
            v-if="admin"
            to="/admin"
            :aria-current="isActive('/admin') ? 'page' : undefined"
            class="inline-flex items-center gap-1.5 border-b border-transparent px-3 py-2 font-mono text-xs font-semibold tracking-[0.06em] text-release-paper-muted transition-colors hover:border-release-blaze hover:text-release-paper"
          >
            <ShieldCheck aria-hidden="true" class="size-4" />
            Admin
          </NuxtLink>
          <button v-if="user" type="button" class="border border-transparent px-3 py-2 text-sm font-medium text-release-paper-muted transition-colors hover:border-release-seam hover:text-release-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus" @click="signOut">
            Sign out
          </button>
          <NuxtLink v-else to="/login" class="border border-transparent px-3 py-2 text-sm font-medium text-release-paper-muted transition-colors hover:border-release-seam hover:text-release-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus">
            Login
          </NuxtLink>
        </template>
        <Button as-child>
          <NuxtLink to="/submit">Get started</NuxtLink>
        </Button>
      </div>

      <!-- Mobile toggle -->
      <button
        class="border border-release-seam p-2 text-release-paper transition-colors hover:border-release-paper-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus lg:hidden"
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
      <div v-if="open" class="border-t border-release-seam bg-release-ink lg:hidden">
        <nav class="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
          <NuxtLink
            v-for="item in nav"
            :key="item.to"
            :to="item.to"
            class="border-l-2 px-3 py-2.5 text-sm font-medium transition-colors"
            :class="isActive(item.to) ? 'border-release-blaze bg-release-rail text-release-paper' : 'border-transparent text-release-paper-muted hover:border-release-seam hover:text-release-paper'"
          >
            {{ item.label }}
          </NuxtLink>
          <div class="mt-2 grid gap-2 border-t border-release-seam pt-3">
            <template v-if="authReady">
              <template v-if="user">
                <Button
                  as-child
                  variant="outline"
                  size="lg"
                  class="w-full text-release-paper"
                >
                  <NuxtLink
                    to="/dashboard"
                    :aria-current="isActive('/dashboard') ? 'page' : undefined"
                  >
                    <LayoutDashboard aria-hidden="true" />
                    Dashboard
                  </NuxtLink>
                </Button>
                <div class="grid gap-2" :class="admin ? 'grid-cols-2' : 'grid-cols-1'">
                  <NuxtLink
                    v-if="admin"
                    to="/admin"
                    :aria-current="isActive('/admin') ? 'page' : undefined"
                    class="inline-flex min-h-11 items-center justify-center gap-1.5 border border-release-seam px-3 text-sm font-medium text-release-paper-muted transition-colors hover:border-release-blaze hover:bg-release-rail hover:text-release-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus"
                  >
                    <ShieldCheck aria-hidden="true" class="size-4" />
                    Admin
                  </NuxtLink>
                  <button type="button" class="min-h-11 border border-release-seam px-3 text-center text-sm font-medium text-release-paper-muted transition-colors hover:bg-release-rail hover:text-release-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus" @click="signOut">
                    Sign out
                  </button>
                </div>
              </template>
              <NuxtLink v-else to="/login" class="min-h-11 border border-release-seam px-3 py-2.5 text-center text-sm font-medium text-release-paper-muted hover:bg-release-rail hover:text-release-paper">
                Login
              </NuxtLink>
            </template>
            <Button as-child size="lg" class="w-full">
              <NuxtLink to="/submit">Get started</NuxtLink>
            </Button>
          </div>
        </nav>
      </div>
    </Transition>
  </header>
</template>
