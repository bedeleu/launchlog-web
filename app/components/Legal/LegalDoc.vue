<script setup lang="ts">
/**
 * Shared chrome for long-form legal/policy pages (privacy, terms, cookies, dmca).
 *
 * Keeps the editorial layout — eyebrow, title, last-updated, sticky table of
 * contents and block-rendered sections — identical across every legal document
 * so the four pages read as one cohesive, professionally maintained set.
 *
 * Content is passed as structured blocks (no v-html) so styling stays on-brand
 * and there is no XSS surface from policy copy.
 */
interface Block {
  // 'p' | 'subhead' | 'list' — kept as string so page-level inline arrays
  // (which widen the literal to string) satisfy the prop type without `as const`.
  type: string
  text?: string
  items?: string[]
}

interface Section {
  id: string
  title: string
  blocks: Block[]
}

defineProps<{
  eyebrow: string
  title: string
  intro: string
  updated: string
  sections: Section[]
}>()
</script>

<template>
  <main class="mx-auto max-w-6xl px-6 py-14 md:py-20">
    <!-- Hero -->
    <header class="max-w-3xl">
      <p class="text-sm font-semibold uppercase tracking-[0.18em] text-brand-muted">
        {{ eyebrow }}
      </p>
      <h1 class="mt-5 text-4xl font-bold tracking-normal text-white md:text-5xl">
        {{ title }}
      </h1>
      <p class="mt-6 text-lg leading-8 text-brand-muted">
        {{ intro }}
      </p>
      <div class="mt-7 inline-flex items-center gap-2 rounded-full border border-brand-border bg-white/[0.03] px-3.5 py-1.5">
        <span class="size-1.5 rounded-full bg-brand-success" aria-hidden="true" />
        <span class="text-xs font-medium text-brand-muted">Last updated {{ updated }}</span>
      </div>
    </header>

    <div class="mt-14 grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">
      <!-- Table of contents -->
      <aside class="lg:sticky lg:top-24 lg:self-start">
        <p class="text-xs font-semibold uppercase tracking-wider text-brand-muted/80">
          On this page
        </p>
        <nav class="mt-4 border-l border-brand-border">
          <a
            v-for="(section, index) in sections"
            :key="section.id"
            :href="`#${section.id}`"
            class="block border-l border-transparent -ml-px py-1.5 pl-4 text-sm text-brand-muted transition-colors hover:border-brand-accent hover:text-white"
          >
            <span class="font-mono text-xs text-brand-accent/70">{{ String(index + 1).padStart(2, '0') }}</span>
            <span class="ml-2">{{ section.title }}</span>
          </a>
        </nav>
      </aside>

      <!-- Sections -->
      <article class="min-w-0">
        <section
          v-for="(section, index) in sections"
          :key="section.id"
          :id="section.id"
          class="scroll-mt-24 border-t border-brand-border pt-10 first:border-t-0 first:pt-0 [&:not(:first-child)]:mt-10"
        >
          <h2 class="flex items-baseline gap-3 text-2xl font-semibold text-white">
            <span class="font-mono text-sm text-brand-accent">{{ String(index + 1).padStart(2, '0') }}</span>
            {{ section.title }}
          </h2>
          <div class="mt-5 space-y-4">
            <template v-for="(block, b) in section.blocks" :key="b">
              <h3
                v-if="block.type === 'subhead'"
                class="pt-2 text-base font-semibold text-white"
              >
                {{ block.text }}
              </h3>
              <ul
                v-else-if="block.type === 'list'"
                class="space-y-2.5"
              >
                <li
                  v-for="(item, i) in block.items"
                  :key="i"
                  class="flex gap-3 leading-7 text-brand-muted"
                >
                  <span class="mt-2.5 size-1.5 shrink-0 rounded-full bg-brand-accent/60" aria-hidden="true" />
                  <span>{{ item }}</span>
                </li>
              </ul>
              <p
                v-else
                class="leading-7 text-brand-muted"
              >
                {{ block.text }}
              </p>
            </template>
          </div>
        </section>

        <!-- Footer help line -->
        <div class="mt-12 rounded-lg border border-brand-border bg-white/[0.03] p-6">
          <p class="text-sm leading-7 text-brand-muted">
            Questions about this policy? Email
            <a href="mailto:legal@launchlog.ai" class="font-medium text-brand-accent hover:underline">legal@launchlog.ai</a>
            or reach the team via the
            <NuxtLink to="/contact" class="font-medium text-brand-accent hover:underline">contact page</NuxtLink>.
          </p>
        </div>
      </article>
    </div>
  </main>
</template>
