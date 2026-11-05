import { ref, onMounted, onBeforeUnmount } from 'vue'

export function useReducedMotion() {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  const reducedMotion = ref(media.matches)
  const update = () => { reducedMotion.value = media.matches }
  onMounted(() => media.addEventListener('change', update))
  onBeforeUnmount(() => media.removeEventListener('change', update))
  return reducedMotion
}
