const fs = require('fs/promises')
const { createReadStream } = require('fs')
const path = require('path')
const crypto = require('crypto')
const os = require('os')
const { spawn } = require('child_process')
const { pipeline } = require('stream/promises')

function pgSettings (url) {
  let parsed
  try { parsed = new URL(url) } catch { throw new Error('A PostgreSQL URL is required') }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname || parsed.pathname.length < 2) throw new Error('Invalid PostgreSQL URL')
  return {
    database: decodeURIComponent(parsed.pathname.slice(1)),
    env: {
      ...process.env,
      PGHOST: parsed.hostname,
      PGPORT: parsed.port || '5432',
      PGUSER: decodeURIComponent(parsed.username),
      PGPASSWORD: decodeURIComponent(parsed.password),
      PGDATABASE: decodeURIComponent(parsed.pathname.slice(1)),
      PGCONNECT_TIMEOUT: '10',
      ...(parsed.searchParams.get('sslmode') ? { PGSSLMODE: parsed.searchParams.get('sslmode') } : {})
    }
  }
}

function encryptionKey (value = process.env.BACKUP_ENCRYPTION_KEY) {
  if (!value || !/^[a-f0-9]{64}$/i.test(value) || new Set(value).size < 12) throw new Error('BACKUP_ENCRYPTION_KEY must be a generated 32-byte hexadecimal key')
  return Buffer.from(value, 'hex')
}

function command (program, args, { env = process.env, timeout = 15 * 60000, output } = {}) {
  const child = spawn(program, args, { env, stdio: ['ignore', output ? 'pipe' : 'ignore', 'pipe'] })
  let stderr = ''
  child.stderr.on('data', chunk => { if (stderr.length < 4096) stderr += chunk.toString() })
  const timer = setTimeout(() => child.kill('SIGKILL'), timeout)
  const done = new Promise((resolve, reject) => {
    child.once('error', error => { clearTimeout(timer); reject(new Error(`${program} could not start: ${error.code}`)) })
    child.once('exit', code => { clearTimeout(timer); if (code === 0) resolve(); else reject(new Error(`${program} failed (exit ${code}); ${stderr.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted connection]')}`)) })
  })
  // Attach a rejection handler while the caller is processing a stream.
  done.catch(() => {})
  return { child, done }
}

async function sha256 (file) {
  const hash = crypto.createHash('sha256')
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  return hash.digest('hex')
}

async function atomicJson (file, data) {
  const temporary = `${file}.${crypto.randomUUID()}.tmp`
  await fs.writeFile(temporary, JSON.stringify(data, null, 2) + '\n', { mode: 0o600, flag: 'wx' })
  await fs.rename(temporary, file)
}

async function stagingDirectory (prefix) {
  const directory = process.env.OPS_TEMP_DIR || os.tmpdir()
  await fs.mkdir(directory, { recursive: true, mode: 0o700 })
  return fs.mkdtemp(path.join(directory, prefix))
}

async function safeCopy (root, relative, destination) {
  if (!/^(avatars|properties|property_docs|application_docs|news|events)\/[^/\\\r\n]+$/.test(relative) || ['.', '..'].includes(path.basename(relative))) throw new Error('Unsafe upload path in backup')
  const source = path.join(root, relative)
  const realRoot = await fs.realpath(root)
  const real = await fs.realpath(source)
  if (!real.startsWith(realRoot + path.sep) || !(await fs.lstat(source)).isFile()) throw new Error('Uploads must be regular files inside storage')
  const target = path.join(destination, relative)
  await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 })
  await fs.copyFile(source, target, fs.constants.COPYFILE_EXCL)
  await fs.chmod(target, 0o600)
  return { path: relative, sha256: await sha256(target), bytes: (await fs.stat(target)).size }
}

module.exports = { pgSettings, encryptionKey, command, sha256, atomicJson, stagingDirectory, safeCopy, pipeline }
