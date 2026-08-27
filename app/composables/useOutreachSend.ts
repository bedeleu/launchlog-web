export interface OutreachSendPayload {
  recipientEmail: string
  subject: string
  text: string
  requestId: string
}

export interface OutreachSendResult {
  request_id: string
  status: 'accepted'
}

interface OutreachSendResponse {
  data: OutreachSendResult
  message: string
}

export const useOutreachSend = () => {
  const config = useRuntimeConfig()
  const { getIdToken } = useAuth()

  const send = async (payload: OutreachSendPayload): Promise<OutreachSendResult> => {
    const token = await getIdToken()
    if (!token) throw new Error('Not authenticated')

    const response = await $fetch<OutreachSendResponse>(
      `${config.public.apiUrl}/api/v1/admin/outreach/send`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: {
          recipient_email: payload.recipientEmail,
          subject: payload.subject,
          text: payload.text,
          request_id: payload.requestId,
        },
      },
    )

    return response.data
  }

  return { send }
}
