<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ExistingListingConflict } from '~/composables/usePreviews'
import { existingListingConflictFromError } from '~/composables/usePreviews'

withDefaults(defineProps<{
  stacked?: boolean
}>(), {
  stacked: false,
})

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
  <form class="w-full" novalidate :data-intake-layout="stacked ? 'stacked' : 'responsive'" @submit="onSubmit">
    <label for="preview-url" class="block font-mono text-[0.68rem] font-semibold tracking-[0.12em] text-release-paper-muted uppercase">
      Website URL
    </label>
    <div
      data-intake-controls
      :class="['mt-2 flex gap-3', stacked ? 'flex-col' : 'flex-col sm:flex-row']"
    >
      <Input
        id="preview-url"
        v-model="url"
        v-bind="urlAttrs"
        type="url"
        inputmode="url"
        placeholder="https://yourproduct.com"
        autocomplete="url"
        :disabled="submitting"
        class="h-12 w-full min-w-0 flex-1 text-base"
      />
      <Button
        type="submit"
        size="lg"
        :class="['h-12 w-full shrink-0 px-5', stacked ? '' : 'sm:w-48']"
        :disabled="submitting"
      >
        <AppSpinner v-if="submitting" color="text-current" />
        <span class="inline-block truncate">{{ submitting ? 'Checking website…' : 'Preview my listing' }}</span>
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
      data-release-duplicate
      class="mt-4 border border-release-seam border-l-2 border-l-release-warning bg-release-rail p-5"
      aria-live="polite"
    >
      <p class="font-mono text-[0.68rem] font-semibold tracking-[0.16em] text-release-warning uppercase">
        {{ existingListing.action === 'manage' ? 'Already in your account' : 'Already on LaunchLog' }}
      </p>
      <h2 class="mt-2 break-words text-lg font-semibold text-[#f6f1e7]">
        {{ existingListing.domain }} is already represented.
      </h2>
      <p class="mt-2 text-sm leading-6 text-release-paper-muted">
        <template v-if="existingListing.action === 'manage'">
          Open your dashboard to manage the existing listing. We won't create or charge for a duplicate.
        </template>
        <template v-else>
          We never reassign a listing from a URL alone. Send an ownership request and our team will verify it.
        </template>
      </p>
      <div :class="['mt-4 gap-3', stacked ? 'grid grid-cols-1 sm:grid-cols-2' : 'flex flex-wrap']">
        <NuxtLink
          v-if="existingListing.action === 'manage'"
          :to="existingListing.dashboard_path || '/dashboard'"
          :class="['inline-flex h-10 items-center justify-center border border-release-paper bg-release-paper px-4 text-sm font-semibold text-release-ink transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus', stacked ? 'w-full' : '']"
        >
          Manage listing
        </NuxtLink>
        <NuxtLink
          v-else
          :to="claimPath"
          :class="['inline-flex h-10 items-center justify-center border border-release-paper bg-release-paper px-4 text-sm font-semibold text-release-ink transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus', stacked ? 'w-full' : '']"
        >
          Request ownership
        </NuxtLink>
        <NuxtLink
          v-if="existingListing.listing_path"
          :to="existingListing.listing_path"
          :class="['inline-flex h-10 items-center justify-center border border-release-seam px-4 text-sm font-medium text-release-paper transition-colors hover:border-release-paper-muted hover:bg-[#1a1c16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus', stacked ? 'w-full' : '']"
        >
          View listing
        </NuxtLink>
      </div>
    </section>

    <p v-if="!existingListing && (known || intake.latestDraft)" class="mt-5 text-sm text-release-paper-muted">
      Already generated a preview?
      <NuxtLink :to="`/preview/${(known ?? intake.latestDraft)!.token}`" class="text-release-blaze underline underline-offset-4">
        Resume {{ (known ?? intake.latestDraft)!.domain }}
      </NuxtLink>
    </p>
  </form>
</template>
