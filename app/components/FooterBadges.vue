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
  {
    href: 'https://www.producthunt.com/products/launchlog-2?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-launchlog-2',
    src: 'https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1159923&theme=dark',
    alt: 'LaunchLog — The log of what just shipped, engineered for AI citations | Product Hunt',
    width: 250,
    height: 54,
  },
]

// Repeat the base set enough times to overflow the container width, then
// duplicate that whole half so translateX(-50%) loops seamlessly. With only
// a couple of badges this is what keeps the strip flowing full-width instead
// of clumping on the left with empty space to the right.
const REPEAT = 6
const half = Array.from({ length: REPEAT }, () => badges).flat()
const track = computed(() => [...half, ...half])
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

        <ul class="marquee flex w-max items-center gap-6">
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
                class="h-10 w-auto"
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
  animation: scroll-x 45s linear infinite;
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
