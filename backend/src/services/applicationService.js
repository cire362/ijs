const { Op, fn, col, where: sqlWhere } = require('sequelize')
const {
  Application,
  Property,
  StatusHistory,
  User,
  TariffPropertyRate,
  AuditLog
} = require('../models')
const { sequelize } = require('../db')
const { formatRuPhone, toCanonicalRuDigits } = require('../utils/phone')
const { paginate } = require('../utils/pagination')

const {
  RESERVING_STATUSES,
  TERMINAL_STATUSES,
  INITIAL_DEADLINE_DAYS,
  statusLabelRu,
  isPastDeadline,
  assertStatusTransition
} = require('../utils/applicationStatus')
const {
  adminIds,
  notifyUsers,
  recordStatus,
  expireApplication,
  releaseReservation,
  rejectPendingApplications
} = require('./applicationLifecycle')

const { commissionSnapshot } = require('../utils/commission')

const AGENT_ATTRIBUTES = ['id', 'firstName', 'lastName', 'middleName', 'email', 'phone']
const historyInclude = {
  model: StatusHistory,
  as: 'history',
  include: [{ model: User, as: 'actor', attributes: ['id', 'firstName', 'lastName', 'middleName', 'role'] }]
}
const activeRatesInclude = { model: TariffPropertyRate, as: 'tariffRates', required: false, where: { isActive: true } }

// An active application fixes the client on the object for its author.
// Phones are compared by digits so legacy formats are matched too.
async function findActiveClientApplication (propertyId, clientPhone, { excludeId, transaction }) {
  const canonical = toCanonicalRuDigits(clientPhone)
  return Application.findOne({
    where: {
      propertyId,
      ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}),
      [Op.and]: [
        sqlWhere(fn('regexp_replace', col('client_phone'), '\\D', '', 'g'), { [Op.in]: [canonical, `8${canonical.slice(1)}`] }),
        {
          [Op.or]: [
            { status: { [Op.in]: RESERVING_STATUSES } },
            { status: 'sent', [Op.or]: [{ expiresAt: { [Op.gt]: new Date() } }, { expiresAt: null }] }
          ]
        }
      ]
    },
    order: [['id', 'ASC']],
    transaction
  })
}

function assertClientNotFixed (existing, authorId) {
  if (!existing) return
  if (existing.agentId === authorId) {
    throw { status: 409, message: 'У вас уже есть активная заявка для этого клиента на этот объект' }
  }
  throw { status: 409, message: 'Клиент уже закреплён за другим агентом по этому объекту' }
}

async function lockApplication (id, transaction) {
  const existing = await Application.findByPk(id, { transaction })
  if (!existing) throw { status: 404, message: 'Заявка не найдена' }
  // All operations that can reserve an object lock the property before the application.
  const property = await Property.findByPk(existing.propertyId, {
    transaction, lock: transaction.LOCK.UPDATE
  })
  const application = await Application.findByPk(id, {
    transaction, lock: transaction.LOCK.UPDATE
  })
  if (!property || !application) throw { status: 404, message: 'Заявка не найдена' }
  application.setDataValue('property', property)
  application.property = property
  return application
}

function assertManager (application, user) {
  if (!['developer', 'admin'].includes(user.role) ||
    (user.role === 'developer' &&
      (!user.developerApproved || application.property.developerId !== user.id))) {
    throw { status: 403, message: 'Доступ запрещён' }
  }
}

// Expiry is applied even before the background job runs; the caller reports it after commit.
async function expireIfOverdue (application, transaction) {
  if (!isPastDeadline(application)) return false
  await expireApplication(application, transaction)
  return true
}

function deriveApplicantFullName (user) {
  const fromParts = [user?.lastName, user?.firstName, user?.middleName]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean)
    .join(' ')

  if (fromParts) return fromParts

  const fromFullName = String(user?.fullName || '').trim()
  if (fromFullName) return fromFullName

  return ''
}

function listOptions (where, query) {
  return paginate({
    where: { ...where, ...(query.status ? { status: query.status } : {}) },
    order: [['createdAt', 'DESC'], ['id', 'DESC']]
  }, query)
}

class ApplicationService {
  async listMine (user, query = {}) {
    const { options, wrap } = listOptions({ agentId: user.id }, query)
    return wrap(Application, {
      ...options,
      include: [
        { model: Property, include: [activeRatesInclude] },
        { model: User, as: 'agent', attributes: AGENT_ATTRIBUTES },
        historyInclude
      ]
    })
  }

