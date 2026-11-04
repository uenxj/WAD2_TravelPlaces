import { shallowRef, readonly } from 'vue'

// The signed-in user. Only the server can say who that is: it is set from /api/auth/me,
// login or sign-up responses, never from a local flag or a route query.
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

export class AuthError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

// The session lives in an HttpOnly cookie that the browser sends by itself, so no token is
// handled here.
async function request(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch('/api/auth' + path, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    throw new AuthError('Could not reach the server. Check your connection and that the API is running.', 0)
  }
  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const detail = data?.details?.length ? ': ' + data.details.join('; ') : ''
    throw new AuthError((data?.error || `Request failed (${res.status})`) + detail, res.status)
  }
  return data
}

/** Ask the server who is signed in. Call once before the router starts. Never throws. */
export async function initAuth() {
  try {
    currentUser.value = (await request('/me')).user
  } catch {
    currentUser.value = null // signed out, or the API is not running: browse as a guest
  }
}

export async function login(email, password) {
  const { user: verified } = await request('/login', { method: 'POST', body: { email, password } })
  setAuthenticatedUser(verified)
  return verified
}

export async function signup(name, email, password) {
  const { user: verified } = await request('/signup', { method: 'POST', body: { name, email, password } })
  setAuthenticatedUser(verified)
  return verified
}

export async function logout() {
  try {
    await request('/logout', { method: 'POST' })
  } finally {
    setAuthenticatedUser(null) // signed out in this tab even if the request failed
  }
}
