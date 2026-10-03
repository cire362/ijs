import type { ApplicationStatus, EventFormat, RegistrationStatus, SaleStatus } from '@/api/types'

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

export const APPLICATION_FLOW: ApplicationStatus[] = ['sent', 'confirmed', 'contract_signed', 'awaiting_payment', 'commission_available', 'done']
export const RESERVING_STATUSES: ApplicationStatus[] = ['confirmed', 'contract_signed', 'awaiting_payment', 'commission_available']
export const TERMINAL_STATUSES: ApplicationStatus[] = ['done', 'rejected', 'expired', 'cancelled']

export const APPLICATION_STATUS: Record<ApplicationStatus, { label: string, tone: Tone }> = {
  sent: { label: 'Отправлена', tone: 'accent' },
  confirmed: { label: 'Подтверждена', tone: 'accent' },
  contract_signed: { label: 'Договор заключён', tone: 'accent' },
  awaiting_payment: { label: 'Ожидает оплаты', tone: 'warning' },
  commission_available: { label: 'Комиссия доступна', tone: 'success' },
  done: { label: 'Завершена', tone: 'success' },
  rejected: { label: 'Отклонена', tone: 'danger' },
  expired: { label: 'Истёк срок', tone: 'neutral' },
  cancelled: { label: 'Отозвана автором', tone: 'neutral' }
}

// Default history comments written by the server; they repeat the status and are not shown.
const SERVER_STATUS_COMMENTS = new Set(['Заявка отправлена', 'Заявка подтверждена', 'Договор заключен', 'Ожидание оплаты', 'Комиссия доступна', 'Завершено', 'Отклонена', 'Истек срок', 'Отозвана автором', 'Статус обновлен'])
export function isCustomComment (comment: string | null | undefined): comment is string {
  return Boolean(comment && !SERVER_STATUS_COMMENTS.has(comment))
}

// Statuses a developer or administrator may choose next; `expired` and `cancelled` are set by the server or the author.
export function nextManagerStatuses (current: ApplicationStatus): ApplicationStatus[] {
  if (TERMINAL_STATUSES.includes(current)) return []
  const index = APPLICATION_FLOW.indexOf(current)
  return [...APPLICATION_FLOW.slice(index + 1), 'rejected']
}

export function isActiveApplication (status: ApplicationStatus): boolean {
  return !TERMINAL_STATUSES.includes(status)
}

export const SALE_STATUS: Record<SaleStatus, { label: string, tone: Tone }> = {
  available: { label: 'Свободен', tone: 'success' },
  reserved: { label: 'Забронирован', tone: 'warning' },
  sold: { label: 'Продан', tone: 'neutral' }
}

export const REGISTRATION_STATUS: Record<RegistrationStatus, { label: string, tone: Tone }> = {
  new: { label: 'На рассмотрении', tone: 'accent' },
  approved: { label: 'Подтверждена', tone: 'success' },
  rejected: { label: 'Отклонена', tone: 'danger' }
}

export const EVENT_FORMAT: Record<EventFormat, string> = {
  offline: 'Офлайн',
  online: 'Онлайн',
  hybrid: 'Гибрид'
}

export const ROLE_LABEL: Record<string, string> = {
  agent: 'Агент',
  individual: 'Физическое лицо',
  developer: 'Застройщик',
  admin: 'Администратор'
}
