type ContactStatus = "pending" | "accepted" | "declined";

/** Email is shared only after the candidate accepts the contact request. */
export function emailSharedOnAccept(status: ContactStatus | null | undefined, email: string | null | undefined) {
  if (status !== "accepted" || !email) return null;
  return email;
}
