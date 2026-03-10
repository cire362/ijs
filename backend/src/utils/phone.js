function toDigits (value) {
  return String(value || '').replace(/\D/g, '')
}

function toCanonicalRuDigits (value) {
  const digits = toDigits(value)
  if (digits.length !== 11) return null
  if (digits.startsWith('8')) return `7${digits.slice(1)}`
  if (digits.startsWith('7')) return digits
  return null
}

function formatRuPhone (value) {
  const canonical = toCanonicalRuDigits(value)
  if (!canonical) return null
  const p = canonical.slice(1)
  return `+7 ${p.slice(0, 3)} ${p.slice(3, 6)}-${p.slice(6, 8)}-${p.slice(8, 10)}`
}

function isValidRuPhone (value) {
  return Boolean(toCanonicalRuDigits(value))
}

module.exports = {
  toDigits,
  toCanonicalRuDigits,
  formatRuPhone,
  isValidRuPhone
}
