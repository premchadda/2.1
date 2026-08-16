import express from 'express'
import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js'
import { protect } from '../../middleware/auth.middleware.js'
import { idsMatch } from '../../shared/utils/db-utils.js'
import { findEntityByIdentifier, getInternalId } from '../../shared/utils/identifier-utils.js'
import { buildPublicIdLookup, mapLookupId } from '../../shared/utils/public-id-response.js'
import EnrollmentService from '../../services/EnrollmentService.js'
import { sanitizeErrorMessage } from '../../utils/sanitizeError.js';

const router = express.Router()

router.post('/enroll-study-material/:materialId', protect, async (req, res) => {
  try {
    const { materialId } = req.params
    console.log('[Enroll Study Material] Request received for materialId:', materialId, 'userId:', req.user.id)

    const material = await findEntityByIdentifier(dbHelpers, 'studyMaterials', materialId, {
      slugFields: ['slug']
    })

    if (!material) {
      console.log('[Enroll Study Material] Material not found:', materialId)
      return res.status(404).json({
        success: false,
        message: 'Study material not found',
      })
    }
    console.log('[Enroll Study Material] Material found:', material._id || material.id, material.title)

    const canonicalMaterialId = getInternalId(material)

    const result = await EnrollmentService.enrollInStudyMaterial(
      dbHelpers,
      req.user.id,
      canonicalMaterialId
    )

    if (result.alreadyEnrolled) {
      console.log('[Enroll Study Material] User already enrolled')
      const enrolledMaterialIds = await EnrollmentService.getEnrolledStudyMaterialIds(
        dbHelpers,
        req.user.id
      )
      const enrolledStudyMaterialsLookup = await buildPublicIdLookup(dbHelpers, 'studyMaterials', enrolledMaterialIds)
      return res.json({
        success: true,
        message: 'Already enrolled in this study material',
        alreadyEnrolled: true,
        data: enrolledMaterialIds.map((value) => mapLookupId(value, enrolledStudyMaterialsLookup, value)),
      })
    }

    console.log('[Enroll Study Material] Created enrollment record in enrollments table')

    const enrolledMaterialIds = await EnrollmentService.getEnrolledStudyMaterialIds(
      dbHelpers,
      req.user.id
    )
    const enrolledStudyMaterialsLookup = await buildPublicIdLookup(dbHelpers, 'studyMaterials', enrolledMaterialIds)

    res.json({
      success: true,
      message: 'Successfully enrolled in study material',
      alreadyEnrolled: false,
      data: enrolledMaterialIds.map((value) => mapLookupId(value, enrolledStudyMaterialsLookup, value))
    })
  } catch (error) {
    console.error('[Enroll Study Material] Error:', error)
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    })
  }
})

router.delete('/unenroll-study-material/:materialId', protect, async (req, res) => {
  try {
    const { materialId } = req.params
    console.log('[Unenroll Study Material] Request received for materialId:', materialId, 'userId:', req.user.id)

    const material = await findEntityByIdentifier(dbHelpers, 'studyMaterials', materialId, {
      slugFields: ['slug']
    })

    if (!material) {
      console.log('[Unenroll Study Material] Material not found:', materialId)
      return res.status(404).json({
        success: false,
        message: 'Study material not found',
      })
    }
    console.log('[Unenroll Study Material] Material found:', material._id || material.id, material.title)

    const canonicalMaterialId = getInternalId(material)

    // Archive study material reading history before unenrolling
    try {
      const studyHistory = await dbHelpers.find('studyProgress', { 
        userId: req.user.id, 
        materialId: canonicalMaterialId 
      })
      
      if (studyHistory.length > 0) {
        for (const history of studyHistory) {
          await dbHelpers.insertOne('user_history_archive', {
            userId: req.user.id,
            materialId: canonicalMaterialId,
            type: 'study_material_progress',
            originalId: history._id || history.id,
            data: history,
            archivedAt: new Date().toISOString()
          })
        }
        console.log(`[Unenroll Study Material] Archived ${studyHistory.length} study progress records`)
      }
    } catch (archiveError) {
      console.error('[Unenroll Study Material] Error archiving history:', archiveError)
    }
    
    const unenrolled = await EnrollmentService.unenrollFromStudyMaterial(
      dbHelpers,
      req.user.id,
      canonicalMaterialId
    )

    if (!unenrolled) {
      console.log('[Unenroll Study Material] User not enrolled in this material')
      return res.status(400).json({
        success: false,
        message: 'You are not enrolled in this study material',
      })
    }

    console.log('[Unenroll Study Material] Successfully unenrolled')

    const enrolledMaterialIds = await EnrollmentService.getEnrolledStudyMaterialIds(
      dbHelpers,
      req.user.id
    )
    const enrolledStudyMaterialsLookup = await buildPublicIdLookup(dbHelpers, 'studyMaterials', enrolledMaterialIds)

    res.json({
      success: true,
      message: 'Successfully unenrolled from study material. Your history has been archived.',
      data: enrolledMaterialIds.map((value) => mapLookupId(value, enrolledStudyMaterialsLookup, value))
    })
  } catch (error) {
    console.error('[Unenroll Study Material] Error:', error)
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    })
  }
})

router.get('/enrolled-study-materials', protect, async (req, res) => {
  try {
    const enrolledMaterialIds = await EnrollmentService.getEnrolledStudyMaterialIds(
      dbHelpers,
      req.user.id
    )

    const allMaterials = await dbHelpers.find('studyMaterials')
    const populatedMaterials = allMaterials.filter(material =>
      enrolledMaterialIds.some(id => String(id) === String(material.id || material._id))
    )
    
    res.json({
      success: true,
      data: populatedMaterials,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    })
  }
})

export default router