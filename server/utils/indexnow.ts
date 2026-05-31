// server/utils/indexnow.ts
// IndexNow key is PUBLIC by design — it is served at https://launchlog.ai/<key>.txt
// so search engines can verify ownership. Not a secret; safe to keep in the repo.
// The matching verification file lives at public/<INDEXNOW_KEY>.txt.
export const INDEXNOW_KEY = 'f275d8550832ee6252d00fe9d2aa6a38'

// Ping IndexNow (Bing, Yandex, Seznam, …) so new/updated URLs get re-crawled fast.
export async function pingIndexNow(urls: string[]): Promise<void> {
  if (urls.length === 0) return
  const host = 'launchlog.ai'
  await $fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    body: {
      host,
      key: INDEXNOW_KEY,
      keyLocation: `https://${host}/${INDEXNOW_KEY}.txt`,
      urlList: urls,
    },
    timeout: 5000,
  })
}
