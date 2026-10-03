import { describe, expect, test } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { propertyImageUrl } from './propertyImages'

describe('property images', () => {
  test('legacy seed records resolve to bundled demo photos', () => {
    for (const url of [
      '/uploads/seed/prop-1-1.svg',
      '/uploads/seed/prop-1-2.svg',
      '/uploads/seed/prop-2-1.svg',
      '/uploads/seed/prop-3-1.svg'
    ]) {
      const image = propertyImageUrl(url)
      expect(image).toMatch(/^\/demo\/houses\/.+\.webp$/)
      expect(existsSync(resolve(process.cwd(), 'public', image.slice(1)))).toBe(true)
    }
  })

  test('real uploads, remote photos and unknown seed files stay unchanged', () => {
    for (const url of [
      '/uploads/properties/house.jpg',
      'https://cdn.example.com/uploads/seed/prop-1-1.svg',
      '/uploads/seed/other-house.svg',
      '/demo/houses/brick-house.webp'
    ]) expect(propertyImageUrl(url)).toBe(url)
  })

  test('missing photos do not show a fictitious house', () => {
    expect(propertyImageUrl(null)).toBe('')
    expect(propertyImageUrl(undefined)).toBe('')
    expect(propertyImageUrl('')).toBe('')
  })
})
