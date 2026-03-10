const applicationService = require('../services/applicationService')
const asyncHandler = require('../utils/asyncHandler')

const listMine = asyncHandler(async (req, res) => {
  const apps = await applicationService.listMine(req.user)
  res.json(apps)
})

const listIncoming = asyncHandler(async (req, res) => {
  const apps = await applicationService.listIncoming(req.query, req.user)
  res.json(apps)
})

const createApplication = asyncHandler(async (req, res) => {
  const app = await applicationService.createApplication(req.body, req.user)
  res.status(201).json(app)
})

const updateStatus = asyncHandler(async (req, res) => {
  const app = await applicationService.updateStatus(
    req.params.id,
    req.body,
    req.user
  )
  res.json(app)
})

const updateClientInfo = asyncHandler(async (req, res) => {
  const app = await applicationService.updateClientInfo(
    req.params.id,
    req.body,
    req.user
  )
  res.json(app)
})

module.exports = {
  listMine,
  listIncoming,
  createApplication,
  updateStatus,
  updateClientInfo
}
