<template>
  <div class="flex min-h-screen flex-col bg-release-ink font-sans text-[#f6f1e7] antialiased">
    <AppBar />
    <main class="flex-1">
      <slot />
    </main>
    <Footer />
  </div>
</template>
