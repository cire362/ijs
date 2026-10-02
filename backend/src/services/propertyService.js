const { scaledDecimal } = require('../utils/commission')
const { queueFileDeletion } = require('../jobs/fileCleanup')
const { Op } = require('sequelize')
const { sequelize } = require('../db')
const { RESERVING_STATUSES } = require('../utils/applicationStatus')
const { rejectPendingApplications } = require('./applicationLifecycle')
const { paginate } = require('../utils/pagination')
const {
  Property,
  PropertyImage,
  PropertyDocument,
  User,
  AddressSuggestion,
  Application,
  AuditLog
} = require('../models')

async function upsertAddressSuggestion ({ kind, label, region, city, source }) {
  if (!AddressSuggestion) return

  const cleanLabel = (label || '').trim()
  if (cleanLabel.length < 2) return

  const cleanRegion = (region || '').trim() || null
  const cleanCity = (city || '').trim() || null

  const labelLower = cleanLabel.toLowerCase()
  const regionLower = cleanRegion ? cleanRegion.toLowerCase() : null
  const cityLower = cleanCity ? cleanCity.toLowerCase() : null

  const now = new Date()

  const existing = await AddressSuggestion.findOne({
    where: { kind, labelLower, regionLower, cityLower }
  })

  if (existing) {
    await existing.update({
      label: cleanLabel,
      region: cleanRegion,
      city: cleanCity,
      source: source || existing.source,
      lastSeenAt: now
    })
    return
  }

  await AddressSuggestion.create({
    kind,
    label: cleanLabel,
    labelLower,
    region: cleanRegion,
    regionLower,
    city: cleanCity,
    cityLower,
    source: source || 'property',
    lastSeenAt: now
  })
}

async function ensureSuggestionsFromPropertyFields ({ region, city, street }) {
  if (region) {
    await upsertAddressSuggestion({
      kind: 'region',
      label: region,
      source: 'property'
    })
  }
  if (region && city) {
    await upsertAddressSuggestion({
      kind: 'city',
      label: city,
      region,
      source: 'property'
    })
  }
  if (region && city && street) {
    await upsertAddressSuggestion({
      kind: 'street',
      label: street,
      region,
      city,
      source: 'property'
    })
  }
}

function assertApprovedDeveloper (developer) {
  if (!developer || developer.role !== 'developer') {
    throw { status: 400, message: 'Некорректный developerId (нужен застройщик)' }
  }
  if (!developer.developerApproved || developer.developerRejected) {
    throw { status: 409, message: 'Застройщик не подтверждён администратором' }
  }
}

