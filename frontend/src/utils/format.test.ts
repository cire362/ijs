import { describe, expect, test } from 'vitest'
import { formatPhone, formatPrice, isValidRuPhone, personName, pluralize } from './format'

describe('format', () => {
  test('prices are shown in rubles without kopecks, missing prices are explained', () => {
    expect(formatPrice('7104156.00').replace(/\s/g, ' ')).toBe('7 104 156 ₽')
    expect(formatPrice(null)).toBe('Цена по запросу')
    expect(formatPrice('1500.5', true).replace(/\s/g, ' ')).toBe('1 500,50 ₽')
  })

  test('Russian phones are normalized like the backend stores them', () => {
    expect(formatPhone('8 (915) 444-12-37')).toBe('+7 915 444-12-37')
    expect(formatPhone('+79154441237')).toBe('+7 915 444-12-37')
    expect(formatPhone('12345')).toBe('12345')
    expect(isValidRuPhone('89154441237')).toBe(true)
    expect(isValidRuPhone('+1 555 123 4567')).toBe(false)
  })

  test('Russian plural forms', () => {
    expect([1, 2, 5, 11, 21, 22, 25].map((n) => pluralize(n, 'день', 'дня', 'дней'))).toEqual(['день', 'дня', 'дней', 'дней', 'день', 'дня', 'дней'])
  })

  test('person names fall back to company and email', () => {
    expect(personName({ lastName: 'Соколова', firstName: 'Марина' })).toBe('Соколова Марина')
    expect(personName({ companyName: 'СЗ Озеро', email: 'a@b.ru' })).toBe('СЗ Озеро')
    expect(personName(null, 'Агент')).toBe('Агент')
  })
})
