require('dotenv').config()
const fs = require('fs/promises')

function assess (health, operations, backup, now = Date.now()) {
  const problems = []
  if (!health?.ok) problems.push('api_not_ready')
  if (operations?.queues?.overdueReminders > 0) problems.push('overdue_reminders')
  if (operations?.queues?.stuckFiles > 0) problems.push('stuck_file_deletions')
  const lastBackup = Date.parse(backup?.lastSuccessAt)
  if (!Number.isFinite(lastBackup) || lastBackup > now + 60000 || now - lastBackup > 26 * 3600000) problems.push('backup_stale')
  if (backup?.mirrored === false) problems.push('backup_not_mirrored')
  if (backup?.lastError) problems.push('backup_failed')
  return problems
}

async function monitor () {
  const base = process.env.MONITOR_API_URL || 'http://api:4000'
  const interval = Number(process.env.MONITOR_INTERVAL_SECONDS || 30)
  if (!Number.isInteger(interval) || interval < 5 || interval > 3600 || !process.env.OPS_TOKEN) throw new Error('Monitor requires OPS_TOKEN and a valid interval')
  let previous = ''
  let failures = 0
  let stopped = false
  let deliveryPending
  let wake
  process.on('SIGTERM', () => { stopped = true; wake?.() })
  process.on('SIGINT', () => { stopped = true; wake?.() })
  const read = async endpoint => {
    const response = await fetch(`${base}${endpoint}`, { headers: { Authorization: `Bearer ${process.env.OPS_TOKEN}` }, signal: AbortSignal.timeout(5000) })
    if (!response.ok) throw new Error('Probe failed')
    return response.json()
  }
  while (true) {
    if (stopped) break
    const [health, operations, backup] = await Promise.allSettled([
      read('/health/ready'), read('/ops/status'),
      fs.readFile(process.env.BACKUP_STATUS_FILE || '/backups/status.json', 'utf8').then(JSON.parse)
    ])
    const problems = assess(health.value, operations.value, backup.value)
    if (operations.status === 'rejected') problems.push('operations_probe_failed')
    failures = problems.length ? failures + 1 : 0
    const current = problems.sort().join(',')
    if ((failures >= 3 || !problems.length) && current !== previous) {
      const event = { event: problems.length ? 'production_alert' : 'production_recovered', time: new Date().toISOString(), problems }
      console[problems.length ? 'error' : 'log'](JSON.stringify(event))
      deliveryPending = process.env.MONITOR_WEBHOOK_URL ? event : null
      previous = current
    }
    if (deliveryPending) {
      try {
        const response = await fetch(process.env.MONITOR_WEBHOOK_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(deliveryPending), signal: AbortSignal.timeout(5000) })
        if (!response.ok) throw new Error('Webhook failed')
        deliveryPending = null
      } catch { console.error(JSON.stringify({ event: 'alert_delivery_failed' })) }
    }
    if (!stopped) {
      await new Promise(resolve => {
        const timer = setTimeout(resolve, interval * 1000)
        wake = () => { clearTimeout(timer); resolve() }
      })
    }
  }
}

if (require.main === module) monitor().catch(error => { console.error(error.message); process.exitCode = 1 })
module.exports = { assess }
