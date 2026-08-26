export type ContactTopic = 'listing_claim' | 'support' | 'billing' | 'general'

export interface ContactRequestPayload {
  topic: ContactTopic
  name: string
  email: string
  website: string
  message: string
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
      body: {
        topic: payload.topic,
        name: payload.name,
        email: payload.email,
        website: payload.website,
        message: payload.message,
      },
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
  }

  const resetContactForm = (form: ContactRequestPayload, verifiedEmail: string | null): void => {
    Object.assign(form, {
      topic: 'support',
      name: '',
      email: verifiedEmail ?? '',
      website: '',
      message: '',
    })
  }

  return { resetContactForm, sendContactRequest }
}
