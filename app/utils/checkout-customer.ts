export const resolveCheckoutEmail = (
  authenticatedEmail: string | null | undefined,
  enteredEmail: string,
): string => (authenticatedEmail ?? enteredEmail).trim()