  async listIncoming (query, user) {
    const developerId = user.role === 'developer' ? user.id : user.role === 'admin' ? query.developerId : null
    // A subquery keeps the filter valid when pagination wraps the includes in a subselect.
    const where = Number.isInteger(developerId)
      ? { propertyId: { [Op.in]: sequelize.literal(`(SELECT id FROM properties WHERE developer_id = ${developerId})`) } }
      : {}

    const { options, wrap } = listOptions(where, query)
    return wrap(Application, {
      ...options,
      include: [
        {
          model: Property,
          include: [
            activeRatesInclude,
            {
              model: User,
              as: 'developer',
              attributes: ['id', 'firstName', 'lastName', 'middleName', 'companyName', 'email', 'phone']
            }
          ]
        },
        historyInclude,
        { model: User, as: 'agent', attributes: AGENT_ATTRIBUTES }
      ]
    })
  }

  async getApplication (id, user) {
    const application = await Application.findByPk(id, {
      include: [
        {
          model: Property,
          include: [
            activeRatesInclude,
            { model: User, as: 'developer', attributes: ['id', 'firstName', 'lastName', 'middleName', 'companyName', 'email', 'phone'] }
          ]
        },
        historyInclude,
        { model: User, as: 'agent', attributes: AGENT_ATTRIBUTES }
      ],
      order: [[{ model: StatusHistory, as: 'history' }, 'createdAt', 'ASC']]
    })
    const allowed = application && (
      user.role === 'admin' ||
      application.agentId === user.id ||
      (user.role === 'developer' && user.developerApproved && application.property?.developerId === user.id)
    )
    // Foreign applications look missing rather than forbidden.
    if (!allowed) throw { status: 404, message: 'Заявка не найдена' }
    return application
  }

  async createApplication (data, user) {
    if (!['agent', 'individual'].includes(user.role)) {
      throw { status: 403, message: 'Доступ запрещён' }
    }
    const clientFullName = user.role === 'individual'
      ? deriveApplicantFullName(user)
      : String(data.clientFullName || '').trim()
    const clientPhone = formatRuPhone(user.role === 'individual' ? user.phone : data.clientPhone)
    if (!clientFullName) throw { status: 400, message: 'Укажите ФИО клиента или заполните ФИО в профиле' }
    if (!clientPhone) throw { status: 400, message: 'Укажите корректный телефон клиента или заполните телефон в профиле' }

    return sequelize.transaction(async (transaction) => {
      // The property lock serializes client fixation on this object.
      const property = await Property.findByPk(data.propertyId, {
        transaction, lock: transaction.LOCK.UPDATE
      })
      if (!property) throw { status: 404, message: 'Объект не найден' }
      if (property.saleStatus !== 'available') throw { status: 409, message: 'Объект недоступен' }

      assertClientNotFixed(await findActiveClientApplication(property.id, clientPhone, { transaction }), user.id)

      const rate = await TariffPropertyRate.findOne({
        where: { propertyId: property.id, category: 'apartments', isActive: true }, transaction
      })
      const application = await Application.create({
        propertyId: property.id,
        agentId: user.id,
        status: 'sent',
        expiresAt: new Date(Date.now() + INITIAL_DEADLINE_DAYS * 86400000),
        ...commissionSnapshot(property, rate),
        comment: data.comment || null,
        clientFullName,
        clientPhone
      }, { transaction })
      await StatusHistory.create({
        applicationId: application.id,
        status: 'sent',
        changedBy: user.id,
        comment: statusLabelRu('sent')
      }, { transaction })
      await notifyUsers([property.developerId, ...await adminIds(transaction)], {
        type: 'application_new',
        text: `Новая заявка №${application.id} по объекту «${property.title}»`,
        meta: { applicationId: application.id, propertyId: property.id, agentId: user.id }
      }, transaction)
      return application
    })
  }

  async updateStatus (id, data, user) {
    const result = await sequelize.transaction(async (transaction) => {
      const application = await lockApplication(id, transaction)
      assertManager(application, user)
      if (await expireIfOverdue(application, transaction)) return { expired: true }
      assertStatusTransition(application.status, data.status)
      if (application.status === data.status) return { application }
      const property = application.property
      if (RESERVING_STATUSES.includes(data.status) || data.status === 'done') {
        if (property.saleStatus === 'sold') throw { status: 409, message: 'Объект уже продан' }
        if (property.saleStatus === 'reserved' && !RESERVING_STATUSES.includes(application.status)) {
          throw { status: 409, message: 'Объект уже забронирован' }
        }
        const competing = await Application.count({
          where: {
            propertyId: property.id,
            id: { [Op.ne]: application.id },
            status: { [Op.in]: [...RESERVING_STATUSES, 'done'] }
          },
          transaction
        })
        if (competing) throw { status: 409, message: 'Объект уже забронирован по другой заявке' }
        await property.update({ saleStatus: data.status === 'done' ? 'sold' : 'reserved' }, { transaction })
      } else if (data.status === 'rejected') {
        await releaseReservation(application, property, transaction)
      }
      // The developer learns about changes made on their behalf by an administrator.
      const recipients = [application.agentId, user.role === 'admin' ? property.developerId : null]
      await recordStatus(application, data.status, { comment: data.comment, actorId: user.id, recipients, transaction })
      if (data.status === 'done') {
        await rejectPendingApplications(property.id, {
          exceptId: application.id, actorId: user.id, comment: 'Объект продан по другой заявке', transaction
        })
      }
      return { application }
    })
    if (result.expired) throw { status: 409, message: 'Срок заявки истек' }
    return result.application
  }

