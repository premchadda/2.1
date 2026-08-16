import express from 'express'
import { dbHelpers, pool } from '../../infrastructure/database/postgres-helpers.js'
import { protect, admin } from '../../middleware/auth.middleware.js'
import EnrollmentService from '../../services/EnrollmentService.js'
import { sanitizeErrorMessage } from '../../utils/sanitizeError.js';

const router = express.Router()

router.use(protect)
router.use(admin)

router.get('/admin/list', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, seriesId, userId, search } = req.query

    const allUsers = await dbHelpers.find('users')
    const allSeries = await dbHelpers.find('testSeries')
    
    const enrollments = await dbHelpers.find('enrollments', {})
    
    let enrichedEnrollments = []
    
    for (const enrollment of enrollments) {
      if (!enrollment.seriesId) continue
      
      const user = allUsers.find(u => String(u.id) === String(enrollment.userId))
      const series = allSeries.find(s => String(s.id || s._id) === String(enrollment.seriesId))
      
      if (!user) continue

      enrichedEnrollments.push({
        id: enrollment.id,
        userId: user.id,
        userName: user.name || 'Unknown',
        userEmail: user.email || '',
        userPhone: user.phone || null,
        isProUser: !!user.isProUser,
        proPassExpiry: user.proPassExpiry || null,
        seriesId: enrollment.seriesId,
        seriesName: series?.title || series?.name || `Series #${enrollment.seriesId}`,
        enrolledAt: enrollment.enrolledAt || enrollment.enrolled_at || user.createdAt || null,
        status: enrollment.status || 'active',
        progress: enrollment.progress || 0,
        isPaid: enrollment.isPaid || false,
        amount: enrollment.amount || 0
      })
    }

    if (search) {
      const searchTerm = search.toLowerCase()
      enrichedEnrollments = enrichedEnrollments.filter(e => 
        e.userName?.toLowerCase().includes(searchTerm) ||
        e.userEmail?.toLowerCase().includes(searchTerm) ||
        e.seriesName?.toLowerCase().includes(searchTerm)
      )
    }

    if (seriesId) {
      enrichedEnrollments = enrichedEnrollments.filter(e => String(e.seriesId) === String(seriesId))
    }

    if (userId) {
      enrichedEnrollments = enrichedEnrollments.filter(e => String(e.userId) === String(userId))
    }

    if (status) {
      enrichedEnrollments = enrichedEnrollments.filter(e => e.status === status)
    }

    enrichedEnrollments.sort((a, b) => new Date(b.enrolledAt || 0) - new Date(a.enrolledAt || 0))

    const offset = (parseInt(page) - 1) * parseInt(limit)
    const paginated = enrichedEnrollments.slice(offset, offset + parseInt(limit))

    res.json({
      success: true,
      data: paginated,
      count: paginated.length,
      total: enrichedEnrollments.length,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: enrichedEnrollments.length,
        totalPages: Math.ceil(enrichedEnrollments.length / parseInt(limit))
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.post('/admin/enroll', async (req, res) => {
  try {
    const { userId, seriesId, seriesIds, sendNotification } = req.body

    if (!userId || (!seriesId && !seriesIds)) {
      return res.status(400).json({
        success: false,
        message: 'userId and seriesId or seriesIds are required'
      })
    }

    const user = await dbHelpers.findById('users', userId)
    if (!user || !user.isActive) {
      return res.status(404).json({
        success: false,
        message: 'User not found or inactive'
      })
    }

    const targetSeriesIds = seriesIds || [seriesId]
    const allSeries = await dbHelpers.find('testSeries', { isActive: true })
    const validSeriesIds = targetSeriesIds.filter(sid => 
      allSeries.some(s => String(s.id || s._id) === String(sid))
    )

    if (validSeriesIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid series found'
      })
    }

    const enrolledSeries = []
    for (const seriesId of validSeriesIds) {
      const result = await EnrollmentService.enrollInSeries(dbHelpers, userId, seriesId)
      if (!result.alreadyEnrolled) {
        enrolledSeries.push(seriesId)
      }
    }

    await dbHelpers.insertOne('activityLogs', {
      userId,
      action: 'admin_enrollment',
      description: `Admin ${req.user.name || req.user.id} enrolled user ${user.name || user.email} in series: ${validSeriesIds.join(', ')}`,
      metadata: {
        adminId: req.user.id,
        targetUserId: userId,
        seriesIds: validSeriesIds,
        enrolledSeries
      },
      createdAt: new Date().toISOString()
    })

    if (sendNotification) {
      const seriesNames = allSeries
        .filter(s => validSeriesIds.includes(s.id || s._id))
        .map(s => s.title || s.name)
      
      await dbHelpers.insertOne('notifications', {
        userId,
        title: 'New Enrollment',
        message: `You have been enrolled in: ${seriesNames.join(', ')}`,
        type: 'enrollment',
        isRead: false,
        createdAt: new Date().toISOString()
      })
    }

    res.json({
      success: true,
      data: { userId, enrolledSeriesIds: validSeriesIds },
      message: `Successfully enrolled user in ${validSeriesIds.length} series`
    })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.delete('/admin/:userId/:seriesId', async (req, res) => {
  try {
    const { userId, seriesId } = req.params

    const user = await dbHelpers.findById('users', userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    const unenrolled = await EnrollmentService.unenrollFromSeries(dbHelpers, userId, parseInt(seriesId))
    
    if (!unenrolled) {
      return res.status(400).json({
        success: false,
        message: 'User is not enrolled in this series'
      })
    }

    await dbHelpers.insertOne('activityLogs', {
      userId,
      action: 'admin_unenrollment',
      description: `Admin ${req.user.name || req.user.id} unenrolled user ${user.name || user.email} from series #${seriesId}`,
      metadata: {
        adminId: req.user.id,
        targetUserId: userId,
        seriesId
      },
      createdAt: new Date().toISOString()
    })

    res.json({
      success: true,
      message: 'User unenrolled successfully'
    })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.post('/admin/bulk-enroll', async (req, res) => {
  try {
    const { userIds, seriesId, sendNotification } = req.body

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'userIds array is required'
      })
    }

    if (!seriesId) {
      return res.status(400).json({
        success: false,
        message: 'seriesId is required'
      })
    }

    const series = await dbHelpers.findById('testSeries', seriesId)
    if (!series || !series.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Series not found or inactive'
      })
    }

    let enrolledCount = 0
    let failedCount = 0
    const errors = []

    for (const userId of userIds) {
      try {
        const user = await dbHelpers.findById('users', userId)
        if (!user || !user.isActive) {
          failedCount++
          errors.push({ userId, reason: 'User not found or inactive' })
          continue
        }

        const result = await EnrollmentService.enrollInSeries(dbHelpers, userId, seriesId)
        if (result.alreadyEnrolled) {
          failedCount++
          errors.push({ userId, reason: 'Already enrolled' })
        } else {
          enrolledCount++
        }
      } catch (err) {
        failedCount++
        errors.push({ userId, reason: err.message })
      }
    }

    await dbHelpers.insertOne('activityLogs', {
      action: 'admin_bulk_enrollment',
      description: `Admin ${req.user.name || req.user.id} bulk enrolled ${enrolledCount} users in ${series.name || series.title}`,
      metadata: {
        adminId: req.user.id,
        seriesId,
        enrolledCount,
        failedCount,
        userIds
      },
      createdAt: new Date().toISOString()
    })

    res.json({
      success: true,
      data: { enrolledCount, failedCount, errors },
      message: `Enrolled ${enrolledCount} users, ${failedCount} failed`
    })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    
    const user = await dbHelpers.findById('users', userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    const allEnrollments = await dbHelpers.find('enrollments', { userId, isActive: true })
    const allSeries = await dbHelpers.find('testSeries', { isActive: true })
    
    const userEnrollments = allEnrollments.map(enrollment => {
      const series = allSeries.find(s => String(s.id || s._id) === String(enrollment.seriesId))
      return {
        id: enrollment.id,
        seriesId: enrollment.seriesId,
        seriesName: series?.title || series?.name || `Series #${enrollment.seriesId}`,
        enrolledAt: enrollment.enrolledAt || enrollment.enrolled_at || null,
        status: enrollment.status || 'active',
        progress: enrollment.progress || 0,
        isPaid: enrollment.isPaid || false,
        amount: enrollment.amount || 0
      }
    })

    res.json({
      success: true,
      data: {
        userId: user.id,
        userName: user.name || 'Unknown',
        userEmail: user.email || '',
        isProUser: !!user.isProUser,
        enrollments: userEnrollments,
        totalEnrollments: userEnrollments.length
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.get('/admin/stats', async (req, res) => {
  try {
    const { seriesId } = req.query

    if (seriesId) {
      const enrollments = await dbHelpers.find('enrollments', {
        seriesId: parseInt(seriesId),
        isActive: true
      })

      const allUsers = await dbHelpers.find('users')
      const series = await dbHelpers.findById('testSeries', parseInt(seriesId))
      
      const enrolledUsers = allUsers.filter(u => 
        enrollments.some(e => String(e.userId) === String(u.id))
      )
      
      res.json({
        success: true,
        data: {
          seriesId,
          seriesName: series?.title || series?.name || 'Unknown',
          totalEnrollments: enrollments.length,
          activeEnrollments: enrollments.filter(e => e.status === 'active').length,
          proEnrollments: enrolledUsers.filter(u => u.isProUser).length
        }
      })
    } else {
      const stats = await EnrollmentService.getEnrollmentStats(dbHelpers)

      const allUsers = await dbHelpers.find('users')
      const allSeries = await dbHelpers.find('testSeries')
      const enrollments = await dbHelpers.find('enrollments', { isActive: true })

      const seriesEnrollments = {}
      enrollments.forEach(e => {
        if (e.seriesId) {
          seriesEnrollments[e.seriesId] = (seriesEnrollments[e.seriesId] || 0) + 1
        }
      })

      const topSeries = Object.entries(seriesEnrollments)
        .map(([sid, count]) => {
          const series = allSeries.find(s => String(s.id || s._id) === String(sid))
          return {
            seriesId: sid,
            seriesName: series?.title || series?.name || 'Unknown',
            enrollments: count
          }
        })
        .sort((a, b) => b.enrollments - a.enrollments)
        .slice(0, 10)

      res.json({
        success: true,
        data: {
          ...stats,
          totalUsers: allUsers.filter(u => u.isActive !== false).length,
          topEnrolledSeries: topSeries,
          seriesCount: Object.keys(seriesEnrollments).length
        }
      })
    }
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.post('/admin/bulk-unenroll', async (req, res) => {
  try {
    const { userIds, seriesId } = req.body

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'userIds array is required'
      })
    }

    if (!seriesId) {
      return res.status(400).json({
        success: false,
        message: 'seriesId is required'
      })
    }

    let unenrolledCount = 0
    let failedCount = 0
    const errors = []

    for (const userId of userIds) {
      try {
        const user = await dbHelpers.findById('users', userId)
        if (!user) {
          failedCount++
          errors.push({ userId, reason: 'User not found' })
          continue
        }

        const unenrolled = await EnrollmentService.unenrollFromSeries(dbHelpers, userId, parseInt(seriesId))
        if (unenrolled) {
          unenrolledCount++
        } else {
          failedCount++
          errors.push({ userId, reason: 'Not enrolled in this series' })
        }
      } catch (err) {
        failedCount++
        errors.push({ userId, reason: err.message })
      }
    }

    res.json({
      success: true,
      data: { unenrolledCount, failedCount, errors },
      message: `Unenrolled ${unenrolledCount} users, ${failedCount} failed`
    })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

export default router
