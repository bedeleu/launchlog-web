interface PreviewPublishingModeInput {
  authReady: boolean
  isAdmin: boolean
  checkoutReserved: boolean
}

interface PreviewPublishingMode {
  kind: 'pending' | 'checkout' | 'admin'
  cancelCheckout: boolean
}

export const resolvePreviewPublishingMode = ({
  authReady,
  isAdmin,
  checkoutReserved,
}: PreviewPublishingModeInput): PreviewPublishingMode => {
  if (!authReady) {
    return { kind: 'pending', cancelCheckout: false }
  }

  if (isAdmin) {
    return { kind: 'admin', cancelCheckout: checkoutReserved }
  }

  return { kind: 'checkout', cancelCheckout: false }
}
