const fs = require('fs/promises')

function officeArchiveHas (buffer, expected) {
  // Inspect the central directory, never inflate user-controlled archives.
  let end = -1
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { end = i; break }
  }
  if (end < 0) return false
  const count = buffer.readUInt16LE(end + 10)
  const size = buffer.readUInt32LE(end + 12)
  let offset = buffer.readUInt32LE(end + 16)
  if (count > 10000 || offset + size > end) return false
  const names = new Set()
  for (let n = 0; n < count; n++) {
    if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50) return false
    const length = buffer.readUInt16LE(offset + 28)
    const next = offset + 46 + length + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32)
    if (next > end) return false
    names.add(buffer.subarray(offset + 46, offset + 46 + length).toString('utf8'))
    offset = next
  }
  return names.has('[Content_Types].xml') && names.has(expected)
}

async function verifyFileContent (file) {
  const handle = await fs.open(file.path, 'r')
  let header
  try {
    header = Buffer.alloc(512)
    const { bytesRead } = await handle.read(header, 0, header.length, 0)
    header = header.subarray(0, bytesRead)
  } finally { await handle.close() }
  const starts = (hex) => header.subarray(0, hex.length / 2).equals(Buffer.from(hex, 'hex'))
  let valid = false
  switch (file.mimetype) {
    case 'image/png': valid = starts('89504e470d0a1a0a'); break
    case 'image/jpeg': valid = starts('ffd8ff'); break
    case 'image/webp': valid = header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP'; break
    case 'application/pdf': valid = header.toString('ascii', 0, 5) === '%PDF-'; break
    case 'application/msword':
    case 'application/vnd.ms-excel': valid = starts('d0cf11e0a1b11ae1'); break
    case 'text/plain': {
      const buffer = await fs.readFile(file.path)
      try { new TextDecoder('utf-8', { fatal: true }).decode(buffer); valid = !buffer.includes(0) } catch {}
      break
    }
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
      if (file.size <= 15 * 1024 * 1024 && starts('504b0304')) {
        valid = officeArchiveHas(await fs.readFile(file.path), file.mimetype.includes('wordprocessingml') ? 'word/document.xml' : 'xl/workbook.xml')
      }
      break
    }
  }
  if (!valid) throw Object.assign(new Error('Содержимое файла не соответствует заявленному формату'), { status: 400 })
}

function verifiedUpload (middleware) {
  return (req, res, next) => middleware(req, res, (error) => {
    if (error) return next(error)
    Promise.all([...(req.file ? [req.file] : []), ...(Array.isArray(req.files) ? req.files : [])].map(verifyFileContent))
      .then(() => next(), next)
  })
}

module.exports = { verifiedUpload, verifyFileContent }
