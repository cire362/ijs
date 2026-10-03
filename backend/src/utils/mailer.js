const nodemailer = require('nodemailer')
const logger = require('./logger')

// Messages sent in tests are kept here instead of leaving the process.
const outbox = []
let transport = null

function mailMode (env = process.env) {
  if (env.NODE_ENV === 'test') return 'memory'
  if (env.SMTP_URL) return 'smtp'
  // Development without SMTP writes the message to the log; production must not leak links there.
  return env.NODE_ENV === 'production' ? 'disabled' : 'log'
}

function isMailConfigured () {
  return mailMode() !== 'disabled'
}

function getTransport () {
  if (!transport) {
    transport = nodemailer.createTransport(process.env.SMTP_URL, {
      disableFileAccess: true,
      disableUrlAccess: true
    })
  }
  return transport
}

async function sendMail ({ to, subject, text, html }) {
  const mode = mailMode()
  const message = { from: process.env.MAIL_FROM || 'ИЖС платформа <no-reply@localhost>', to, subject, text, html }
  if (mode === 'memory') {
    outbox.push(message)
    return
  }
  if (mode === 'log') {
    logger.info('mail_preview', { to, subject, text })
    return
  }
  if (mode === 'disabled') throw Object.assign(new Error('Mail delivery is not configured'), { status: 503 })
  await getTransport().sendMail(message)
}

// Delivery never blocks or fails the API response; failures are logged for operators.
function sendMailInBackground (message) {
  sendMail(message).catch((error) => logger.error('mail_send_failed', { subject: message.subject, error: error.message }))
}

module.exports = { sendMail, sendMailInBackground, isMailConfigured, mailMode, outbox }
