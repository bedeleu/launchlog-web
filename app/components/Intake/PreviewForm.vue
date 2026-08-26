<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ExistingListingConflict } from '~/composables/usePreviews'
import { existingListingConflictFromError } from '~/composables/usePreviews'

const { createPreview } = usePreviews()
const intake = useIntakeStore()

const submitting = ref(false)
const serverError = ref<string | null>(null)
const existingListing = ref<ExistingListingConflict | null>(null)

const schema = toTypedSchema(
  z.object({
    url: z
      .string()
      .min(1, 'Enter your website URL')
      .url('Enter a valid URL')
      .refine(v => /^https?:\/\//i.test(v), 'URL must start with http:// or https://'),
  }),
)

const { handleSubmit, defineField, errors } = useForm({
  validationSchema: schema,
  initialValues: {
    url: intake.lastUrl || '',
  },
})
const [url, urlAttrs] = defineField('url')

const known = computed(() => intake.previewForUrl((url.value as string) || ''))
const claimPath = computed(() => existingListing.value
  ? `/contact?topic=listing_claim&website=${encodeURIComponent(`https://${existingListing.value.domain}`)}`
  : '/contact?topic=listing_claim')

watch(url, () => {
  existingListing.value = null
  serverError.value = null
})

const onSubmit = handleSubmit(async (values) => {
  submitting.value = true
  serverError.value = null
  existingListing.value = null
  intake.rememberSubmittedUrl(values.url)
  try {
    // Always ask the API first. A locally remembered preview cannot prove that
    // the canonical domain is still unclaimed or belongs to this account.
    const preview = await createPreview(values.url)
    intake.rememberPreview(preview)
    await navigateTo(`/preview/${preview.token}`)
  }
  catch (e: unknown) {
    existingListing.value = existingListingConflictFromError(e)
    if (existingListing.value) return

    const err = e as { data?: { message?: string, errors?: Record<string, string[]> } }
    serverError.value
      = err?.data?.errors?.url?.[0]
        ?? err?.data?.message
        ?? 'We could not generate a preview for that URL. Please try another.'
  }
  finally {
    submitting.value = false
  }
})
</script>

<template>
  <form class="w-full max-w-xl" novalidate @submit="onSubmit">
    <label for="preview-url" class="block text-sm font-medium text-brand-fg">
      Website URL
    </label>
    <div class="mt-2 flex flex-col gap-3 sm:flex-row">
      <Input
        id="preview-url"
        v-model="url"
        v-bind="urlAttrs"
        type="url"
        inputmode="url"
        placeholder="https://yourproduct.com"
        autocomplete="url"
        :disabled="submitting"
        class="h-12 flex-1 text-base"
      />
      <Button type="submit" size="lg" class="h-12 w-full px-6 sm:w-48" :disabled="submitting">
        <AppSpinner v-if="submitting" color="text-current" />
        {{ submitting ? 'Checking website…' : 'Preview my listing' }}
      </Button>
    </div>

    <FieldMessage
      v-if="!existingListing"
      class="mt-2"
      :error="errors.url ?? serverError"
      hint="Preview your listing for free. Pay only when you publish."
    />

    <section
      v-else
      class="mt-4 overflow-hidden rounded-xl border border-brand-accent/35 bg-[linear-gradient(135deg,rgba(99,102,241,0.12),rgba(255,255,255,0.025))] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.24)]"
      aria-live="polite"
    >
      <p class="text-xs font-semibold uppercase tracking-[0.16em] text-brand-accent">
        {{ existingListing.action === 'manage' ? 'Already in your account' : 'Already on LaunchLog' }}
      </p>
      <h2 class="mt-2 break-words text-lg font-semibold text-brand-fg">
        {{ existingListing.domain }} is already represented.
      </h2>
      <p class="mt-2 text-sm leading-6 text-brand-muted">
        <template v-if="existingListing.action === 'manage'">
          Open your dashboard to manage the existing listing. We won't create or charge for a duplicate.
        </template>
        <template v-else>
          We never reassign a listing from a URL alone. Send an ownership request and our team will verify it.
        </template>
      </p>
      <div class="mt-4 flex flex-wrap gap-3">
        <NuxtLink
          v-if="existingListing.action === 'manage'"
          :to="existingListing.dashboard_path || '/dashboard'"
          class="inline-flex h-10 items-center justify-center rounded-md bg-brand-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/60"
        >
          Manage listing
        </NuxtLink>
        <NuxtLink
          v-else
          :to="claimPath"
          class="inline-flex h-10 items-center justify-center rounded-md bg-brand-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/60"
        >
          Request ownership
        </NuxtLink>
        <NuxtLink
          v-if="existingListing.listing_path"
          :to="existingListing.listing_path"
          class="inline-flex h-10 items-center justify-center rounded-md border border-brand-border px-4 text-sm font-medium text-brand-fg transition-colors hover:border-brand-accent/50 hover:bg-white/[0.04]"
        >
          View it
        </NuxtLink>
      </div>
    </section>

    <p v-if="!existingListing && (known || intake.latestDraft)" class="mt-5 text-sm text-brand-muted">
      Already generated a preview?
      <NuxtLink :to="`/preview/${(known ?? intake.latestDraft)!.token}`" class="text-brand-accent underline underline-offset-4">
        Resume {{ (known ?? intake.latestDraft)!.domain }}
      </NuxtLink>
    </p>
  </form>
</template>
