const state = { shuttingDown: false, startedAt: Date.now(), jobs: new Map() }

const MAX_CONSECUTIVE_FAILURES = 3

// A single transient failure is retried on the next run; repeated failures or a stalled job are unhealthy.
function jobsHealthy (now = Date.now()) {
  return [...state.jobs.values()].every(job => (job.consecutiveFailures || 0) < MAX_CONSECUTIVE_FAILURES &&
    (now - (job.lastSuccessAt || job.startedAt) < Math.max(job.intervalMs * 3, 120000)))
}

module.exports = { state, jobsHealthy }
