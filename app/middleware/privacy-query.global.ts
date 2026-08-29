import type { LocationQueryRaw } from 'vue-router'
import { stripRedditClickId } from '~/utils/privacy-query'

export default defineNuxtRouteMiddleware((to) => {
  const result = stripRedditClickId(to.query)
  if (!result.changed) return

  return navigateTo({
    path: to.path,
    query: result.query as LocationQueryRaw,
    hash: to.hash,
  }, {
    redirectCode: 302,
    replace: true,
  })
})
