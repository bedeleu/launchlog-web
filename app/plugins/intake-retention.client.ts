export default defineNuxtPlugin(() => {
  // Instantiate once on every client load so expired private-preview recovery
  // state is pruned even when the visitor lands on a non-intake route.
  useIntakeStore()
})
