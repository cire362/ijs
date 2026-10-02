const fs = require('fs/promises')
const path = require('path')
const { Op, QueryTypes } = require('sequelize')
const { sequelize } = require('../db')
const { FileDeletion } = require('../models')
const logger = require('../utils/logger')

const uploadsRoot = path.resolve(__dirname, '../../uploads')
function localFilePath (url) {
  if (typeof url !== 'string' || !/^\/uploads\/(avatars|properties|property_docs|application_docs|news|events)\/[^/\\]+$/.test(url)) return null
  const target = path.resolve(uploadsRoot, url.slice('/uploads/'.length))
  return target.startsWith(uploadsRoot + path.sep) ? target : null
}

async function queueFileDeletion (urls, transaction) {
  const eligible = [...new Set(urls.filter((url) => localFilePath(url)))]
  if (!eligible.length) return
  await FileDeletion.bulkCreate(eligible.map((url) => ({ url })), { transaction, ignoreDuplicates: true })
  transaction.afterCommit(async () => {
    try { await cleanupFiles({ urls: eligible }) } catch (error) { logger.error('file_cleanup_deferred', error) }
  })
}

async function cleanupFiles ({ urls, limit = 100, now = new Date() } = {}) {
  return sequelize.transaction(async (transaction) => {
    const [locks] = await sequelize.query("SELECT pg_try_advisory_xact_lock_shared(hashtextextended('ijshub:files', 0)) AS acquired", { transaction })
    if (!locks[0].acquired) return { checked: 0, deleted: 0, deferred: 'backup' }
    const jobs = await FileDeletion.findAll({
      where: { nextAttemptAt: { [Op.lte]: now }, ...(urls ? { url: urls } : {}) },
      order: [['id', 'ASC']],
      limit,
      transaction,
      lock: transaction.LOCK.UPDATE,
      skipLocked: true
    })
    let deleted = 0
    for (const job of jobs) {
      try {
        const [references] = await sequelize.query(`SELECT EXISTS (
          SELECT 1 FROM users WHERE avatar_url=:url UNION ALL
          SELECT 1 FROM events WHERE cover_image_url=:url UNION ALL
          SELECT 1 FROM property_images WHERE url=:url UNION ALL
          SELECT 1 FROM property_documents WHERE url=:url UNION ALL
          SELECT 1 FROM news_images WHERE url=:url UNION ALL
          SELECT 1 FROM application_chat_messages WHERE attachment_url=:url
        ) AS present`, { replacements: { url: job.url }, type: QueryTypes.SELECT, transaction })
        if (references.present) { await job.destroy({ transaction }); continue }
        const target = localFilePath(job.url)
        if (!target) throw new Error('Invalid local file path')
        const parent = await fs.realpath(path.dirname(target))
        if (!parent.startsWith(uploadsRoot + path.sep)) throw new Error('Upload directory escapes storage root')
        await fs.unlink(target).catch((error) => { if (error.code !== 'ENOENT') throw error })
        await job.destroy({ transaction })
        deleted++
      } catch (error) {
        if (error.code === 'ENOENT') { await job.destroy({ transaction }); deleted++; continue }
        await job.update({
          attempts: job.attempts + 1,
          lastError: error.code || error.message,
          nextAttemptAt: new Date(now.getTime() + Math.min(3600, 30 * 2 ** Math.min(job.attempts, 7)) * 1000)
        }, { transaction })
      }
    }
    return { checked: jobs.length, deleted }
  })
}

module.exports = { queueFileDeletion, cleanupFiles, localFilePath }
