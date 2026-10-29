import { ref, readonly } from 'vue'

const enabled = ref(false)
try { enabled.value = sessionStorage.getItem('travel-ui-preview') === 'on' } catch { /* Storage may be unavailable. */ }
export const previewMode = readonly(enabled)
export function setPreviewMode(value) {
  enabled.value = value
  try {
    if (value) sessionStorage.setItem('travel-ui-preview', 'on')
    else sessionStorage.removeItem('travel-ui-preview')
  } catch { /* The current tab can still preview without persistence. */ }
}
