const STATUS_FLOW = [
  'sent',
  'confirmed',
  'contract_signed',
  'awaiting_payment',
  'commission_available',
  'done'
]

const RESERVING_STATUSES = STATUS_FLOW.slice(1, -1)
const TERMINAL_STATUSES = ['done', 'rejected', 'expired', 'cancelled']
// Statuses that only the server or the application author can set.
const SYSTEM_STATUSES = ['expired', 'cancelled']
const INITIAL_DEADLINE_DAYS = 7

function statusLabelRu (status) {
  return {
    sent: 'Заявка отправлена',
    confirmed: 'Заявка подтверждена',
    contract_signed: 'Договор заключен',
    awaiting_payment: 'Ожидание оплаты',
    commission_available: 'Комиссия доступна',
    done: 'Завершено',
    rejected: 'Отклонена',
    expired: 'Истек срок',
    cancelled: 'Отозвана автором'
  }[status] || 'Статус обновлен'
}

function isPastDeadline (application, now = new Date()) {
  return application.status === 'sent' && application.expiresAt &&
    new Date(application.expiresAt).getTime() <= now.getTime()
}

function assertStatusTransition (current, next) {
  if (SYSTEM_STATUSES.includes(next)) throw { status: 400, message: 'Этот статус нельзя установить вручную' }
  if (current === next) return
  if (TERMINAL_STATUSES.includes(current)) {
    throw { status: 409, message: 'Завершённую или отменённую заявку нельзя изменить' }
  }
  if (next === 'rejected') return
  const from = STATUS_FLOW.indexOf(current)
  const to = STATUS_FLOW.indexOf(next)
  if (from < 0 || to <= from) {
    throw { status: 400, message: 'Нельзя перевести заявку на предыдущий этап' }
  }
}

module.exports = {
  STATUS_FLOW,
  RESERVING_STATUSES,
  TERMINAL_STATUSES,
  SYSTEM_STATUSES,
  INITIAL_DEADLINE_DAYS,
  statusLabelRu,
  isPastDeadline,
  assertStatusTransition
}
