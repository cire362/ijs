const fs = require('fs/promises')

async function runLoad ({ base = process.env.LOAD_TEST_URL, concurrency = 10, requests = 200, p95LimitMs = 1000 } = {}) {
  if (!base) throw new Error('LOAD_TEST_URL is required')
  const url = new URL(base)
  if (!['localhost', '127.0.0.1', 'api'].includes(url.hostname) && process.env.ALLOW_LOAD_TEST !== '1') throw new Error('External targets require ALLOW_LOAD_TEST=1')
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 50 || !Number.isInteger(requests) || requests < concurrency || requests > 10000) throw new Error('Invalid load test limits')
  const token = process.env.LOAD_TEST_TOKEN
  const paths = token
    ? ['/properties', '/applications/mine', '/applications/chat/chats?limit=20&page=1', '/events?limit=10&page=1']
    : ['/properties', '/health/live', '/properties', '/events?limit=10&page=1']
  const durations = []
  const statuses = {}
  let index = 0
  const startedAt = Date.now()
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (index < requests) {
      const request = index++
      const start = performance.now()
      try {
        const response = await fetch(`${base}${paths[request % paths.length]}`, { signal: AbortSignal.timeout(10000), headers: token ? { Authorization: `Bearer ${token}` } : {} })
        await response.arrayBuffer()
        statuses[response.status] = (statuses[response.status] || 0) + 1
      } catch { statuses.network_error = (statuses.network_error || 0) + 1 }
      durations.push(performance.now() - start)
    }
  }))
  durations.sort((a, b) => a - b)
  const errors = Object.entries(statuses).filter(([status]) => !/^2\d\d$/.test(status)).reduce((n, [, count]) => n + count, 0)
  const result = {
    requests,
    concurrency,
    elapsedMs: Date.now() - startedAt,
    statuses,
    p50Ms: Math.round(durations[Math.floor(durations.length * 0.5)]),
    p95Ms: Math.round(durations[Math.floor(durations.length * 0.95)]),
    errors
  }
  result.passed = errors === 0 && result.p95Ms <= p95LimitMs
  return result
}

if (require.main === module) {
  runLoad().then(async result => {
    console.log(JSON.stringify(result))
    if (process.env.LOAD_TEST_REPORT) await fs.writeFile(process.env.LOAD_TEST_REPORT, JSON.stringify(result, null, 2) + '\n')
    if (!result.passed) process.exitCode = 1
  }).catch(error => { console.error(error.message); process.exitCode = 1 })
}
module.exports = { runLoad }
