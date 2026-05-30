<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const { createPreview } = usePreviews()
const intake = useIntakeStore()

const submitting = ref(false)
const serverError = ref<string | null>(null)

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

const onSubmit = handleSubmit(async (values) => {
  submitting.value = true
  serverError.value = null
  intake.rememberSubmittedUrl(values.url)
  try {
    // Already have a usable preview for this exact URL → jump straight to it.
    const existing = intake.previewForUrl(values.url)
    if (existing) {
      await navigateTo(`/preview/${existing.token}`)
      return
    }

    const preview = await createPreview(values.url)
    intake.rememberPreview(preview)
    await navigateTo(`/preview/${preview.token}`)
  }
  catch (e: unknown) {
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
      <Button type="submit" size="lg" class="h-12 px-6" :disabled="submitting">
        <AppSpinner v-if="submitting" color="text-current" />
        {{ submitting ? 'Generating preview…' : (known ? 'View your preview' : 'Preview my listing') }}
      </Button>
    </div>

    <FieldMessage
      class="mt-2"
      :error="errors.url ?? serverError"
      hint="Preview your listing for free. Pay only when you publish."
    />

    <p v-if="known || intake.latestDraft" class="mt-5 text-sm text-brand-muted">
      Already generated a preview?
      <NuxtLink :to="`/preview/${(known ?? intake.latestDraft)!.token}`" class="text-brand-accent underline underline-offset-4">
        Resume {{ (known ?? intake.latestDraft)!.domain }}
      </NuxtLink>
    </p>
  </form>
</template>
