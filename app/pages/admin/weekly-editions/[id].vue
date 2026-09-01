<script setup lang="ts">
import type { AdminEdition } from '~/composables/useAdminEditions'
import { toErrorLike } from '~/utils/error-like'

definePageMeta({ middleware: 'admin' })
useHead({ title: 'Admin · Weekly edition', meta: [{ name: 'robots', content: 'noindex,nofollow' }] })

const route = useRoute()
const { get } = useAdminEditions()
const { waitForAuthReady } = useAuth()
const edition = ref<AdminEdition | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const normalizedEditionId = computed(() => typeof route.params.id === 'string' ? route.params.id.trim() : '')
let loadSequence = 0
let authReady = false

function errorMessage(caught: unknown, fallback: string): string {
  const err = toErrorLike(caught)
  return err.data?.message ?? err.data?.error ?? err.message ?? fallback
}

async function load(): Promise<void> {
  const sequence = ++loadSequence
  if (!normalizedEditionId.value) {
    error.value = 'This edition record is unavailable.'
    loading.value = false
    return
  }
  loading.value = true
  error.value = null
  try {
    const response = await get(normalizedEditionId.value)
    if (sequence !== loadSequence) return
    edition.value = response
  }
  catch (caught: unknown) {
    if (sequence === loadSequence) error.value = errorMessage(caught, 'The weekly edition could not be loaded.')
  }
  finally {
    if (sequence === loadSequence) loading.value = false
  }
}

watch(normalizedEditionId, () => {
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
    <ReleaseShell eyebrow="Operator desk · weekly record" :title="edition?.slug ?? 'Weekly edition'" description="Arrange grounded launch evidence, then publish a single immutable release record.">
      <NuxtLink to="/admin/weekly-editions" class="inline-flex font-mono text-xs font-semibold uppercase tracking-[0.1em] text-release-paper-muted underline decoration-release-seam underline-offset-4 hover:text-release-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-warning">← Back to weekly editions</NuxtLink>
      <div v-if="loading" class="mt-8 border border-release-seam bg-release-rail p-8"><AppSpinner label="Loading weekly edition" /><p class="mt-3 font-mono text-xs uppercase tracking-[0.14em] text-release-paper-muted">Loading release record</p></div>
      <div v-else-if="error" role="alert" class="mt-8 border border-release-destructive/40 bg-release-destructive/10 px-4 py-3 text-sm text-release-destructive">{{ error }}</div>
      <AdminEditionEditor v-else-if="edition" class="mt-8" :edition="edition" @updated="edition = $event" />
    </ReleaseShell>
  </div>
</template>
