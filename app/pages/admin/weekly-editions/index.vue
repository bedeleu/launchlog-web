<script setup lang="ts">
import type { AdminEditionPage } from '~/composables/useAdminEditions'
import { toErrorLike } from '~/utils/error-like'

definePageMeta({ middleware: 'admin' })
useHead({ title: 'Admin · Weekly editions', meta: [{ name: 'robots', content: 'noindex,nofollow' }] })

const route = useRoute()
const router = useRouter()
const { list, create } = useAdminEditions()
const { waitForAuthReady } = useAuth()

const editions = ref<AdminEditionPage | null>(null)
const loading = ref(true)
const pendingAction = ref<'create' | null>(null)
const error = ref<string | null>(null)
const listError = ref<string | null>(null)
const message = ref('')
const slug = ref('')
const introduction = ref('')
const slugError = ref<string | null>(null)

const normalizedPage = computed(() => {
  const value = Array.isArray(route.query.page) ? route.query.page[0] : route.query.page
  const page = typeof value === 'string' ? Number.parseInt(value, 10) : 1
  return Number.isSafeInteger(page) && page > 0 ? page : 1
})
let loadSequence = 0
let authReady = false

function errorMessage(caught: unknown, fallback: string): string {
  const err = toErrorLike(caught)
  return err.data?.message ?? err.data?.error ?? err.message ?? fallback
}

function validateSlug(): boolean {
  const value = slug.value.trim()
  if (!value) {
    slugError.value = 'Enter an ISO week slug such as 2026-w35.'
    return false
  }
  if (!/^\d{4}-w(?:0[1-9]|[1-4]\d|5[0-3])$/.test(value)) {
    slugError.value = 'Use the ISO week format YYYY-w01 through YYYY-w53.'
    return false
  }
  slugError.value = null
  return true
}

async function load(targetPage = normalizedPage.value): Promise<void> {
  const sequence = ++loadSequence
  loading.value = true
  listError.value = null
  editions.value = null
  try {
    const response = await list(targetPage)
    if (sequence !== loadSequence) return
    if (targetPage > response.meta.last_page) {
      await router.replace({ query: response.meta.last_page > 1 ? { page: String(response.meta.last_page) } : {} })
      return
    }
    editions.value = response
  }
  catch (caught: unknown) {
    if (sequence === loadSequence) {
      editions.value = null
      listError.value = errorMessage(caught, 'Weekly editions could not be loaded.')
    }
  }
  finally {
    if (sequence === loadSequence) loading.value = false
  }
}

async function createEdition(): Promise<void> {
  if (pendingAction.value || !validateSlug()) return
  pendingAction.value = 'create'
  error.value = null
  try {
    const edition = await create({ slug: slug.value.trim(), introduction: introduction.value.trim() || null })
    message.value = `${edition.slug} draft created.`
    await navigateTo(`/admin/weekly-editions/${encodeURIComponent(edition.id)}`)
  }
  catch (caught: unknown) {
    error.value = errorMessage(caught, 'The weekly edition could not be created.')
  }
  finally {
    pendingAction.value = null
  }
}

async function changePage(page: number): Promise<void> {
  if (loading.value || !editions.value || page < 1 || page > editions.value.meta.last_page) return
  await router.push({ query: page > 1 ? { page: String(page) } : {} })
}

watch(normalizedPage, () => {
  if (authReady) void load()
})

onMounted(async () => {
  await waitForAuthReady()
  authReady = true
  await load()
})
</script>

