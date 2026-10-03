const { scheduleEventReminder } = require('../jobs/eventReminders')
const { queueFileDeletion } = require('../jobs/fileCleanup')
const { Op } = require('sequelize')
const { Event, EventRegistration, User, Notification, EventReminder } = require('../models')
const { sequelize } = require('../db')
const { paginate } = require('../utils/pagination')
const { adminIds, notifyUsers } = require('./applicationLifecycle')

const creatorInclude = { model: User, as: 'creator', attributes: ['id', 'email', 'role'] }

function formatEventTime (date) {
  return new Date(date).toLocaleString('ru-RU', { timeZone: process.env.EVENT_TIME_ZONE || 'Europe/Moscow', dateStyle: 'short', timeStyle: 'short' })
}

function assertOpen (event) {
  if (event.cancelledAt) throw { status: 409, message: 'Мероприятие отменено' }
}

async function participantIds (eventId, transaction) {
  const registrations = await EventRegistration.findAll({
    where: { eventId, status: { [Op.ne]: 'rejected' } }, attributes: ['agentId'], transaction
  })
  return registrations.map((registration) => registration.agentId)
}

function normalizeText (v) {
  return String(v || '')
    .trim()
    .replace(/\s+/g, ' ')
}

function parsePositiveInt (v, fallback) {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  const i = Math.floor(n)
  if (i <= 0) return fallback
  return i
}

