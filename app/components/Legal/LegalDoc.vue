<script setup lang="ts">
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
  contactEmail?: string
}>()
</script>

<template>
  <ContentReadingShell :label="eyebrow" :title="title" :intro="intro" wide>
    <template #meta>
      <ContentReadingMeta :items="[{ label: 'Last updated', value: updated }]" />
    </template>

    <div class="grid gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16">
      <aside class="lg:sticky lg:top-24 lg:self-start">
        <p class="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-release-paper-muted">
          On this page
        </p>
        <nav class="mt-4 border-l border-release-seam" aria-label="On this page">
          <a
            v-for="section in sections"
            :key="section.id"
            :href="`#${section.id}`"
            class="-ml-px block border-l border-transparent py-2 pl-4 text-sm leading-5 text-release-paper-muted transition-colors hover:border-release-blaze hover:text-[#f6f1e7] focus-visible:border-release-focus focus-visible:text-[#f6f1e7] focus-visible:outline-none"
          >
            {{ section.title }}
          </a>
        </nav>
      </aside>

      <article class="reading-prose min-w-0">
        <section
          v-for="section in sections"
          :id="section.id"
          :key="section.id"
          class="scroll-mt-24 border-t border-release-seam pt-10 first:border-t-0 first:pt-0 [&:not(:first-child)]:mt-12"
        >
          <h2>{{ section.title }}</h2>
          <div class="mt-6 space-y-5">
            <template v-for="(block, b) in section.blocks" :key="b">
              <h3 v-if="block.type === 'subhead'" class="pt-2">
                {{ block.text }}
              </h3>
              <ul v-else-if="block.type === 'list'">
                <li v-for="(item, i) in block.items" :key="i">
                  {{ item }}
                </li>
              </ul>
              <p v-else>
                {{ block.text }}
              </p>
            </template>
          </div>
        </section>

        <div class="mt-14 border-l-2 border-release-blaze bg-release-rail px-5 py-4">
          <p class="text-sm leading-7 text-release-paper-muted">
            <template v-if="contactEmail">
              Questions about this policy? Email
              <a :href="`mailto:${contactEmail}`">{{ contactEmail }}</a>
              or use the
            </template>
            <template v-else>
              No public policy mailbox is currently configured. Check the
            </template>
            <NuxtLink to="/contact">contact page</NuxtLink>.
          </p>
        </div>
      </article>
    </div>
  </ContentReadingShell>
</template>
