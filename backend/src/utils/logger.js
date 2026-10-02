function serializeMeta (meta, seen = new WeakSet()) {
  if (meta instanceof Error) {
    return {
      name: meta.name,
      message: serializeMeta(meta.message),
      stack: serializeMeta(meta.stack)
    }
  }

  if (meta && typeof meta === 'object') {
    if (seen.has(meta)) return '[circular]'
    seen.add(meta)
    if (Array.isArray(meta)) return meta.map(value => serializeMeta(value, seen))
    return Object.fromEntries(Object.entries(meta).map(([key, value]) => [key, /password|secret|token|authorization|cookie|database.?url|smtp.?url/i.test(key) ? '[redacted]' : serializeMeta(value, seen)]))
  }
  if (typeof meta === 'string') return meta.replace(/(?:postgres(?:ql)?|smtps?):\/\/[^\s]+/gi, '[redacted connection]')

  if (meta == null) return undefined
  return meta
}

function write (level, message, meta) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message
  }

  const serializedMeta = serializeMeta(meta)
  if (serializedMeta !== undefined) {
    payload.meta = serializedMeta
  }

  const line = JSON.stringify(payload)
  if (level === 'error') {
    process.stderr.write(`${line}\n`)
    return
  }

  process.stdout.write(`${line}\n`)
}

const logger = {
  log (message, meta) {
    write('info', message, meta)
  },
  info (message, meta) {
    write('info', message, meta)
  },
  warn (message, meta) {
    write('warn', message, meta)
  },
  error (message, meta) {
    write('error', message, meta)
  }
}

module.exports = logger
