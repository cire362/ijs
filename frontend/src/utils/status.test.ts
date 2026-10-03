import { describe, expect, test } from 'vitest'
import { isCustomComment, nextManagerStatuses } from './status'

describe('application statuses', () => {
  test('managers move forward or reject; server and author statuses are never offered', () => {
    expect(nextManagerStatuses('sent')).toEqual(['confirmed', 'contract_signed', 'awaiting_payment', 'commission_available', 'done', 'rejected'])
    expect(nextManagerStatuses('awaiting_payment')).toEqual(['commission_available', 'done', 'rejected'])
    for (const status of ['done', 'rejected', 'expired', 'cancelled'] as const) expect(nextManagerStatuses(status)).toEqual([])
  })

  test('default server comments are hidden in the history', () => {
    expect(isCustomComment('Заявка отправлена')).toBe(false)
    expect(isCustomComment('Клиент выбрал другой дом')).toBe(true)
    expect(isCustomComment(null)).toBe(false)
  })
})
