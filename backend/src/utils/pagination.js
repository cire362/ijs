// Optional pagination: without page and limit the list keeps its legacy array shape.
function paginate (options, query = {}) {
  const page = query.page
  const limit = query.limit
  if (!page || !limit) {
    return { options, wrap: (Model, finalOptions) => Model.findAll(finalOptions) }
  }
  const paged = { ...options, limit, offset: (page - 1) * limit }
  return {
    options: paged,
    wrap: async (Model, finalOptions) => {
      const { rows, count } = await Model.findAndCountAll({ ...finalOptions, distinct: true })
      return { items: rows, total: count, page, limit }
    }
  }
}

module.exports = { paginate }
