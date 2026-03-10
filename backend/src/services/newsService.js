const { Op } = require('sequelize')
const { News, NewsImage, User } = require('../models')

function normalizeText (v) {
  return String(v || '')
    .trim()
    .replace(/\s+/g, ' ')
}

function toBool (v) {
  if (v === true || v === false) return v
  if (v == null) return null
  const s = String(v).toLowerCase().trim()
  if (['1', 'true', 'yes', 'y'].includes(s)) return true
  if (['0', 'false', 'no', 'n'].includes(s)) return false
  return null
}

class NewsService {
  async listNews (query, user) {
    const isAdmin = user?.role === 'admin'
    const q = normalizeText(query.q)
    const where = {}

    if (!isAdmin) {
      where.isPublished = true
    } else {
      const published = toBool(query.published)
      if (published != null) where.isPublished = published
    }

    if (q) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${q}%` } },
        { subtitle: { [Op.iLike]: `%${q}%` } },
        { excerpt: { [Op.iLike]: `%${q}%` } },
        { content: { [Op.iLike]: `%${q}%` } }
      ]
    }

    return News.findAll({
      where,
      include: [
        {
          model: User,
          as: 'author',
          attributes: [
            'id',
            'firstName',
            'lastName',
            'middleName',
            'email',
            'role'
          ]
        },
        {
          model: NewsImage,
          as: 'images',
          attributes: ['id', 'url', 'caption']
        }
      ],
      order: [
        ['publishedAt', 'DESC'],
        ['createdAt', 'DESC']
      ]
    })
  }

  async getNewsById (id, user) {
    const isAdmin = user?.role === 'admin'

    const item = await News.findByPk(id, {
      include: [
        {
          model: User,
          as: 'author',
          attributes: [
            'id',
            'firstName',
            'lastName',
            'middleName',
            'email',
            'role'
          ]
        },
        {
          model: NewsImage,
          as: 'images',
          attributes: ['id', 'url', 'caption']
        }
      ]
    })

    if (!item) throw { status: 404, message: 'Не найдено' }
    if (!isAdmin && !item.isPublished) {
      throw { status: 404, message: 'Не найдено' }
    }

    return item
  }

  async createNews (data, user) {
    const { title, subtitle, excerpt, content, isPublished } = data

    const created = await News.create({
      title,
      subtitle: subtitle || null,
      excerpt: excerpt || null,
      content,
      isPublished: !!isPublished,
      publishedAt: isPublished ? new Date() : null,
      authorId: user.id
    })

    return this.getNewsById(created.id, { role: 'admin' }) // reuse getById as admin to see it even if not published? Created logic usually returns full obj.
  }

  async updateNews (id, data) {
    const item = await News.findByPk(id)
    if (!item) throw { status: 404, message: 'Не найдено' }

    const payload = {}
    if (data.title !== undefined) payload.title = data.title
    if (data.subtitle !== undefined) payload.subtitle = data.subtitle || null
    if (data.excerpt !== undefined) payload.excerpt = data.excerpt || null
    if (data.content !== undefined) payload.content = data.content

    if (data.isPublished !== undefined) {
      payload.isPublished = data.isPublished
      if (data.isPublished && !item.publishedAt) { payload.publishedAt = new Date() }
      if (!data.isPublished) payload.publishedAt = null
    }

    await item.update(payload)

    // Return full object
    return News.findByPk(item.id, {
      include: [
        {
          model: User,
          as: 'author',
          attributes: [
            'id',
            'firstName',
            'lastName',
            'middleName',
            'email',
            'role'
          ]
        },
        {
          model: NewsImage,
          as: 'images',
          attributes: ['id', 'url', 'caption']
        }
      ]
    })
  }

  async addNewsImages (id, files) {
    const item = await News.findByPk(id)
    if (!item) throw { status: 404, message: 'Не найдено' }

    if (!files || !files.length) {
      throw { status: 400, message: 'Изображения не загружены' }
    }

    await NewsImage.bulkCreate(
      files.map((f) => ({
        newsId: item.id,
        url: `/uploads/news/${f.filename}`,
        caption: f.originalname ? f.originalname.substring(0, 255) : null
      }))
    )

    return News.findByPk(item.id, {
      include: [
        {
          model: User,
          as: 'author',
          attributes: [
            'id',
            'firstName',
            'lastName',
            'middleName',
            'email',
            'role'
          ]
        },
        {
          model: NewsImage,
          as: 'images',
          attributes: ['id', 'url', 'caption']
        }
      ]
    })
  }
}

module.exports = new NewsService()
