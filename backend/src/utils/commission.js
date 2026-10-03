function scaledDecimal (value, digits) {
  const text = String(value)
  if (!/^\d+(\.\d+)?$/.test(text)) throw new Error('Invalid decimal amount')
  const [whole, fraction = ''] = text.split('.')
  if (fraction.length > digits && /[1-9]/.test(fraction.slice(digits))) throw new Error('Decimal precision exceeded')
  return BigInt(whole) * 10n ** BigInt(digits) + BigInt(fraction.slice(0, digits).padEnd(digits, '0'))
}

function commissionSnapshot (property, rate) {
  const snapshot = {
    commissionRateId: rate?.id || null,
    commissionRatePercent: rate?.commissionFrom ?? null,
    commissionBasePrice: property.price ?? null,
    commissionAmount: null
  }
  if (rate && property.price != null) {
    const cents = (scaledDecimal(property.price, 2) * scaledDecimal(rate.commissionFrom, 3) + 50000n) / 100000n
    snapshot.commissionAmount = `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`
  }
  return snapshot
}

module.exports = { commissionSnapshot, scaledDecimal }
