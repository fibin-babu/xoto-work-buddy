export const suspendedMessage = "Your access has been suspended. Contact your admin.";

/** Supabase reports a suspended (banned) account as "User is banned"; say it in plain words. */
export function friendlySignInError(message: string | undefined) {
  if (!message) return "Sign in failed";
  if (/banned/i.test(message)) return suspendedMessage;
  return message;
}
