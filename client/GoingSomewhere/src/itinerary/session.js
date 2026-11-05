import { loginLink } from '../services/auth.js'

/**
 * If an API error means the session ended (401), send the person to the login page and come back
 * to this page afterwards. Returns true when it did, so the caller can stop.
 */
export function redirectIfSignedOut(error, router, route) {
  if (error?.status !== 401) return false
  router.replace(loginLink(route.fullPath, '/discover'))
  return true
}
