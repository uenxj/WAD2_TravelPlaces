// Bundled URLs for the item pictures (Vite resolves these at build time; served locally).
import { artFor } from './itemArt.js'

const files = import.meta.glob('../assets/checklist/items/*.svg', { eager: true, query: '?url', import: 'default' })
const URLS = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.split('/').pop().replace('.svg', ''), url]),
)

/** URL of the picture for a checklist item. */
export const artUrl = (item) => URLS[artFor(item)] ?? URLS.backpack
