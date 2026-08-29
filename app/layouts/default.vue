<template>
  <div class="flex min-h-screen flex-col bg-release-ink font-sans text-[#f6f1e7] antialiased">
    <PrivacyConsentManager />
    <AppBar />
    <main id="main-content" tabindex="-1" class="flex-1 focus:outline-none">
      <slot />
    </main>
    <Footer />
  </div>
</template>
