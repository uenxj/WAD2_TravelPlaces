import { shallowRef, readonly } from 'vue'

// Authentication integration seam. Never populate this from an unverified local flag.
const currentUser = shallowRef(null)
export const user = readonly(currentUser)
export function setAuthenticatedUser(verifiedUser) {
  currentUser.value = verifiedUser
}

export function safeReturnPath(value, fallback = '/trips') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') ||
      /[\\\x00-\x20]/.test(value) || /^\/login(?:[/?#]|$)/i.test(value)) return fallback
  return value
}

export function loginLink(redirect, from = '/discover', intent) {
  return { path: '/login', query: { redirect: safeReturnPath(redirect), from: safeReturnPath(from, '/discover'), ...(intent ? { intent } : {}) } }
}
