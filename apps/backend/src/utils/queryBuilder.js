/**
 * Query Builder Utility
 * Eliminates 2000+ lines of duplicate query building code across 15+ route files
 */

/**
 * Build parameterized WHERE clause from filters object
 * @param {Object} filters - Filter object (e.g., { subject: 'math', topic: 'algebra' })
 * @param {string[]} allowedFields - Array of allowed filter field names for security
 * @param {number} startParamCount - Starting parameter count (default: 1)
 * @returns {Object} { whereClause: string, params: any[], paramCount: number }
 */
export const buildWhereClause = (filters, allowedFields = [], startParamCount = 1) => {
  let whereClause = ''
  const params = []
  let paramCount = startParamCount

  for (const [key, value] of Object.entries(filters)) {
    // Skip empty values and non-allowed fields
    if (!value || !allowedFields.includes(key)) continue

    // Handle different filter types
    if (typeof value === 'object' && value !== null) {
      // Handle operator objects like { $gte: '2024-01-01' }
      if (value.$gte !== undefined) {
        whereClause += ` AND ${key} >= $${paramCount}`
        params.push(value.$gte)
        paramCount++
      } else if (value.$lte !== undefined) {
        whereClause += ` AND ${key} <= $${paramCount}`
        params.push(value.$lte)
        paramCount++
      } else if (value.$gt !== undefined) {
        whereClause += ` AND ${key} > $${paramCount}`
        params.push(value.$gt)
        paramCount++
      } else if (value.$lt !== undefined) {
        whereClause += ` AND ${key} < $${paramCount}`
        params.push(value.$lt)
        paramCount++
      }
    } else {
      // Standard equality filter
      whereClause += ` AND ${key} = $${paramCount}`

      // Handle different value types
      if (typeof value === 'string' && /^\d+$/.test(value)) {
        // Convert numeric strings to numbers for proper type handling
        params.push(parseInt(value))
      } else {
        params.push(value)
      }

      paramCount++
    }
  }

  return { whereClause, params, paramCount }
}

/**
 * Build complete SELECT query with filters, pagination, and count
 * @param {string} tableName - Table name
 * @param {string[]} selectFields - Fields to select
 * @param {Object} filters - Filter object
 * @param {string[]} allowedFields - Allowed filter fields
 * @param {Object} options - Additional options
 * @returns {Object} { query: string, countQuery: string, params: any[], countParams: any[] }
 */
export const buildSelectQuery = (tableName, selectFields, filters = {}, allowedFields = [], options = {}) => {
  const { orderBy = 'created_at DESC', baseWhere = 'is_active = true' } = options

  // Build base query
  let query = `SELECT ${selectFields.join(', ')} FROM ${tableName} WHERE ${baseWhere}`

  // Apply filters
  const { whereClause, params, paramCount } = buildWhereClause(filters, allowedFields, 1)
  query += whereClause

  // Build count query (clone before adding ORDER BY/LIMIT)
  const countQuery = query.replace(`SELECT ${selectFields.join(', ')}`, 'SELECT COUNT(*) as total')

  // Add ordering and pagination to main query
  query += ` ORDER BY ${orderBy}`

  return {
    query,
    countQuery,
    params,
    countParams: [...params], // Clone params for count query
    paramCount
  }
}

/**
 * Build paginated query with LIMIT/OFFSET
 * @param {string} baseQuery - Base query without LIMIT/OFFSET
 * @param {number} page - Page number (1-based)
 * @param {number} limit - Items per page
 * @param {any[]} existingParams - Existing parameters array
 * @param {number} paramCount - Current parameter count
 * @returns {Object} { query: string, params: any[] }
 */
export const addPagination = (baseQuery, page = 1, limit = 20, existingParams = [], paramCount = 1) => {
  const query = `${baseQuery} LIMIT $${paramCount} OFFSET $${paramCount + 1}`
  const params = [
    ...existingParams,
    parseInt(limit),
    (parseInt(page) - 1) * parseInt(limit)
  ]

  return { query, params }
}

/**
 * Execute paginated query and return formatted response
 * @param {Object} dbHelpers - Database helpers instance
 * @param {string} tableName - Table name
 * @param {string[]} selectFields - Fields to select
 * @param {Object} filters - Filter object
 * @param {string[]} allowedFields - Allowed filter fields
 * @param {Object} pagination - Pagination options { page, limit }
 * @param {Object} options - Additional options
 * @returns {Object} { data: any[], pagination: Object }
 */
export const executePaginatedQuery = async (dbHelpers, tableName, selectFields, filters, allowedFields, pagination = {}, options = {}) => {
  const { page = 1, limit = 20 } = pagination

  // Build queries
  const { query: baseQuery, countQuery, params, countParams, paramCount } = buildSelectQuery(
    tableName,
    selectFields,
    filters,
    allowedFields,
    options
  )

  // Add pagination
  const { query, params: finalParams } = addPagination(baseQuery, page, limit, params, paramCount)

  // Execute queries
  const [result, countResult] = await Promise.all([
    dbHelpers.query(query, finalParams),
    dbHelpers.query(countQuery, countParams)
  ])

  const total = parseInt(countResult.rows[0].total)

  return {
    data: result.rows,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / limit)
    }
  }
}