<template>
  <div class="min-h-screen bg-release-ink">
    <ReleaseShell eyebrow="Operator desk · weekly record" title="Weekly editions" description="Assemble one verified release record for an ISO week, then publish it as an immutable editorial snapshot.">
      <NuxtLink to="/admin" class="inline-flex font-mono text-xs font-semibold uppercase tracking-[0.1em] text-release-paper-muted underline decoration-release-seam underline-offset-4 hover:text-release-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-warning">← Back to admin</NuxtLink>

      <p aria-live="polite" class="sr-only">{{ message }}</p>
      <div v-if="error" role="alert" class="mt-6 border border-release-destructive/40 bg-release-destructive/10 px-4 py-3 text-sm text-release-destructive">{{ error }}</div>

      <section class="mt-6 border border-release-seam bg-release-rail p-4 sm:p-6" aria-labelledby="create-edition-heading">
        <p class="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-release-warning">New weekly record</p>
        <h2 id="create-edition-heading" class="mt-1 text-lg font-semibold text-release-paper">Start a draft</h2>
        <form class="mt-5 grid gap-4" novalidate @submit.prevent="createEdition">
          <label class="grid gap-1.5 text-sm text-release-paper"><span>ISO week slug</span><input v-model="slug" :disabled="pendingAction === 'create'" :aria-invalid="!!slugError" :aria-describedby="slugError ? 'edition-slug-error' : undefined" placeholder="2026-w35" class="release-field h-11 w-full px-3 text-sm" @input="slugError = null"><span v-if="slugError" id="edition-slug-error" role="alert" class="text-xs text-release-destructive">{{ slugError }}</span></label>
          <label class="grid gap-1.5 text-sm text-release-paper"><span>Introduction <span class="text-release-paper-muted">(optional)</span></span><textarea v-model="introduction" :disabled="pendingAction === 'create'" maxlength="3000" class="release-field min-h-24 w-full px-3 py-2.5 text-sm" /></label>
          <div><button type="submit" class="min-h-11 border border-release-paper bg-release-paper px-4 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-release-ink hover:border-release-warning hover:bg-release-warning active:border-release-paper active:bg-release-paper/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus disabled:cursor-not-allowed disabled:opacity-50" :disabled="pendingAction === 'create'" :aria-busy="pendingAction === 'create'">{{ pendingAction === 'create' ? 'Creating…' : 'Create draft' }}</button></div>
        </form>
      </section>

      <section class="mt-8" aria-labelledby="edition-list-heading">
        <div class="flex flex-wrap items-end justify-between gap-3"><div><p class="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-release-paper-muted">Newest first</p><h2 id="edition-list-heading" class="mt-1 text-lg font-semibold text-release-paper">Edition records</h2></div><span v-if="editions" class="font-mono text-xs text-release-paper-muted">{{ editions.meta.total }} total</span></div>

        <div v-if="loading" class="mt-5 border border-release-seam bg-release-rail p-8"><AppSpinner label="Loading weekly editions" /><p class="mt-3 font-mono text-xs uppercase tracking-[0.14em] text-release-paper-muted">Loading release records</p></div>
        <div v-else-if="listError" role="alert" class="mt-5 border border-release-destructive/40 bg-release-destructive/10 px-4 py-3 text-sm text-release-destructive">{{ listError }}</div>
        <p v-else-if="!editions?.data.length" class="mt-5 border border-release-seam bg-release-rail p-6 text-sm text-release-paper-muted">No weekly editions yet. Start the first draft above.</p>
        <ul v-else class="mt-5 grid gap-3">
          <li v-for="edition in editions.data" :key="edition.id" class="border border-release-seam bg-release-rail p-4 transition-colors hover:border-release-paper-muted">
            <NuxtLink :to="`/admin/weekly-editions/${encodeURIComponent(edition.id)}`" class="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus">
              <div class="flex flex-wrap items-start justify-between gap-3"><div><p class="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-release-paper-muted">{{ edition.week_starts_at }}</p><h3 class="mt-1 font-semibold text-release-paper">{{ edition.slug }}</h3><p class="mt-2 text-sm leading-6 text-release-paper-muted">{{ edition.introduction || 'No introduction yet.' }}</p></div><span class="border border-release-seam bg-release-ink px-2 py-1 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-release-paper-muted">{{ edition.status }}</span></div>
            </NuxtLink>
          </li>
        </ul>
        <nav v-if="editions && editions.meta.last_page > 1" class="mt-5 flex items-center justify-between gap-3 border-t border-release-seam pt-5" aria-label="Weekly edition pages"><button type="button" class="min-h-11 border border-release-seam px-4 font-mono text-xs text-release-paper hover:border-release-warning hover:text-release-warning active:border-release-paper active:bg-release-paper/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus disabled:cursor-not-allowed disabled:opacity-50" :disabled="loading || !editions.links.prev" @click="changePage(editions.meta.current_page - 1)">Previous</button><span class="font-mono text-xs text-release-paper-muted">Page {{ editions.meta.current_page }} of {{ editions.meta.last_page }}</span><button type="button" class="min-h-11 border border-release-seam px-4 font-mono text-xs text-release-paper hover:border-release-warning hover:text-release-warning active:border-release-paper active:bg-release-paper/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus disabled:cursor-not-allowed disabled:opacity-50" :disabled="loading || !editions.links.next" @click="changePage(editions.meta.current_page + 1)">Next</button></nav>
      </section>
    </ReleaseShell>
  </div>
</template>
