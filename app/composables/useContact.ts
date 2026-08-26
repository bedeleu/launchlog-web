export type ContactTopic = 'listing_claim' | 'support' | 'billing' | 'general'

export interface ContactRequestPayload {
  topic: ContactTopic
  name: string
  email: string
  website: string
  message: string
  company: string
}

export const useContact = () => {
  const config = useRuntimeConfig()
  const { getIdToken, waitForAuthReady } = useAuth()
  const endpoint = `${config.public.apiUrl}/api/v1/contact`

  const sendContactRequest = async (payload: ContactRequestPayload): Promise<void> => {
    await waitForAuthReady()
    const token = await getIdToken()
    await $fetch(endpoint, {
      method: 'POST',
      body: payload,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
  }

  return { sendContactRequest }
}