class PropertyService {
  async listProperties (query, user) {
    const q = (query.q || '').trim()
    const region = (query.region || '').trim()
    const city = (query.city || '').trim()

    let publicWhere = { saleStatus: 'available' }
    const canSeeAllStatuses =
      user &&
      (user.role === 'agent' ||
        user.role === 'individual' ||
        user.role === 'admin' ||
        user.role === 'developer')

    if (canSeeAllStatuses) {
      publicWhere = {}
      if (query.status) {
        publicWhere.saleStatus = query.status
      }
    }

    const where = { ...publicWhere }

    if (user && user.role === 'developer') {
      where.developerId = user.id
    }

    if (q) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${q}%` } },
        { description: { [Op.iLike]: `%${q}%` } },
        { street: { [Op.iLike]: `%${q}%` } }
      ]
    }
    if (region) where.region = region
    if (city) where.city = city

    if (query.rooms != null) where.rooms = Number(query.rooms)
    if (query.floors != null) where.floors = Number(query.floors)

    // Price range
    if (query.priceMin != null || query.priceMax != null) {
      const priceFilter = {}
      if (query.priceMin != null) priceFilter[Op.gte] = Number(query.priceMin)
      if (query.priceMax != null) priceFilter[Op.lte] = Number(query.priceMax)
      where.price = priceFilter
    }

    const { options, wrap } = paginate({ where, order: [['createdAt', 'DESC'], ['id', 'DESC']] }, query)
    return wrap(Property, {
      ...options,
      include: [
        {
          model: User,
          as: 'developer',
          attributes: [
            'id',
            'firstName',
            'lastName',
            'middleName',
            'companyName'
          ]
        },
        {
          model: PropertyImage,
          as: 'images',
          attributes: ['id', 'url', 'caption']
        }
      ]
    })
  }

  async getPropertyById (id, user) {
    const property = await Property.findByPk(id, {
      include: [
        {
          model: User,
          as: 'developer',
          attributes: [
            'id',
            'firstName',
            'lastName',
            'middleName',
            'companyName'
          ]
        },
        {
          model: PropertyImage,
          as: 'images',
          attributes: ['id', 'url', 'caption']
        },
        {
          model: PropertyDocument,
          as: 'documents'
        }
      ]
    })

    if (!property) throw { status: 404, message: 'Не найдено' }

    if (user?.role === 'developer' && property.developerId !== user.id) {
      throw { status: 404, message: 'Не найдено' }
    }
    return property
  }

  async createProperty (data, user) {
    const payload = { ...data }

    if (user.role === 'developer') {
      payload.developerId = user.id
    } else if (user.role === 'admin') {
      if (!payload.developerId) {
        throw {
          status: 400,
          message: 'Для администратора обязателен developerId'
        }
      }
      assertApprovedDeveloper(await User.findByPk(payload.developerId))
    }

    if (!payload.saleStatus) delete payload.saleStatus

    const created = await Property.create(payload)

    ensureSuggestionsFromPropertyFields({
      region: payload.region,
      city: payload.city,
      street: payload.street
    }).catch(() => {})

    return this.getPropertyById(created.id, user)
  }

  async updateProperty (id, data, user) {
    const property = await sequelize.transaction(async (transaction) => {
      const property = await Property.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE })
      if (!property) throw { status: 404, message: 'Объект не найден' }
      if (user.role === 'developer' && property.developerId !== user.id) {
        throw { status: 403, message: 'Доступ запрещён' }
      }
      const updates = { ...data }
      if (updates.developerId === property.developerId) delete updates.developerId
      if (updates.developerId !== undefined) {
        if (user.role !== 'admin') throw { status: 403, message: 'Нельзя менять developerId' }
        assertApprovedDeveloper(await User.findByPk(updates.developerId, { transaction }))
        if (await Application.count({ where: { propertyId: id }, transaction })) {
          throw { status: 409, message: 'Нельзя менять застройщика у объекта с заявками' }
        }
      }
      if (updates.saleStatus && updates.saleStatus !== property.saleStatus) {
        const active = await Application.count({
          where: { propertyId: id, status: { [Op.in]: RESERVING_STATUSES } }, transaction
        })
        const completed = await Application.count({ where: { propertyId: id, status: 'done' }, transaction })
        if (active || completed) {
          throw { status: 409, message: 'Статус объекта связан с заявкой. Измените статус заявки' }
        }
      }
      if (updates.price !== undefined && (updates.price == null || property.price == null ? updates.price !== property.price : scaledDecimal(updates.price, 2) !== scaledDecimal(property.price, 2))) {
        await AuditLog.create({
          entityType: 'property',
          entityId: property.id,
          actorId: user.id,
          action: 'price_changed',
          before: { price: property.price },
          after: { price: updates.price }
        }, { transaction })
      }
      const soldNow = updates.saleStatus === 'sold' && property.saleStatus !== 'sold'
      await property.update(updates, { transaction })
      // A sale recorded outside a deal still closes the pending applications.
      if (soldNow) {
        await rejectPendingApplications(property.id, { actorId: user.id, comment: 'Объект продан', transaction })
      }
      return property
    })
    ensureSuggestionsFromPropertyFields(property).catch(() => {})
    return property
  }

  async addPropertyImages (id, files, user) {
    const property = await Property.findByPk(id)
    if (!property) throw { status: 404, message: 'Не найдено' }

    if (user.role === 'developer' && property.developerId !== user.id) {
      throw { status: 403, message: 'Доступ запрещён' }
    }

    if (!files || !files.length) {
      throw { status: 400, message: 'Изображения не загружены' }
    }

    await PropertyImage.bulkCreate(
      files.map((f) => ({
        propertyId: property.id,
        url: `/uploads/properties/${f.filename}`,
        caption: f.originalname
      }))
    )
    for (const file of files) file.persisted = true

    return this.getPropertyById(id, user)
  }

  async deleteProperty (id, user) {
    return sequelize.transaction(async (transaction) => {
      const property = await Property.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE })
      if (!property) throw { status: 404, message: 'Объект не найден' }
      if (user.role === 'developer' && property.developerId !== user.id) {
        throw { status: 403, message: 'Доступ запрещён' }
      }
      if (await Application.count({ where: { propertyId: id }, transaction })) {
        throw { status: 409, message: 'Нельзя удалить объект с заявками и историей сделок' }
      }
      const images = await PropertyImage.findAll({ where: { propertyId: id }, transaction })
      const docs = await PropertyDocument.findAll({ where: { propertyId: id }, transaction })
      await queueFileDeletion([...images, ...docs].map((file) => file.url), transaction)
      await property.destroy({ transaction })
    })
  }

  async deletePropertyImage (imageId, user) {
    return this.deletePropertyFile(PropertyImage, imageId, user)
  }

  async deletePropertyFile (Model, id, user) {
    return sequelize.transaction(async (transaction) => {
      const existing = await Model.findByPk(id, { transaction })
      if (!existing) throw { status: 404, message: 'Файл не найден' }
      const property = await Property.findByPk(existing.propertyId, { transaction, lock: transaction.LOCK.UPDATE })
      const file = await Model.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE })
      if (!file || !property) throw { status: 404, message: 'Файл не найден' }
      if (user.role === 'developer' && property.developerId !== user.id) throw { status: 403, message: 'Доступ запрещён' }
      await queueFileDeletion([file.url], transaction)
      await file.destroy({ transaction })
    })
  }

  async addPropertyDocument (id, file, user) {
    const property = await Property.findByPk(id)
    if (!property) throw { status: 404, message: 'Не найдено' }

    if (user.role === 'developer' && property.developerId !== user.id) {
      throw { status: 403, message: 'Доступ запрещён' }
    }

    if (!file) {
      throw { status: 400, message: 'Документ не загружен' }
    }

    await PropertyDocument.create({
      propertyId: property.id,
      url: `/uploads/property_docs/${file.filename}`,
      originalName: file.originalname,
      mimeType: file.mimetype
    })
    file.persisted = true

    return this.getPropertyById(id, user)
  }

  async deletePropertyDocument (docId, user) {
    return this.deletePropertyFile(PropertyDocument, docId, user)
  }
}

module.exports = new PropertyService()
