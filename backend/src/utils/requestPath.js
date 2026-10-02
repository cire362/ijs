function requestPath (originalUrl) {
  let url
  try {
    url = new URL(originalUrl, 'http://internal')
  } catch {
    return String(originalUrl || '').split('?')[0]
  }
  for (const key of url.searchParams.keys()) {
    if (/token|password|secret/i.test(key)) url.searchParams.set(key, '[redacted]')
  }
  return url.pathname + url.search
}

module.exports = { requestPath }
