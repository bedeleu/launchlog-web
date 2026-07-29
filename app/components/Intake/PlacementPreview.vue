<script setup lang="ts">
import { ImageOff, Search, Sparkles } from '@lucide/vue'
import type { Preview } from '~/composables/usePreviews'

const props = defineProps<{
  preview: Preview
  tier: string
  title: string
  tagline: string
  generating?: boolean
}>()

const isFeatured = computed(() => props.tier === 'featured')
const isPremium = computed(() => props.tier === 'premium')
const hasShot = computed(() => !!props.preview.screenshot_url)

const displayTitle = computed(() => props.title || props.preview.domain || 'Your product')
const displayTagline = computed(() => props.tagline || 'Your one-line pitch goes here')

const techEdge = ['schema.org', 'llms.txt', 'markdown']

// Real sample listing screenshots, blurred, to read as live directory context.
const samples = [
  '/images/samples/1.png',
  '/images/samples/2.png',
  '/images/samples/3.png',
  '/images/samples/4.png',
  '/images/samples/5.png',
]
</script>

<template>
  <div>
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-sm font-semibold uppercase tracking-[0.2em] text-brand-muted">
        Your LaunchLog placement
      </h2>
      <span class="shrink-0 rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-brand-muted ring-1 ring-white/10">
        Example placement preview
      </span>
    </div>

    <div class="mt-3 overflow-hidden rounded-2xl border border-brand-border bg-[#0c1120] shadow-2xl shadow-black/40">
      <div class="flex items-center gap-2 border-b border-brand-border bg-white/[0.03] px-4 py-2.5">
        <span class="size-2.5 rounded-full bg-white/15" />
        <span class="size-2.5 rounded-full bg-white/15" />
        <span class="size-2.5 rounded-full bg-white/15" />
        <div class="mx-auto flex items-center gap-1.5 rounded-md bg-black/30 px-3 py-1 text-xs text-brand-muted">
          <Search class="size-3" /> launchlog.ai/browse
        </div>
      </div>

      <div class="p-5">
        <!-- All three tiers stay mounted (v-show), so switching plans never destroys
             and re-loads the screenshot — the swap is instant. -->
        <!-- ============ FEATURED: one large unified card dominating the page ============ -->
        <div v-show="isFeatured" class="space-y-3">
          <article class="relative min-w-0 overflow-hidden rounded-2xl border-2 border-brand-accent/60 bg-brand-accent/[0.06] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)] ring-1 ring-brand-accent/20">
            <!-- Screenshots are normalized to exactly 16:10 (ScreenshotVariantGenerator),
                 so aspect-[16/10] + object-cover fills with no crop and no letterbox bands. -->
            <div class="aspect-[16/10] w-full overflow-hidden bg-muted">
              <img v-if="hasShot" :src="preview.screenshot_url!" :alt="`Screenshot of ${preview.domain}`" class="h-full w-full object-cover object-top">
              <div v-else class="flex h-full flex-col items-center justify-center gap-1.5 text-center">
                <template v-if="generating">
                  <AppSpinner size="size-6" label="Generating screenshot" />
                  <span class="text-xs text-brand-muted">Generating screenshot…</span>
                </template>
                <template v-else>
                  <ImageOff class="size-6 text-brand-muted" />
                  <span class="text-xs text-brand-muted">Screenshot required</span>
                </template>
              </div>
            </div>
            <div class="flex min-w-0 flex-col gap-2.5 p-6">
              <div class="flex flex-wrap items-center gap-2">
                <span class="rounded-full bg-brand-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-accent ring-1 ring-brand-accent/40">Featured</span>
                <span class="inline-flex items-center gap-1 text-[11px] font-medium text-brand-accent"><Sparkles class="size-3" /> Best visibility</span>
              </div>
              <h3 class="truncate text-2xl font-bold text-brand-fg">{{ displayTitle }}</h3>
              <p class="line-clamp-3 text-sm text-brand-muted">{{ displayTagline }}</p>
              <div class="flex flex-wrap items-center gap-1.5 pt-1">
                <span class="mr-1 text-[10px] font-semibold uppercase tracking-wider text-brand-muted/70">AI-readable</span>
                <span v-for="t in techEdge" :key="t" class="rounded-md bg-white/5 px-2 py-0.5 font-mono text-[10px] text-brand-muted ring-1 ring-white/10">{{ t }}</span>
              </div>
            </div>
          </article>
          <div class="grid select-none grid-cols-3 gap-3 opacity-45 blur-[2px]">
            <div v-for="n in 3" :key="n" class="overflow-hidden rounded-xl border border-brand-border bg-white/[0.02]">
              <div class="aspect-video w-full overflow-hidden bg-muted">
                <img :src="samples[(n - 1) % samples.length]" alt="" class="h-full w-full object-cover object-top">
              </div>
              <div class="space-y-1.5 p-2.5">
                <div class="h-1.5 w-2/3 rounded bg-white/10" />
                <div class="h-1.5 w-full rounded bg-white/[0.06]" />
              </div>
            </div>
          </div>
        </div>

        <!-- ============ PREMIUM: priority placement, two neighbors stacked + a row below ============ -->
        <div v-show="isPremium" class="space-y-3">
          <div class="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <article
              class="min-w-0 overflow-hidden rounded-xl border border-brand-accent/40 bg-white/[0.03] shadow-[0_12px_28px_-12px_rgba(0,0,0,0.5)]"
            >
              <div class="aspect-video w-full overflow-hidden border-b border-brand-border bg-muted">
                <img v-if="hasShot" :src="preview.screenshot_url!" :alt="`Screenshot of ${preview.domain}`" class="h-full w-full object-cover object-top">
                <div v-else class="flex h-full items-center justify-center">
                  <AppSpinner v-if="generating" size="size-5" label="Generating screenshot" />
                  <ImageOff v-else class="size-5 text-brand-muted" />
                </div>
              </div>
              <div class="p-3.5">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand-fg/80">Premium</span>
                  <span class="text-[10px] font-medium text-brand-fg/70">Priority placement</span>
                </div>
                <h3 class="mt-1.5 truncate text-base font-semibold text-brand-fg">{{ displayTitle }}</h3>
                <p class="mt-0.5 line-clamp-2 text-[11px] text-brand-muted">{{ displayTagline }}</p>
              </div>
            </article>

            <div class="grid grid-rows-2 gap-3">
              <div
                v-for="n in 2"
                :key="n"
                class="select-none overflow-hidden rounded-xl border border-brand-border bg-white/[0.02] opacity-60 blur-[1.5px]"
              >
                <div class="aspect-video w-full overflow-hidden bg-muted">
                  <img :src="samples[(n - 1) % samples.length]" alt="" class="h-full w-full object-cover object-top">
                </div>
                <div class="space-y-1.5 p-3">
                  <div class="h-1.5 w-2/3 rounded bg-white/10" />
                  <div class="h-1.5 w-full rounded bg-white/[0.06]" />
                </div>
              </div>
            </div>
          </div>

          <!-- Competitors below, so Premium reads as lifted above the crowd. -->
          <div class="grid select-none grid-cols-3 gap-3 opacity-50 blur-[2px]">
            <div v-for="n in 3" :key="n" class="overflow-hidden rounded-xl border border-brand-border bg-white/[0.02]">
              <div class="aspect-video w-full overflow-hidden bg-muted">
                <img :src="samples[(n + 1) % samples.length]" alt="" class="h-full w-full object-cover object-top">
              </div>
              <div class="space-y-1.5 p-2.5">
                <div class="h-1.5 w-2/3 rounded bg-white/10" />
                <div class="h-1.5 w-full rounded bg-white/[0.06]" />
              </div>
            </div>
          </div>
        </div>

        <!-- ============ BASIC: your card inside the standard directory grid ============ -->
        <div v-show="!isFeatured && !isPremium" class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <article class="min-w-0 overflow-hidden rounded-xl border border-brand-accent/40 bg-white/[0.03]">
            <div class="aspect-video w-full overflow-hidden border-b border-brand-border bg-muted">
              <img v-if="hasShot" :src="preview.screenshot_url!" :alt="`Screenshot of ${preview.domain}`" class="h-full w-full object-cover object-top">
              <div v-else class="flex h-full items-center justify-center">
                <AppSpinner v-if="generating" size="size-5" label="Generating screenshot" />
                <ImageOff v-else class="size-5 text-brand-muted" />
              </div>
            </div>
            <div class="p-3.5">
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand-fg/80">Basic</span>
                <span class="text-[10px] font-medium text-brand-accent">Your listing</span>
              </div>
              <h3 class="mt-1.5 truncate text-sm font-semibold text-brand-fg">{{ displayTitle }}</h3>
              <p class="mt-0.5 line-clamp-2 text-[11px] text-brand-muted">{{ displayTagline }}</p>
            </div>
          </article>

          <div
            v-for="n in 5"
            :key="n"
            class="select-none overflow-hidden rounded-xl border border-brand-border bg-white/[0.02] opacity-70 blur-[1px]"
          >
            <div class="aspect-video w-full overflow-hidden bg-muted">
              <img :src="samples[(n - 1) % samples.length]" alt="" class="h-full w-full object-cover object-top">
            </div>
            <div class="space-y-1.5 p-3">
              <div class="h-1.5 w-2/3 rounded bg-white/10" />
              <div class="h-1.5 w-full rounded bg-white/[0.06]" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <p class="mt-3 text-xs text-brand-muted">
      <template v-if="isFeatured">Featured puts you in the spotlight — everyone else fades behind you.</template>
      <template v-else-if="isPremium">Premium lifts you above the crowd with priority placement.</template>
      <template v-else>Basic lists you in the directory alongside everyone else.</template>
    </p>
  </div>
</template>
