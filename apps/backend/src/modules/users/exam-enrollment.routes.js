import express from 'express'
import { protect } from '../../middleware/auth.middleware.js'
import { idsMatch } from '../../shared/utils/db-utils.js'
import { findEntityByIdentifier, getInternalId } from '../../shared/utils/identifier-utils.js'
import { buildPublicIdLookup, mapLookupId } from '../../shared/utils/public-id-response.js'
import EnrollmentService from '../../services/EnrollmentService.js'

const router = express.Router()

router.post('/enroll-exam/:examId', protect, async (req, res) => {
  try {
    const { examId } = req.params
    console.log('[Enroll Exam] Request received for examId:', examId, 'userId:', req.user.id)

    const exam = await findEntityByIdentifier(global.dbHelpers, 'exams', examId, {
      slugFields: ['slug', 'exam_id']
    })

    if (!exam) {
      console.log('[Enroll Exam] Exam not found:', examId)
      return res.status(404).json({
        success: false,
        message: 'Exam not found',
      })
    }
    console.log('[Enroll Exam] Exam found:', exam._id || exam.id, exam.title || exam.name)

    const canonicalExamId = getInternalId(exam)

    const result = await EnrollmentService.enrollInExam(
      global.dbHelpers,
      req.user.id,
      canonicalExamId
    )

    if (result.alreadyEnrolled) {
      console.log('[Enroll Exam] User already enrolled')
      const enrolledExamIds = await EnrollmentService.getEnrolledExamIds(
        global.dbHelpers,
        req.user.id
      )
      const enrolledExamsLookup = await buildPublicIdLookup(global.dbHelpers, 'exams', enrolledExamIds)
      return res.json({
        success: true,
        message: 'Already enrolled in this exam',
        alreadyEnrolled: true,
        data: enrolledExamIds.map((value) => mapLookupId(value, enrolledExamsLookup, value)),
      })
    }

    console.log('[Enroll Exam] Created enrollment record in enrollments table')

    const enrolledExamIds = await EnrollmentService.getEnrolledExamIds(
      global.dbHelpers,
      req.user.id
    )
    const enrolledExamsLookup = await buildPublicIdLookup(global.dbHelpers, 'exams', enrolledExamIds)

    res.json({
      success: true,
      message: 'Successfully enrolled in exam',
      alreadyEnrolled: false,
      data: enrolledExamIds.map((value) => mapLookupId(value, enrolledExamsLookup, value))
    })
  } catch (error) {
    console.error('[Enroll Exam] Error:', error)
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
})

router.delete('/unenroll-exam/:examId', protect, async (req, res) => {
  try {
    const { examId } = req.params
    console.log('[Unenroll Exam] Request received for examId:', examId, 'userId:', req.user.id)

    const exam = await findEntityByIdentifier(global.dbHelpers, 'exams', examId, {
      slugFields: ['slug', 'exam_id']
    })

    if (!exam) {
      console.log('[Unenroll Exam] Exam not found:', examId)
      return res.status(404).json({
        success: false,
        message: 'Exam not found',
      })
    }
    console.log('[Unenroll Exam] Exam found:', exam._id || exam.id, exam.title || exam.name)

    const canonicalExamId = getInternalId(exam)

    const unenrolled = await EnrollmentService.unenrollFromExam(
      global.dbHelpers,
      req.user.id,
      canonicalExamId
    )

    if (!unenrolled) {
      console.log('[Unenroll Exam] User not enrolled in this exam')
      return res.status(400).json({
        success: false,
        message: 'You are not enrolled in this exam',
      })
    }

    console.log('[Unenroll Exam] Successfully unenrolled')

    const enrolledExamIds = await EnrollmentService.getEnrolledExamIds(
      global.dbHelpers,
      req.user.id
    )
    const enrolledExamsLookup = await buildPublicIdLookup(global.dbHelpers, 'exams', enrolledExamIds)

    res.json({
      success: true,
      message: 'Successfully unenrolled from exam',
      data: enrolledExamIds.map((value) => mapLookupId(value, enrolledExamsLookup, value))
    })
  } catch (error) {
    console.error('[Unenroll Exam] Error:', error)
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
})

router.get('/enrolled-exams', protect, async (req, res) => {
  try {
    const enrolledExamIds = await EnrollmentService.getEnrolledExamIds(
      global.dbHelpers,
      req.user.id
    )

    const allExams = await global.dbHelpers.find('exams')
    const populatedExams = allExams
      .filter(exam =>
        enrolledExamIds.some(id => String(id) === String(exam.id || exam._id))
      )
      .sort((a, b) => (a.displayOrder ?? a.display_order ?? 0) - (b.displayOrder ?? b.display_order ?? 0))
    
    res.json({
      success: true,
      data: populatedExams,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
})

export default router