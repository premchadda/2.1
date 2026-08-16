import express from 'express'
import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js'
import { protect, admin } from '../../middleware/auth.middleware.js'
import { sanitizeErrorMessage } from '../../utils/sanitizeError.js';

const router = express.Router()

// ===== PUBLIC ROUTES =====

// Get yearly data for an exam
router.get('/:examId', async (req, res) => {
  try {
    const { examId } = req.params
    const data = await dbHelpers.find('examYearlyData', { examId })
    
    // Transform array to object keyed by year for easier frontend consumption
    const yearlyData = {}
    data.forEach(item => {
      yearlyData[item.year] = item
    })
    
    res.json({ success: true, data: yearlyData })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

// Get updates for an exam
router.get('/:examId/updates', async (req, res) => {
  try {
    const { examId } = req.params
    const updates = await dbHelpers.find('examUpdates', { examId, isActive: true })
    
    // Sort by date descending
    updates.sort((a, b) => new Date(b.date) - new Date(a.date))
    
    res.json({ success: true, data: updates })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

// ===== ADMIN ROUTES =====

// Create/Update yearly data
router.post('/yearly', protect, admin, async (req, res) => {
  try {
    const { examId, year, ...data } = req.body
    
    // Check if exists
    const existing = await dbHelpers.findOne('examYearlyData', { examId, year })
    
    let result
    if (existing) {
      result = await dbHelpers.updateById('examYearlyData', existing._id || existing.id, {
        ...data,
        updatedAt: new Date().toISOString()
      })
    } else {
      result = await dbHelpers.insertOne('examYearlyData', {
        examId,
        year,
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    }
    
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

// Create update
router.post('/updates', protect, admin, async (req, res) => {
  try {
    const newUpdate = await dbHelpers.insertOne('examUpdates', {
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    res.status(201).json({ success: true, data: newUpdate })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

// Update an update
router.put('/updates/:id', protect, admin, async (req, res) => {
  try {
    const updated = await dbHelpers.updateById('examUpdates', req.params.id, {
      ...req.body,
      updatedAt: new Date().toISOString()
    })
    
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Update not found' })
    }
    
    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

// Delete an update (soft delete)
router.delete('/updates/:id', protect, admin, async (req, res) => {
  try {
    const deleted = await dbHelpers.softDelete('examUpdates', req.params.id, req.user.id)
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Update not found' })
    }
    res.json({ success: true, message: 'Update moved to trash' })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

export default router
