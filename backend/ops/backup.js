require('dotenv').config()
const { Client } = require('pg')
const fs = require('fs/promises')
const { createWriteStream } = require('fs')
const path = require('path')
const crypto = require('crypto')
const { pgSettings, encryptionKey, command, sha256, atomicJson, stagingDirectory, safeCopy, pipeline } = require('./common')

async function createBackup ({
  databaseUrl = process.env.DATABASE_URL,
  uploadsDir = process.env.UPLOADS_DIR || '/uploads', backupDir = process.env.BACKUP_DIR || '/backups',
  mirrorDir = process.env.BACKUP_MIRROR_DIR, key, keep = Number(process.env.BACKUP_KEEP || 14)
} = {}) {
  const settings = pgSettings(databaseUrl)
  await fs.mkdir(backupDir, { recursive: true, mode: 0o700 })
  const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 10000, query_timeout: 15 * 60000 })
  const staging = await stagingDirectory('ijs-backup-')
  const name = `ijs-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID()}.tar.gz.enc`
  const temporary = path.join(backupDir, `.${name}.partial`)
  try {
    key = key || encryptionKey()
    if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('Backup encryption requires a 32-byte key')
    if (!Number.isInteger(keep) || keep < 2 || keep > 365) throw new Error('BACKUP_KEEP must be between 2 and 365')
    if (mirrorDir && path.resolve(mirrorDir) === path.resolve(backupDir)) throw new Error('Backup mirror must use a separate directory')
    await client.connect()
    await client.query("SET lock_timeout='10s'")
    await client.query("SELECT pg_advisory_lock_shared(hashtextextended('ijshub:migrations', 0))")
    await client.query("SELECT pg_advisory_lock(hashtextextended('ijshub:files', 0))")
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    const snapshot = (await client.query('SELECT pg_export_snapshot() AS id')).rows[0].id
    const references = await client.query(`SELECT avatar_url AS url FROM users WHERE avatar_url IS NOT NULL UNION
      SELECT cover_image_url FROM events WHERE cover_image_url IS NOT NULL UNION
      SELECT url FROM property_images UNION SELECT url FROM property_documents UNION SELECT url FROM news_images UNION
      SELECT attachment_url FROM application_chat_messages WHERE attachment_url IS NOT NULL`)
    const files = []
    await fs.mkdir(path.join(staging, 'uploads'), { mode: 0o700 })
    for (const { url } of references.rows) {
      if (url.startsWith('/uploads/')) files.push(await safeCopy(uploadsDir, url.slice('/uploads/'.length), path.join(staging, 'uploads')))
    }
    await command('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', `--snapshot=${snapshot}`, `--file=${path.join(staging, 'database.dump')}`], { env: settings.env }).done
    const manifest = {
      format: 1,
      createdAt: new Date().toISOString(),
      database: settings.database,
      databaseSha256: await sha256(path.join(staging, 'database.dump')),
      files
    }
    await fs.writeFile(path.join(staging, 'manifest.json'), JSON.stringify(manifest), { mode: 0o600 })
    await client.query('COMMIT')
    await client.end()
    const iv = crypto.randomBytes(12)
    await fs.writeFile(temporary, Buffer.concat([Buffer.from('IJSBACKUP1\n'), iv]), { mode: 0o600, flag: 'wx' })
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    const archive = command('tar', ['-czf', '-', '-C', staging, 'manifest.json', 'database.dump', 'uploads'], { output: true })
    try { await pipeline(archive.child.stdout, cipher, createWriteStream(temporary, { flags: 'a', mode: 0o600 })); await archive.done } catch (error) { archive.child.kill('SIGKILL'); throw error }
    await fs.appendFile(temporary, cipher.getAuthTag())
    await fs.rename(temporary, path.join(backupDir, name))
    if (mirrorDir) {
      await fs.mkdir(mirrorDir, { recursive: true, mode: 0o700 })
      const copy = path.join(mirrorDir, `.${name}.partial`)
      await fs.copyFile(path.join(backupDir, name), copy, fs.constants.COPYFILE_EXCL)
      await fs.chmod(copy, 0o600)
      if (await sha256(copy) !== await sha256(path.join(backupDir, name))) throw new Error('Backup mirror checksum differs')
      await fs.rename(copy, path.join(mirrorDir, name))
    }
    for (const directory of [backupDir, ...(mirrorDir ? [mirrorDir] : [])]) {
      const backups = (await fs.readdir(directory)).filter(file => /^ijs-[\w-]+\.tar\.gz\.enc$/.test(file)).sort().reverse()
      for (const obsolete of backups.slice(keep)) await fs.unlink(path.join(directory, obsolete))
    }
    await atomicJson(path.join(backupDir, 'status.json'), { lastSuccessAt: manifest.createdAt, file: name, bytes: (await fs.stat(path.join(backupDir, name))).size, fileCount: files.length, mirrored: Boolean(mirrorDir), lastError: null })
    return { file: name, fileCount: files.length }
  } catch (error) {
    const statusPath = path.join(backupDir, 'status.json')
    const previous = await fs.readFile(statusPath, 'utf8').then(JSON.parse).catch(() => ({}))
    await atomicJson(statusPath, { ...previous, lastFailureAt: new Date().toISOString(), lastError: 'backup_failed' }).catch(() => {})
    throw error
  } finally {
    await client.end().catch(() => {})
    await fs.rm(staging, { recursive: true, force: true })
    await fs.unlink(temporary).catch(() => {})
  }
}

async function main () {
  const interval = Number(process.env.BACKUP_INTERVAL_SECONDS || 86400)
  if (!Number.isInteger(interval) || interval < 60) throw new Error('BACKUP_INTERVAL_SECONDS must be at least 60')
  let stopped = false
  let wake
  process.on('SIGTERM', () => { stopped = true; wake?.() })
  process.on('SIGINT', () => { stopped = true; wake?.() })
  while (true) {
    if (stopped) break
    let failed = false
    try { console.log(JSON.stringify({ event: 'backup_completed', ...await createBackup() })) } catch (error) {
      failed = true
      console.error(JSON.stringify({ event: 'backup_failed', error: error.message }))
      if (!process.argv.includes('--daemon')) throw error
    }
    if (process.argv.includes('--daemon') && !stopped) {
      await new Promise(resolve => {
        const timer = setTimeout(resolve, (failed ? Math.min(interval, 300) : interval) * 1000)
        wake = () => { clearTimeout(timer); resolve() }
      })
    }
    if (!process.argv.includes('--daemon')) break
  }
}

if (require.main === module) main().catch(() => { process.exitCode = 1 })
module.exports = { createBackup }
