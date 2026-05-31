<template>
  <div class="flex min-h-screen flex-col bg-brand-bg text-brand-fg font-sans antialiased">
    <AppBar />
    <main class="flex-1">
      <slot />
    </main>
    <Footer />
  </div>
</template>
