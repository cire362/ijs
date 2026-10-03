import type { PersonRef } from '@/api/types'

const TIME_ZONE = 'Europe/Moscow'
const rub = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })
const rubExact = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const number = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 })

export function formatPrice (value: string | number | null | undefined, exact = false): string {
  if (value == null || value === '') return 'Цена по запросу'
  const amount = Number(value)
  if (!Number.isFinite(amount)) return 'Цена по запросу'
  return (exact ? rubExact : rub).format(amount)
}

export function formatArea (value: number | null | undefined, unit: 'м²' | 'сот.' = 'м²'): string {
  return value == null ? '' : `${number.format(value)} ${unit}`
}

export function formatPercent (value: string | number | null | undefined): string {
  if (value == null || value === '') return ''
  return `${number.format(Number(value))}%`
}

function toDate (value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDate (value: string | Date | null | undefined): string {
  const date = toDate(value)
  return date ? date.toLocaleDateString('ru-RU', { timeZone: TIME_ZONE, day: 'numeric', month: 'long', year: 'numeric' }) : ''
}

export function formatDateTime (value: string | Date | null | undefined): string {
  const date = toDate(value)
  return date
    ? date.toLocaleString('ru-RU', { timeZone: TIME_ZONE, day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    : ''
}

export function formatShortDateTime (value: string | Date | null | undefined): string {
  const date = toDate(value)
  return date ? date.toLocaleString('ru-RU', { timeZone: TIME_ZONE, dateStyle: 'short', timeStyle: 'short' }) : ''
}

const relative = new Intl.RelativeTimeFormat('ru-RU', { numeric: 'auto' })

export function formatRelative (value: string | Date | null | undefined, now = Date.now()): string {
  const date = toDate(value)
  if (!date) return ''
  const seconds = Math.round((date.getTime() - now) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 60) return 'только что'
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return relative.format(Math.round(seconds / 3600), 'hour')
  if (abs < 86400 * 7) return relative.format(Math.round(seconds / 86400), 'day')
  return formatDate(date)
}

export function personName (person: Partial<PersonRef> | null | undefined, fallback = ''): string {
  if (!person) return fallback
  const name = [person.lastName, person.firstName, person.middleName].filter(Boolean).join(' ').trim()
  return name || person.companyName || person.email || fallback
}

export function initials (person: Partial<PersonRef> | null | undefined): string {
  const parts = [person?.firstName, person?.lastName].filter(Boolean) as string[]
  const source = parts.length ? parts : [person?.companyName || person?.email || '?']
  return source.map((part) => part.trim()[0] ?? '').join('').slice(0, 2).toUpperCase()
}

export function pluralize (count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

export function formatFileSize (bytes: number | null | undefined): string {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`
  return `${number.format(bytes / 1024 / 1024)} МБ`
}

// Russian phone: digits only, normalized to +7 XXX XXX-XX-XX as the backend stores it.
export function formatPhone (value: string | null | undefined): string {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length !== 11 || !/^[78]/.test(digits)) return value || ''
  const p = digits.slice(1)
  return `+7 ${p.slice(0, 3)} ${p.slice(3, 6)}-${p.slice(6, 8)}-${p.slice(8, 10)}`
}

export function isValidRuPhone (value: string | null | undefined): boolean {
  const digits = String(value || '').replace(/\D/g, '')
  return digits.length === 11 && /^[78]/.test(digits)
}

export function mediaUrl (url: string | null | undefined): string {
  return url || ''
}
