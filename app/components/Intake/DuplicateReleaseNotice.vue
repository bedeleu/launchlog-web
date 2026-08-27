<script setup lang="ts">
const props = defineProps<{
  action: 'manage' | 'claim'
  domain: string
  listingPath?: string | null
  dashboardPath?: string | null
  claimPath: string
}>()

const ownershipPath = computed(() =>
  props.action === 'manage' ? (props.dashboardPath || '/dashboard') : props.claimPath,
)
</script>

<template>
  <ReleaseActionRail
    data-duplicate-release-notice
    step="Release already cataloged"
    title="This website already has a LaunchLog record."
    description="No duplicate payment is needed. Open the public record or verify ownership before changing it."
  >
    <ReleaseStateMarker
      state="warning"
      label="Duplicate protected"
      :detail="domain"
    />

    <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
      <NuxtLink
        v-if="listingPath"
        :to="listingPath"
        class="inline-flex min-h-11 items-center justify-center border border-release-paper bg-release-paper px-4 text-sm font-semibold text-release-ink transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-warning"
      >View listing</NuxtLink>
      <NuxtLink
        :to="ownershipPath"
        class="inline-flex min-h-11 items-center justify-center border border-release-seam px-4 text-sm font-semibold text-[#f6f1e7] transition-colors hover:border-release-paper-muted hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-warning"
      >{{ action === 'manage' ? 'Manage listing' : 'Request ownership' }}</NuxtLink>
    </div>
  </ReleaseActionRail>
</template>
