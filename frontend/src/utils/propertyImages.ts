// Compatibility with demo records already created by backend/src/seed.js.
// Only these exact seed URLs are replaced; uploaded property photos pass through.
const demoImages = new Map([
  ['/uploads/seed/prop-1-1.svg', '/demo/houses/plaster-house.webp'],
  ['/uploads/seed/prop-1-2.svg', '/demo/houses/timber-house.webp'],
  ['/uploads/seed/prop-2-1.svg', '/demo/houses/brick-house.webp'],
  ['/uploads/seed/prop-3-1.svg', '/demo/houses/modern-house.webp']
])

export function propertyImageUrl (url: string | null | undefined): string {
  if (!url) return ''
  return demoImages.get(url) ?? url
}
