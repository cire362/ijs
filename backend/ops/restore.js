require('dotenv').config()
const { Client } = require('pg')
const fs = require('fs/promises')
const { createReadStream, createWriteStream } = require('fs')
const path = require('path')
const crypto = require('crypto')
const { pgSettings, encryptionKey, command, sha256, stagingDirectory, safeCopy, pipeline } = require('./common')

async function restoreBackup ({
  file, databaseUrl = process.env.RESTORE_DATABASE_URL,
  uploadsDir = process.env.RESTORE_UPLOADS_DIR || '/restore-uploads', key = encryptionKey()
} = {}) {
  const settings = pgSettings(databaseUrl)
  if (process.env.ALLOW_DB_RESTORE !== '1' || process.env.RESTORE_DATABASE_NAME !== settings.database) throw new Error('Restore requires ALLOW_DB_RESTORE=1 and an exact RESTORE_DATABASE_NAME')
  if (!file) throw new Error('Specify an encrypted backup file')
  await fs.mkdir(uploadsDir, { recursive: true, mode: 0o700 })
  if ((await fs.readdir(uploadsDir)).length) throw new Error('Restore uploads destination must be empty')
  const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 10000 })
  const staging = await stagingDirectory('ijs-restore-')
  let restoring = false
  try {
    await client.connect()
    const tables = await client.query("SELECT 1 FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema') LIMIT 1")
    if (tables.rowCount) throw new Error('Restore database must be empty; existing data is never overwritten')
    await client.end()
    const handle = await fs.open(file)
    const { size } = await handle.stat()
    const header = Buffer.alloc(23)
    const tag = Buffer.alloc(16)
    try {
      if (size < 40) throw new Error('Invalid encrypted backup header')
      await handle.read(header, 0, 23, 0)
      await handle.read(tag, 0, 16, size - 16)
    } finally { await handle.close() }
    if (header.subarray(0, 11).toString() !== 'IJSBACKUP1\n') throw new Error('Invalid encrypted backup header')
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, header.subarray(11))
    decipher.setAuthTag(tag)
    const archive = path.join(staging, 'archive.tar.gz')
    await pipeline(createReadStream(file, { start: 23, end: size - 17 }), decipher, createWriteStream(archive, { flags: 'wx', mode: 0o600 }))
    const list = command('tar', ['-tvzf', archive], { output: true })
    let listing = ''
    for await (const chunk of list.child.stdout) {
      listing += chunk.toString()
      if (listing.length > 20 * 1024 * 1024) { list.child.kill('SIGKILL'); throw new Error('Backup manifest is too large') }
    }
    await list.done
    for (const line of listing.trim().split('\n')) {
      if (!/^[-d]/.test(line)) throw new Error('Archive links and special files are forbidden')
      const name = line.match(/(?:\d{2}:\d{2}(?::\d{2})?\s+)(.*)$/)?.[1]
      if (!name || name.startsWith('/') || name.includes('\\') || name.split('/').includes('..') || !/^(manifest\.json|database\.dump|uploads(?:\/.*)?)$/.test(name)) throw new Error('Unsafe archive entry')
    }
    await command('tar', ['-xzf', archive, '-C', staging, '--no-same-owner', '--no-same-permissions']).done
    const manifest = JSON.parse(await fs.readFile(path.join(staging, 'manifest.json'), 'utf8'))
    if (manifest.format !== 1 || !Array.isArray(manifest.files)) throw new Error('Unsupported backup manifest')
    if (await sha256(path.join(staging, 'database.dump')) !== manifest.databaseSha256) throw new Error('Database backup checksum differs')
    for (const file of manifest.files) {
      if (!/^(avatars|properties|property_docs|application_docs|news|events)\/[^/\\\r\n]+$/.test(file.path) || ['.', '..'].includes(path.basename(file.path))) throw new Error('Invalid file path in manifest')
      if (await sha256(path.join(staging, 'uploads', file.path)) !== file.sha256) throw new Error('Upload checksum differs')
    }
    await fs.writeFile(path.join(uploadsDir, '.restore-in-progress'), 'Restore is running', { flag: 'wx', mode: 0o600 })
    restoring = true
    for (const file of manifest.files) await safeCopy(path.join(staging, 'uploads'), file.path, uploadsDir)
    await command('pg_restore', ['--single-transaction', '--exit-on-error', '--no-owner', '--no-privileges', `--dbname=${settings.database}`, path.join(staging, 'database.dump')], { env: settings.env }).done
    await fs.unlink(path.join(uploadsDir, '.restore-in-progress'))
    restoring = false
    return { database: settings.database, fileCount: manifest.files.length }
  } finally {
    // On failure keep the marker and copied files for inspection; the API refuses this storage.
    if (restoring) console.error('Restore incomplete: keep the API stopped and inspect the destination')
    await client.end().catch(() => {})
    await fs.rm(staging, { recursive: true, force: true })
  }
}

if (require.main === module) {
  restoreBackup({ file: process.argv[2] }).then(result => console.log(JSON.stringify({ event: 'restore_completed', ...result })))
    .catch(error => { console.error(error.message); process.exitCode = 1 })
}
module.exports = { restoreBackup }
