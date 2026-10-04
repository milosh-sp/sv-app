export function isInternalServerCall(context: { internalCall?: boolean }, debugBypass = false) {
  return context.internalCall === true || debugBypass;
}