  async cancelApplication (id, user, { comment } = {}) {
    const result = await sequelize.transaction(async (transaction) => {
      const application = await lockApplication(id, transaction)
      if (application.agentId !== user.id) throw { status: 403, message: 'Отозвать заявку может только её автор' }
      if (await expireIfOverdue(application, transaction)) return { expired: true }
      if (TERMINAL_STATUSES.includes(application.status)) {
        throw { status: 409, message: 'Завершённую, отклонённую или истёкшую заявку нельзя отозвать' }
      }
      await releaseReservation(application, application.property, transaction)
      await recordStatus(application, 'cancelled', {
        comment: String(comment || '').trim() || statusLabelRu('cancelled'),
        actorId: user.id,
        recipients: [application.property.developerId, ...await adminIds(transaction)],
        transaction
      })
      return { application }
    })
    if (result.expired) throw { status: 409, message: 'Срок заявки истек' }
    return result.application
  }

  async extendInitialDeadline (id, user, days = INITIAL_DEADLINE_DAYS) {
    const result = await sequelize.transaction(async (transaction) => {
      const application = await lockApplication(id, transaction)
      assertManager(application, user)
      if (await expireIfOverdue(application, transaction)) return { expired: true }
      if (application.status !== 'sent') {
        throw { status: 409, message: 'Продлить можно только отправленную заявку с действующим сроком' }
      }
      if (!Number.isInteger(days) || days < 1 || days > 60) {
        throw { status: 400, message: 'Срок продления должен быть от 1 до 60 дней' }
      }
      const base = Math.max(Date.now(), new Date(application.expiresAt || 0).getTime())
      const expiresAt = new Date(base + days * 86400000)
      await application.update({ expiresAt }, { transaction })
      await notifyUsers([application.agentId], {
        type: 'application_extended',
        text: `Срок заявки №${application.id} продлён до ${expiresAt.toLocaleDateString('ru-RU', { timeZone: process.env.EVENT_TIME_ZONE || 'Europe/Moscow' })}`,
        meta: { applicationId: application.id, propertyId: application.propertyId, expiresAt: expiresAt.toISOString() }
      }, transaction)
      return { application }
    })
    if (result.expired) throw { status: 409, message: 'Срок заявки истек' }
    return result.application
  }

  async updateClientInfo (id, data, user) {
    if (user.role === 'individual') {
      throw { status: 403, message: 'Физлицо подаёт заявку на себя: измените ФИО и телефон в профиле' }
    }
    const result = await sequelize.transaction(async (transaction) => {
      const application = await lockApplication(id, transaction)
      if (application.agentId !== user.id) throw { status: 403, message: 'Вы не создатель заявки' }
      if (await expireIfOverdue(application, transaction)) return { expired: true }
      if (application.status !== 'sent') {
        throw { status: 409, message: 'Данные клиента можно изменить только до подтверждения заявки' }
      }
      const clientPhone = formatRuPhone(data.clientPhone)
      if (!clientPhone) throw { status: 400, message: 'Некорректный телефон клиента' }
      assertClientNotFixed(
        await findActiveClientApplication(application.propertyId, clientPhone, { excludeId: application.id, transaction }),
        user.id
      )
      const before = { clientFullName: application.clientFullName, clientPhone: application.clientPhone }
      await application.update({ clientFullName: data.clientFullName, clientPhone }, { transaction })
      if (before.clientFullName !== application.clientFullName || before.clientPhone !== application.clientPhone) {
        await AuditLog.create({
          entityType: 'application',
          entityId: application.id,
          actorId: user.id,
          action: 'client_changed',
          before,
          after: { clientFullName: application.clientFullName, clientPhone: application.clientPhone }
        }, { transaction })
      }
      return { application }
    })
    if (result.expired) throw { status: 409, message: 'Срок заявки истек' }
    return result.application
  }
}

module.exports = new ApplicationService()
