<script setup lang="ts">
import { ImageOff } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const route = useRoute()
const token = route.params.token as string
const { getPreview, updatePreview } = usePreviews()

// Private artifact — must never be indexed (D-057).
useSeoMeta({
  title: 'Your listing preview | LaunchLog',
  robots: 'noindex, nofollow',
})

const { data: preview, error } = await useAsyncData(`preview-${token}`, () => getPreview(token))

const form = reactive({
  title: preview.value?.title ?? '',
  tagline: preview.value?.tagline ?? '',
  description: preview.value?.description ?? '',
  email: preview.value?.email ?? '',
})

const screenshotFailed = computed(() =>
  preview.value?.status === 'failed' && preview.value?.error_code === 'screenshot_failed',
)
const crawlFailed = computed(() =>
  preview.value?.status === 'failed' && preview.value?.error_code !== 'screenshot_failed',
)

const saving = ref(false)
const saveError = ref<string | null>(null)

const continueToCheckout = async () => {
  saving.value = true
  saveError.value = null
  try {
    await updatePreview(token, {
      title: form.title || null,
      tagline: form.tagline || null,
      description: form.description || null,
      email: form.email || null,
    })
    await navigateTo(`/checkout?preview=${token}&tier=basic`)
  }
  catch (e: unknown) {
    const err = e as { data?: { message?: string, errors?: Record<string, string[]> } }
    saveError.value
      = Object.values(err?.data?.errors ?? {})[0]?.[0]
        ?? err?.data?.message
        ?? 'Could not save your changes. Please try again.'
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <main class="mx-auto max-w-5xl px-6 py-16">
    <div v-if="error || !preview" class="text-center">
      <h1 class="text-3xl font-bold text-brand-fg">
        Preview not found
      </h1>
      <p class="mt-3 text-brand-muted">
        This preview may have expired (previews last 7 days) or the link is invalid.
      </p>
      <NuxtLink to="/" class="mt-6 inline-block text-brand-accent underline">
        Start a new preview
      </NuxtLink>
    </div>

    <div v-else class="grid gap-10 lg:grid-cols-2">
      <section>
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">
          Live preview
        </p>
        <Card class="mt-3 overflow-hidden">
          <div class="aspect-video w-full bg-muted">
            <img
              v-if="preview.screenshot_url"
              :src="preview.screenshot_url"
              :alt="`Screenshot of ${preview.domain}`"
              class="h-full w-full object-cover"
            >
            <div
              v-else
              class="flex h-full flex-col items-center justify-center gap-2 px-6 text-center"
            >
              <ImageOff class="size-6 text-brand-muted" />
              <p class="text-sm text-brand-muted">
                {{ screenshotFailed
                  ? "We couldn't capture a screenshot yet. You can edit the text, but publishing requires a screenshot."
                  : "Preview couldn't be generated — try editing the details below." }}
              </p>
            </div>
          </div>
          <CardContent class="pt-5">
            <h3 class="text-lg font-semibold text-brand-fg">
              {{ form.title || 'Untitled listing' }}
            </h3>
            <p v-if="form.tagline" class="mt-1 text-sm text-brand-muted">
              {{ form.tagline }}
            </p>
            <p class="mt-3 text-xs text-brand-accent">
              {{ preview.domain }}
            </p>
          </CardContent>
        </Card>

        <p
          v-if="crawlFailed"
          class="mt-3 text-sm text-brand-warning"
        >
          We couldn't fetch your site's details automatically — fill them in on the right.
        </p>
      </section>

      <section>
        <h1 class="text-3xl font-bold text-brand-fg">
          Review your listing
        </h1>
        <p class="mt-2 text-brand-muted">
          This is how your listing will appear. Edit anything, then choose a plan to publish.
        </p>

        <div class="mt-6 space-y-4">
          <div class="space-y-1.5">
            <Label for="f-title">Title</Label>
            <Input id="f-title" v-model="form.title" placeholder="Your product name" />
          </div>
          <div class="space-y-1.5">
            <Label for="f-tagline">Tagline</Label>
            <Input id="f-tagline" v-model="form.tagline" placeholder="One line about what you do" />
          </div>
          <div class="space-y-1.5">
            <Label for="f-description">Description</Label>
            <textarea
              id="f-description"
              v-model="form.description"
              rows="4"
              placeholder="A short description of your product"
              class="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="f-email">Email</Label>
            <Input id="f-email" v-model="form.email" type="email" placeholder="you@yourproduct.com" />
            <p class="text-xs text-brand-muted">
              We'll create your account with this email after checkout.
            </p>
          </div>
        </div>

        <FieldMessage class="mt-4" :error="saveError" :lines="2" />

        <Button
          size="lg"
          class="mt-2 w-full"
          :disabled="saving"
          @click="continueToCheckout"
        >
          {{ saving ? 'Saving…' : 'Choose plan & publish' }}
        </Button>
        <p class="mt-3 text-center text-xs text-brand-muted">
          Pay only when you publish · 7-day money-back guarantee
        </p>
      </section>
    </div>
  </main>
</template>
