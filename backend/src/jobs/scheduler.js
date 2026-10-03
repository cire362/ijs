const { state } = require('../ops/state')

function shouldRunScheduledJobs () {
  return process.env.NODE_ENV !== 'test' && !['false', '0'].includes(process.env.RUN_SCHEDULED_JOBS)
}

function startScheduledJobs (definitions, logger = console, { enabled = shouldRunScheduledJobs() } = {}) {
  if (!enabled) {
    logger.log('Scheduled jobs are disabled for this process')
    return async () => {}
  }
  const running = new Set()
  let stopping = false
  const timers = definitions.map(({ name, intervalMs, job, runImmediately = false }) => {
    const status = { intervalMs, startedAt: Date.now(), lastSuccessAt: null, lastError: null, failures: 0, consecutiveFailures: 0, running: false }
    state.jobs.set(name, status)
    const execute = (trigger) => {
      if (stopping || status.running) return
      status.running = true
      const startedAt = Date.now()
      const promise = Promise.resolve().then(job).then(result => {
        status.lastSuccessAt = Date.now()
        status.lastError = null
        status.consecutiveFailures = 0
        logger.log(`Job '${name}' completed via ${trigger}`, { durationMs: Date.now() - startedAt, result })
      }, error => {
        status.lastError = error?.code || error?.name || 'job_failed'
        status.failures++
        status.consecutiveFailures++
        logger.error('scheduled_job_failed', { job: name, error })
      }).finally(() => { status.running = false; running.delete(promise) })
      running.add(promise)
    }
    if (runImmediately) execute('startup')
    const timer = setInterval(() => execute('interval'), intervalMs)
    timer.unref?.()
    return timer
  })
  return async () => {
    stopping = true
    for (const timer of timers) clearInterval(timer)
    await Promise.allSettled([...running])
  }
}

module.exports = { shouldRunScheduledJobs, startScheduledJobs }
