const { state } = require('./state')
const requests = new Map()
let inFlight = 0

function recordHttp (req, res, next) {
  const start = process.hrtime.bigint()
  inFlight++
  let recorded = false
  const finish = () => {
    if (recorded) return
    recorded = true
    inFlight--
    const route = req.route ? `${req.baseUrl || ''}${req.route.path}` : req.path.startsWith('/uploads/') ? '/uploads/*' : 'unmatched'
    const key = JSON.stringify([req.method, route, res.statusCode])
    const metric = requests.get(key) || { count: 0, seconds: 0 }
    metric.count++
    metric.seconds += Number(process.hrtime.bigint() - start) / 1e9
    if (requests.size < 500 || requests.has(key)) requests.set(key, metric)
  }
  res.once('finish', finish)
  res.once('close', finish)
  next()
}

function metricsText () {
  const lines = ['# TYPE ijs_http_requests_total counter', '# TYPE ijs_http_request_duration_seconds_sum counter']
  const quote = value => JSON.stringify(String(value))
  for (const [key, value] of requests) {
    const [method, route, status] = JSON.parse(key)
    const labels = `method=${quote(method)},route=${quote(route)},status=${quote(status)}`
    lines.push(`ijs_http_requests_total{${labels}} ${value.count}`, `ijs_http_request_duration_seconds_sum{${labels}} ${value.seconds}`)
  }
  lines.push(`# TYPE ijs_http_in_flight gauge\nijs_http_in_flight ${inFlight}`)
  lines.push(`# TYPE ijs_process_rss_bytes gauge\nijs_process_rss_bytes ${process.memoryUsage().rss}`)
  lines.push(`# TYPE ijs_process_uptime_seconds gauge\nijs_process_uptime_seconds ${process.uptime()}`)
  lines.push('# TYPE ijs_job_last_success_timestamp_seconds gauge', '# TYPE ijs_job_failures_total counter')
  for (const [name, job] of state.jobs) {
    lines.push(`ijs_job_last_success_timestamp_seconds{job=${quote(name)}} ${(job.lastSuccessAt || 0) / 1000}`, `ijs_job_failures_total{job=${quote(name)}} ${job.failures}`)
  }
  return lines.join('\n') + '\n'
}

module.exports = { recordHttp, metricsText }