class EventsService {
  async listEvents (query) {
    const q = normalizeText(query.q)
    const trainingOnly =
      query.training === '1' || String(query.training).toLowerCase() === 'true'

    const page = parsePositiveInt(query.page, null)
    const limitRaw = parsePositiveInt(query.limit, null)
    const limit = limitRaw ? Math.min(limitRaw, 50) : null

    const where = {}
    if (trainingOnly) where.isTraining = true
    // Upcoming events go soonest first; past events go most recent first.
    if (query.period === 'upcoming') where.startAt = { [Op.gte]: new Date() }
    if (query.period === 'past') where.startAt = { [Op.lt]: new Date() }
    const direction = query.period === 'past' ? 'DESC' : 'ASC'

    if (q) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${q}%` } },
        { description: { [Op.iLike]: `%${q}%` } },
        { location: { [Op.iLike]: `%${q}%` } }
      ]
    }

    const options = {
      where,
      include: [creatorInclude],
      order: [['startAt', direction], ['createdAt', 'DESC'], ['id', 'DESC']]
    }
    if (page && limit) {
      const result = await Event.findAndCountAll({ ...options, limit, offset: (page - 1) * limit })
      return { items: result.rows, total: result.count, page, limit }
    }
    return Event.findAll(options)
  }

  async createEvent (data, user) {
    const {
      title,
      description,
      location,
      format,
      startAt,
      endAt,
      isTraining,
      capacity
    } = data

    // Logic checks beyond schema
    if (endAt && new Date(endAt).getTime() < new Date(startAt).getTime()) {
      throw {
        status: 400,
        message: 'Дата окончания должна быть позже даты начала'
      }
    }

    const created = await Event.create({
      title,
      description: description || null,
      location: location || null,
      format: format || null,
      startAt,
      endAt,
      isTraining: !!isTraining,
      capacity,
      createdBy: user.id
    })

    return Event.findByPk(created.id, {
      include: [
        { model: User, as: 'creator', attributes: ['id', 'email', 'role'] }
      ]
    })
  }

  async updateEvent (id, data) {
    const updated = await sequelize.transaction(async (transaction) => {
      const event = await Event.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE })
      if (!event) throw { status: 404, message: 'Мероприятие не найдено' }
      assertOpen(event)
      const started = new Date(event.startAt).getTime() <= Date.now()
      const updates = {}
      for (const key of ['title', 'description', 'location', 'format', 'startAt', 'endAt', 'isTraining', 'capacity']) {
        if (data[key] !== undefined) updates[key] = data[key]
      }
      for (const key of ['description', 'location', 'format']) {
        if (updates[key] === '') updates[key] = null
      }
      const startChanged = updates.startAt !== undefined && new Date(updates.startAt).getTime() !== new Date(event.startAt).getTime()
      if (startChanged && started) throw { status: 409, message: 'Нельзя перенести начавшееся мероприятие' }
      const startAt = updates.startAt !== undefined ? updates.startAt : event.startAt
      const endAt = updates.endAt !== undefined ? updates.endAt : event.endAt
      if (endAt && new Date(endAt).getTime() <= new Date(startAt).getTime()) {
        throw { status: 400, message: 'Дата окончания должна быть позже даты начала' }
      }
      if (updates.capacity != null && updates.capacity !== event.capacity) {
        const occupied = await EventRegistration.count({ where: { eventId: event.id, status: { [Op.ne]: 'rejected' } }, transaction })
        if (updates.capacity < occupied) {
          throw { status: 409, message: `Уже записано ${occupied} участников: вместимость не может быть меньше` }
        }
      }
      const before = { startAt: event.startAt, endAt: event.endAt, location: event.location, format: event.format }
      await event.update(updates, { transaction })

      const participants = await participantIds(event.id, transaction)
      if (startChanged) {
        // Reminders follow the new start time.
        await EventReminder.update(
          { status: 'cancelled' },
          { where: { eventId: event.id, status: 'pending', startAt: { [Op.ne]: event.startAt } }, transaction }
        )
        for (const agentId of participants) await scheduleEventReminder(event, agentId, transaction)
      }
      const changes = []
      if (startChanged || new Date(before.endAt || 0).getTime() !== new Date(event.endAt || 0).getTime()) {
        changes.push(`время: ${formatEventTime(event.startAt)}`)
      }
      if (before.location !== event.location) changes.push(`место: ${event.location || 'не указано'}`)
      if (before.format !== event.format) changes.push(`формат: ${event.format || 'не указан'}`)
      if (changes.length) {
        await notifyUsers(participants, {
          type: 'event_updated',
          text: `Мероприятие «${event.title}» изменено — ${changes.join(', ')}`,
          meta: { eventId: event.id, startAt: new Date(event.startAt).toISOString() }
        }, transaction)
      }
      return event
    })
    return Event.findByPk(updated.id, { include: [creatorInclude] })
  }

  async cancelEvent (id, { reason } = {}) {
    const cancelled = await sequelize.transaction(async (transaction) => {
      const event = await Event.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE })
      if (!event) throw { status: 404, message: 'Мероприятие не найдено' }
      if (event.cancelledAt) return event
      if (new Date(event.startAt).getTime() <= Date.now()) {
        throw { status: 409, message: 'Нельзя отменить начавшееся мероприятие' }
      }
      const cancelReason = String(reason || '').trim() || null
      await event.update({ cancelledAt: new Date(), cancelReason }, { transaction })
      await EventReminder.update({ status: 'cancelled' }, { where: { eventId: event.id, status: 'pending' }, transaction })
      await notifyUsers(await participantIds(event.id, transaction), {
        type: 'event_cancelled',
        text: `Мероприятие «${event.title}» ${formatEventTime(event.startAt)} отменено${cancelReason ? `: ${cancelReason}` : ''}`,
        meta: { eventId: event.id }
      }, transaction)
      return event
    })
    return Event.findByPk(cancelled.id, { include: [creatorInclude] })
  }

  async cancelMyRegistration (eventId, user) {
    return sequelize.transaction(async (transaction) => {
      const event = await Event.findByPk(eventId, { transaction, lock: transaction.LOCK.UPDATE })
      if (!event) throw { status: 404, message: 'Мероприятие не найдено' }
      const registration = await EventRegistration.findOne({
        where: { eventId: event.id, agentId: user.id }, transaction, lock: transaction.LOCK.UPDATE
      })
      if (!registration) throw { status: 404, message: 'Вы не записаны на это мероприятие' }
      if (!event.cancelledAt && new Date(event.startAt).getTime() <= Date.now()) {
        throw { status: 409, message: 'Мероприятие уже началось' }
      }
      await registration.destroy({ transaction })
      await EventReminder.update({ status: 'cancelled' }, { where: { eventId: event.id, agentId: user.id, status: 'pending' }, transaction })
      if (!event.cancelledAt && registration.status !== 'rejected') {
        await notifyUsers(await adminIds(transaction), {
          type: 'event_registration_cancelled',
          text: `${user.fullName || user.email} отменил(а) запись на «${event.title}»`,
          meta: { eventId: event.id, agentId: user.id }
        }, transaction)
      }
    })
  }

  async uploadEventCover (id, file) {
    if (!file) throw { status: 400, message: 'Изображение не загружено' }
    await sequelize.transaction(async (transaction) => {
      const event = await Event.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE })
      if (!event) throw { status: 404, message: 'Не найдено' }
      await queueFileDeletion([event.coverImageUrl], transaction)
      await event.update({ coverImageUrl: `/uploads/events/${file.filename}` }, { transaction })
      transaction.afterCommit(() => { file.persisted = true })
    })
    return Event.findByPk(id, { include: [{ model: User, as: 'creator', attributes: ['id', 'email', 'role'] }] })
  }

  async registerForEvent (id, user) {
    if (!['agent', 'individual'].includes(user.role)) {
      throw { status: 403, message: 'Доступ запрещён' }
    }

    return sequelize.transaction(async (transaction) => {
      const event = await Event.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE })
      if (!event) throw { status: 404, message: 'Мероприятие не найдено' }
      assertOpen(event)
      if (new Date(event.startAt).getTime() <= Date.now()) {
        throw { status: 409, message: 'Запись на начавшееся мероприятие закрыта' }
      }
      const duplicate = await EventRegistration.findOne({
        where: { eventId: event.id, agentId: user.id }, transaction
      })
      if (duplicate) throw { status: 409, message: 'Вы уже записаны на это мероприятие' }
      if (event.capacity != null) {
        const occupied = await EventRegistration.count({
          where: { eventId: event.id, status: { [Op.ne]: 'rejected' } }, transaction
        })
        if (occupied >= event.capacity) throw { status: 409, message: 'Все места на мероприятие заняты' }
      }
      const reg = await EventRegistration.create({
        eventId: event.id, agentId: user.id, status: 'new'
      }, { transaction })

      await scheduleEventReminder(event, user.id, transaction)
      const admins = await User.findAll({
        where: { role: 'admin', deletedAt: null },
        transaction
      })
      const agentName =
        user.fullName ||
        [user.lastName, user.firstName, user.middleName]
          .filter(Boolean)
          .join(' ') ||
        user.email

      if (admins.length) {
        await Notification.bulkCreate(
          admins.map((a) => ({
            userId: a.id,
            type: 'event_registration',
            text: `Запись на мероприятие: ${agentName} → «${event.title}»`,
            meta: {
              eventId: event.id,
              registrationId: reg.id,
              agentId: user.id
            }
          })),
          { transaction }
        )
      }

      return reg
    })
  }

  async listRegistrations (query) {
    const { options, wrap } = paginate({
      where: query.eventId ? { eventId: query.eventId } : undefined,
      order: [['createdAt', 'DESC'], ['id', 'DESC']]
    }, query)
    return wrap(EventRegistration, {
      ...options,
      include: [
        { model: Event, as: 'event' },
        {
          model: User,
          as: 'agent',
          attributes: ['id', 'firstName', 'lastName', 'middleName', 'email']
        }
      ]
    })
  }

  async listMyRegistrations (query, user) {
    if (!['agent', 'individual'].includes(user.role)) {
      throw { status: 403, message: 'Доступ запрещён' }
    }

    const page = parsePositiveInt(query.page, 1)
    const limit = Math.min(parsePositiveInt(query.limit, 10), 50)
    const offset = (page - 1) * limit

    const result = await EventRegistration.findAndCountAll({
      where: { agentId: user.id },
      include: [
        { model: Event, as: 'event' },
        {
          model: User,
          as: 'agent',
          attributes: ['id', 'firstName', 'lastName', 'middleName', 'email']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset
    })

    return {
      items: result.rows,
      total: result.count,
      page,
      limit
    }
  }

  async updateRegistrationStatus (id, data) {
    const status = String(data.status || '')
      .trim()
      .toLowerCase()

    // This check is duplicated in schema validation usually, but service should protect itself.
    if (!['approved', 'rejected'].includes(status)) {
      throw { status: 400, message: 'Некорректный статус' }
    }

    return sequelize.transaction(async (transaction) => {
      const existing = await EventRegistration.findByPk(id, { transaction })
      if (!existing) throw { status: 404, message: 'Запись не найдена' }
      const event = await Event.findByPk(existing.eventId, { transaction, lock: transaction.LOCK.UPDATE })
      const reg = await EventRegistration.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE })
      if (!event || !reg) throw { status: 404, message: 'Запись не найдена' }
      if (reg.status === status) return reg
      if (status === 'approved') {
        assertOpen(event)
        if (new Date(event.startAt).getTime() <= Date.now()) {
          throw { status: 409, message: 'Мероприятие уже началось' }
        }
        if (event.capacity != null && reg.status === 'rejected') {
          const occupied = await EventRegistration.count({
            where: { eventId: event.id, status: { [Op.ne]: 'rejected' }, id: { [Op.ne]: reg.id } },
            transaction
          })
          if (occupied >= event.capacity) throw { status: 409, message: 'Все места на мероприятие заняты' }
        }
      }
      await reg.update({ status }, { transaction })
      if (status === 'rejected') {
        await EventReminder.update({ status: 'cancelled' }, { where: { eventId: event.id, agentId: reg.agentId, status: 'pending' }, transaction })
      } else await scheduleEventReminder(event, reg.agentId, transaction)
      reg.event = event

      const eventTitle = reg.event?.title || 'мероприятие'
      const verb = status === 'approved' ? 'подтверждена' : 'отклонена'

      await Notification.create(
        {
          userId: reg.agentId,
          type: 'event_registration_status',
          text: `Ваша заявка на мероприятие «${eventTitle}» ${verb}.`,
          meta: {
            eventId: reg.eventId,
            registrationId: reg.id,
            status
          }
        },
        { transaction }
      )

      return EventRegistration.findByPk(reg.id, {
        include: [
          { model: Event, as: 'event' },
          {
            model: User,
            as: 'agent',
            attributes: ['id', 'firstName', 'lastName', 'middleName', 'email']
          }
        ],
        transaction
      })
    })
  }
}

module.exports = new EventsService()
