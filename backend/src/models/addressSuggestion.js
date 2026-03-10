const { DataTypes, Model } = require('sequelize')
const { sequelize } = require('../db')

class AddressSuggestion extends Model {}

AddressSuggestion.init(
  {
    kind: {
      type: DataTypes.ENUM('region', 'city', 'street'),
      allowNull: false
    },
    label: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    labelLower: {
      type: DataTypes.STRING(200),
      allowNull: false,
      field: 'label_lower'
    },

    // Context (best-effort). For kind=region both are NULL.
    region: { type: DataTypes.STRING(200), allowNull: true },
    regionLower: {
      type: DataTypes.STRING(200),
      allowNull: true,
      field: 'region_lower'
    },
    city: { type: DataTypes.STRING(200), allowNull: true },
    cityLower: {
      type: DataTypes.STRING(200),
      allowNull: true,
      field: 'city_lower'
    },

    source: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'nominatim'
    },
    lastSeenAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'last_seen_at'
    }
  },
  {
    sequelize,
    modelName: 'address_suggestion',
    indexes: [
      {
        unique: true,
        // Use DB column names explicitly (underscored=true)
        fields: ['kind', 'label_lower', 'region_lower', 'city_lower']
      },
      { fields: ['kind', 'label_lower'] },
      { fields: ['region_lower'] },
      { fields: ['city_lower'] }
    ]
  }
)

AddressSuggestion.beforeValidate((rec) => {
  const label = String(rec.label || '')
    .replace(/\s+/g, ' ')
    .trim()
  rec.label = label
  rec.labelLower = label.toLowerCase()

  if (rec.region == null || String(rec.region).trim() === '') {
    rec.region = null
    rec.regionLower = null
  } else {
    const region = String(rec.region).replace(/\s+/g, ' ').trim()
    rec.region = region
    rec.regionLower = region.toLowerCase()
  }

  if (rec.city == null || String(rec.city).trim() === '') {
    rec.city = null
    rec.cityLower = null
  } else {
    const city = String(rec.city).replace(/\s+/g, ' ').trim()
    rec.city = city
    rec.cityLower = city.toLowerCase()
  }
})

module.exports = AddressSuggestion
