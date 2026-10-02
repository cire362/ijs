const { Op, QueryTypes } = require('sequelize')
const { sequelize } = require('../db')
const { Event, EventRegistration, EventReminder, Notification } = require('../models')

async function scheduleEventReminder (event, agentId, transaction, minutesBefore = 60) {
  const [reminder] = await EventReminder.findOrCreate({
    where: { eventId: event.id, agentId, startAt: event.startAt, minutesBefore },
    defaults: { dueAt: new Date(new Date(event.startAt).getTime() - minutesBefore * 60000) },
    transaction
  })
  if (reminder.status === 'cancelled') await reminder.update({ status: 'pending' }, { transaction })
  return reminder
}

async function sendEventReminders ({ minutesBefore = 60, now = new Date(), limit = 100 } = {}) {
  // Also adopt existing registrations and rescheduled events, reviving a reminder cancelled
  // for the same start time. Delivery catches up until the event starts.
  await sequelize.query(`INSERT INTO event_reminders
    (event_id, agent_id, start_at, minutes_before, due_at, status, created_at, updated_at)
    SELECT e.id, r.agent_id, e.start_at, :minutesBefore,
      e.start_at - (:minutesBefore * INTERVAL '1 minute'), 'pending', :now, :now
    FROM events e JOIN event_registrations r ON r.event_id = e.id
    WHERE e.start_at > :now AND e.start_at <= :until AND e.cancelled_at IS NULL AND r.status <> 'rejected'
    ON CONFLICT (event_id, agent_id, start_at, minutes_before) DO UPDATE
      SET status = 'pending', due_at = EXCLUDED.due_at, updated_at = EXCLUDED.updated_at
      WHERE event_reminders.status = 'cancelled'`, {
    replacements: { now, until: new Date(now.getTime() + minutesBefore * 60000), minutesBefore }, type: QueryTypes.INSERT
  })
  const due = await EventReminder.findAll({
    where: { status: 'pending', dueAt: { [Op.lte]: now } }, order: [['dueAt', 'ASC'], ['id', 'ASC']], limit
  })
  let created = 0
  for (const candidate of due) {
    created += await sequelize.transaction(async (transaction) => {
      // Use the same lock order as registration approval/rejection.
      const event = await Event.findByPk(candidate.eventId, { transaction, lock: transaction.LOCK.UPDATE, skipLocked: true })
      if (!event) return 0
      const reg = await EventRegistration.findOne({ where: { eventId: event.id, agentId: candidate.agentId }, transaction, lock: transaction.LOCK.UPDATE })
      const reminder = await EventReminder.findByPk(candidate.id, { transaction, lock: transaction.LOCK.UPDATE })
      if (!reminder || reminder.status !== 'pending') return 0
      if (!reg || reg.status === 'rejected' || event.cancelledAt || new Date(event.startAt) <= now ||
        new Date(event.startAt).getTime() !== new Date(reminder.startAt).getTime()) {
        await reminder.update({ status: 'cancelled' }, { transaction })
        return 0
      }
      const legacy = await Notification.findOne({ where: { userId: reg.agentId, key: `event_reminder:${event.id}:${reminder.minutesBefore}m` }, transaction })
      const alreadyDelivered = legacy?.meta?.startAt && new Date(legacy.meta.startAt).getTime() === new Date(event.startAt).getTime()
      let wasCreated = false
      if (!alreadyDelivered) {
        const start = new Date(event.startAt).toISOString()
        const key = `event_reminder:${event.id}:${reminder.minutesBefore}m:${start}`
        const formatted = new Date(event.startAt).toLocaleString('ru-RU', { timeZone: process.env.EVENT_TIME_ZONE || 'Europe/Moscow', dateStyle: 'short', timeStyle: 'short' })
        const result = await Notification.findOrCreate({
          where: { userId: reg.agentId, key },
          defaults: {
            type: 'event_reminder',
            text: `Напоминание: «${event.title}» начнётся ${formatted}`,
            meta: { eventId: event.id, registrationId: reg.id, startAt: start }
          },
          transaction
        })
        wasCreated = result[1]
      }
      await reminder.update({ status: 'delivered', deliveredAt: now }, { transaction })
      return wasCreated ? 1 : 0
    })
  }
  return { checkedReminders: due.length, created }
}

module.exports = { sendEventReminders, scheduleEventReminder }
