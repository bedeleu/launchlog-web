<script setup lang="ts">
// Reciprocal "Featured on" badges from partner directories.
// Add new entries as backlink exchanges are made. For >10 badges,
// download the SVG/PNG into /public/images/badges/ instead of hotlinking.
interface Badge {
  href: string
  src: string
  alt: string
  width: number
  height?: number
}

const badges: Badge[] = [
  {
    href: 'https://deeplaunch.io',
    src: 'https://deeplaunch.io/badge/badge_dark.svg',
    alt: 'Featured on DeepLaunch.io',
    width: 200,
    height: 54,
  },
  {
    href: 'https://ufind.best/products/launchlogai?utm_source=ufind.best',
    src: 'https://ufind.best/badges/ufind-best-badge-dark.svg',
    alt: 'Featured on ufind.best',
    width: 150,
  },
]

// Duplicate the list so the marquee loops seamlessly.
const track = computed(() => [...badges, ...badges])
</script>

<template>
  <section
    v-if="badges.length"
    aria-label="Featured on"
    class="border-t border-brand-border bg-brand-bg/60"
  >
    <div class="mx-auto max-w-7xl px-4 py-6">
      <p class="mb-4 text-center text-xs font-semibold uppercase tracking-wider text-brand-muted/70">
        Featured on
      </p>

      <div class="group relative overflow-hidden">
        <!-- edge fades -->
        <div class="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-brand-bg to-transparent" />
        <div class="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-brand-bg to-transparent" />

        <ul class="marquee flex w-max items-center gap-10">
          <li
            v-for="(badge, i) in track"
            :key="`${badge.href}-${i}`"
            class="shrink-0"
            :aria-hidden="i >= badges.length ? 'true' : undefined"
          >
            <a
              :href="badge.href"
              target="_blank"
              rel="noopener"
              class="block opacity-70 transition-opacity hover:opacity-100"
            >
              <img
                :src="badge.src"
                :alt="badge.alt"
                :width="badge.width"
                :height="badge.height"
                loading="lazy"
                decoding="async"
                style="height: auto"
              >
            </a>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<style scoped>
.marquee {
  animation: scroll-x 30s linear infinite;
}

/* Pause when the user hovers the strip. */
.group:hover .marquee {
  animation-play-state: paused;
}

@keyframes scroll-x {
  from {
    transform: translateX(0);
  }
  to {
    /* shift by half the track (the duplicated copy) for a seamless loop */
    transform: translateX(-50%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .marquee {
    animation: none;
    flex-wrap: wrap;
    justify-content: center;
  }
}
</style>
