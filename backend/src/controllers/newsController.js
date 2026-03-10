const newsService = require('../services/newsService')
const asyncHandler = require('../utils/asyncHandler')

const listNews = asyncHandler(async (req, res) => {
  const result = await newsService.listNews(req.query, req.user)
  res.json(result)
})

const getNewsById = asyncHandler(async (req, res) => {
  const item = await newsService.getNewsById(req.params.id, req.user)
  res.json(item)
})

const createNews = asyncHandler(async (req, res) => {
  const item = await newsService.createNews(req.body, req.user)
  res.status(201).json(item)
})

const updateNews = asyncHandler(async (req, res) => {
  const item = await newsService.updateNews(req.params.id, req.body)
  res.json(item)
})

const addNewsImages = asyncHandler(async (req, res) => {
  const item = await newsService.addNewsImages(req.params.id, req.files)
  res.status(201).json(item)
})

module.exports = {
  listNews,
  getNewsById,
  createNews,
  updateNews,
  addNewsImages
}
