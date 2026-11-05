import { ref, readonly } from 'vue'

// Light / dark colour theme. The colours themselves live in src/styles/app.css under
// :root[data-theme="dark"] and :root[data-theme="light"]; this file only picks one.
// index.html applies the saved theme before anything renders (no flash); keep its key and default in step.
export const THEME_KEY = 'gs-theme'
export const THEMES = ['dark', 'light']
const DEFAULT_THEME = 'dark' // the original look

function savedTheme() {
  try {
    const value = localStorage.getItem(THEME_KEY)
    return THEMES.includes(value) ? value : null
  } catch {
    return null // storage blocked (private mode, disabled cookies): use the default
  }
}

function saveTheme(name) {
  try {
    localStorage.setItem(THEME_KEY, name)
  } catch {
    // Not saved, but the switch still works for this visit.
  }
}

function applyTheme(name) {
  document.documentElement.dataset.theme = name
}

const theme = ref(THEMES.includes(document.documentElement.dataset.theme)
  ? document.documentElement.dataset.theme
  : savedTheme() ?? DEFAULT_THEME)
applyTheme(theme.value)

/** The current value of a CSS colour variable, e.g. themeColor('--travel-globe-atmosphere'). */
export function themeColor(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export function useTheme() {
  function setTheme(name) {
    if (!THEMES.includes(name)) return
    theme.value = name
    applyTheme(name)
    saveTheme(name)
  }
  const toggleTheme = () => setTheme(theme.value === 'dark' ? 'light' : 'dark')
  return { theme: readonly(theme), setTheme, toggleTheme }
}
