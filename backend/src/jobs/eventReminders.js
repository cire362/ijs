const { Op } = require('sequelize')
const { Event, EventRegistration, Notification } = require('../models')

function fmt (dt) {
  const d = dt instanceof Date ? dt : new Date(dt)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

async function sendEventReminders ({
  minutesBefore = 60,
  windowMinutes = 5
} = {}) {
  const now = new Date()
  const from = new Date(
    now.getTime() + (minutesBefore - windowMinutes) * 60 * 1000
  )
  const to = new Date(
    now.getTime() + (minutesBefore + windowMinutes) * 60 * 1000
  )

  const events = await Event.findAll({
    where: {
      startAt: { [Op.between]: [from, to] }
    },
    include: [
      {
        model: EventRegistration,
        as: 'registrations',
        where: { status: { [Op.ne]: 'rejected' } },
        required: false
      }
    ],
    order: [['startAt', 'ASC']]
  })

  let created = 0

  for (const event of events) {
    const regs = Array.isArray(event.registrations) ? event.registrations : []
    for (const reg of regs) {
      const key = `event_reminder:${event.id}:${minutesBefore}m`
      const [note, wasCreated] = await Notification.findOrCreate({
        where: { userId: reg.agentId, key },
        defaults: {
          userId: reg.agentId,
          key,
          type: 'event_reminder',
          text: `Напоминание: «${event.title}» начнётся ${fmt(event.startAt)}`,
          meta: {
            eventId: event.id,
            registrationId: reg.id,
            startAt: event.startAt
          }
        }
      })

      if (wasCreated && note) created += 1
    }
  }

  return { checkedEvents: events.length, created }
}

module.exports = { sendEventReminders }
