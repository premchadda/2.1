/**
 * Centralized validation schemas using express-validator
 * Migration 010: Added as part of database schema audit fixes
 */

import { body, param, query } from 'express-validator';

// Common validators
const idParam = param('id').isInt({ min: 1 }).withMessage('Valid ID required');
const publicIdParam = param('id').matches(/^[a-z]+_[0-9a-f-]+$/).withMessage('Valid public ID required');
const pagination = {
  page: query('page').optional().isInt({ min: 1 }).toInt(),
  limit: query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
};

// User validation
export const validateUser = {
  create: [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 chars'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 chars'),
    body('role').optional().isIn(['user', 'admin', 'editor', 'viewer', 'support']).withMessage('Invalid role'),
    body('phone').optional().matches(/^\+?[\d\s-()]+$/).withMessage('Invalid phone format'),
    body('dateOfBirth').optional().isISO8601().withMessage('Valid date required (YYYY-MM-DD)'),
  ],
  update: [
    idParam,
    body('email').optional().isEmail().normalizeEmail().withMessage('Valid email required'),
    body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 chars'),
    body('role').optional().isIn(['user', 'admin', 'editor', 'viewer', 'support']).withMessage('Invalid role'),
    body('phone').optional().matches(/^\+?[\d\s-()]+$/).withMessage('Invalid phone format'),
    body('dateOfBirth').optional().isISO8601().withMessage('Valid date required (YYYY-MM-DD)'),
    body('proExpiry').optional().isISO8601().withMessage('Valid timestamp required'),
    body('isProUser').optional().isBoolean().withMessage('Must be true or false'),
    body('passType').optional().isIn(['free', 'pro', 'premium']).withMessage('Invalid pass type'),
  ],
  delete: [idParam],
};

// Test Series validation
export const validateTestSeries = {
  create: [
    body('name').trim().isLength({ min: 2, max: 255 }).withMessage('Name must be 2-255 chars'),
    body('slug').optional().isSlug().withMessage('Valid slug required'),
    body('description').optional().trim(),
    body('stages').optional().isArray().withMessage('Stages must be an array'),
    body('stages.*').optional().isInt({ min: 1 }).withMessage('Valid stage ID required'),
    body('isComingSoon').optional().isBoolean().withMessage('Must be true or false'),
    body('order').optional().isInt({ min: 0 }).withMessage('Order must be positive'),
  ],
  update: [
    idParam,
    body('name').optional().trim().isLength({ min: 2, max: 255 }).withMessage('Name must be 2-255 chars'),
    body('slug').optional().isSlug().withMessage('Valid slug required'),
    body('description').optional().trim(),
    body('stages').optional().isArray().withMessage('Stages must be an array'),
    body('stages.*').optional().isInt({ min: 1 }).withMessage('Valid stage ID required'),
    body('isComingSoon').optional().isBoolean().withMessage('Must be true or false'),
    body('order').optional().isInt({ min: 0 }).withMessage('Order must be positive'),
  ],
};

// Test validation
export const validateTest = {
  create: [
    body('title').trim().isLength({ min: 2, max: 255 }).withMessage('Title must be 2-255 chars'),
    body('slug').optional().isSlug().withMessage('Valid slug required'),
    body('seriesId').optional().isInt({ min: 1 }).withMessage('Valid series ID required'),
    body('testCategoryId').optional().isInt({ min: 1 }).withMessage('Valid category ID required'),
    body('stageId').optional().isInt({ min: 1 }).withMessage('Valid stage ID required'),
    body('subjectId').optional().isInt({ min: 1 }).withMessage('Valid subject ID required'),
    body('sectionId').optional().isInt({ min: 1 }).withMessage('Valid section ID required'),
    body('duration').optional().isInt({ min: 0 }).withMessage('Duration must be positive'),
    body('totalMarks').optional().isInt({ min: 0 }).withMessage('Marks must be positive'),
    body('passingMarks').optional().isInt({ min: 0 }).withMessage('Passing marks must be positive'),
    body('negativeMarking').optional().isFloat({ min: 0 }).withMessage('Negative marking must be positive'),
    body('difficulty').optional().isIn(['Easy', 'Medium', 'Hard']).withMessage('Invalid difficulty'),
    body('isComingSoon').optional().isBoolean().withMessage('Must be true or false'),
    body('comingSoonDate').optional().isISO8601().withMessage('Valid timestamp required'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    body('languages').optional().isArray().withMessage('Languages must be an array'),
  ],
  update: [
    idParam,
    body('title').optional().trim().isLength({ min: 2, max: 255 }).withMessage('Title must be 2-255 chars'),
    body('slug').optional().isSlug().withMessage('Valid slug required'),
    body('seriesId').optional().isInt({ min: 1 }).withMessage('Valid series ID required'),
    body('testCategoryId').optional().isInt({ min: 1 }).withMessage('Valid category ID required'),
    body('stageId').optional().isInt({ min: 1 }).withMessage('Valid stage ID required'),
    body('subjectId').optional().isInt({ min: 1 }).withMessage('Valid subject ID required'),
    body('sectionId').optional().isInt({ min: 1 }).withMessage('Valid section ID required'),
    body('duration').optional().isInt({ min: 0 }).withMessage('Duration must be positive'),
    body('totalMarks').optional().isInt({ min: 0 }).withMessage('Marks must be positive'),
    body('passingMarks').optional().isInt({ min: 0 }).withMessage('Passing marks must be positive'),
    body('negativeMarking').optional().isFloat({ min: 0 }).withMessage('Negative marking must be positive'),
    body('difficulty').optional().isIn(['Easy', 'Medium', 'Hard']).withMessage('Invalid difficulty'),
    body('isComingSoon').optional().isBoolean().withMessage('Must be true or false'),
    body('comingSoonDate').optional().isISO8601().withMessage('Valid timestamp required'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    body('languages').optional().isArray().withMessage('Languages must be an array'),
  ],
};

// Question validation
export const validateQuestion = {
  create: [
    body('text').trim().notEmpty().withMessage('Question text required'),
    body('options').isArray({ min: 2, max: 10 }).withMessage('2-10 options required'),
    body('options.*').isObject().withMessage('Each option must be an object'),
    body('correctAnswer').isInt({ min: 0 }).withMessage('Valid correct answer index required'),
    body('explanation').optional().trim(),
    body('marks').optional().isInt({ min: 0 }).withMessage('Marks must be positive'),
    body('negMarks').optional().isFloat({ min: 0 }).withMessage('Negative marks must be positive'),
    body('difficulty').optional().isIn(['Easy', 'Medium', 'Hard']).withMessage('Invalid difficulty'),
    body('testId').optional().isInt({ min: 1 }).withMessage('Valid test ID required'),
    body('chapterId').optional().isInt({ min: 1 }).withMessage('Valid chapter ID required'),
    body('topicId').optional().isInt({ min: 1 }).withMessage('Valid topic ID required'),
    body('seriesId').optional().isInt({ min: 1 }).withMessage('Valid series ID required'),
    body('categoryId').optional().isString().withMessage('Valid category ID required'),
    body('studyMaterialId').optional().isInt({ min: 1 }).withMessage('Valid study material ID required'),
    body('isPractice').optional().isBoolean().withMessage('Must be true or false'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
  ],
  update: [
    idParam,
    body('text').optional().trim().notEmpty().withMessage('Question text required'),
    body('options').optional().isArray({ min: 2, max: 10 }).withMessage('2-10 options required'),
    body('options.*').optional().isObject().withMessage('Each option must be an object'),
    body('correctAnswer').optional().isInt({ min: 0 }).withMessage('Valid correct answer index required'),
    body('explanation').optional().trim(),
    body('marks').optional().isInt({ min: 0 }).withMessage('Marks must be positive'),
    body('negMarks').optional().isFloat({ min: 0 }).withMessage('Negative marks must be positive'),
    body('difficulty').optional().isIn(['Easy', 'Medium', 'Hard']).withMessage('Invalid difficulty'),
    body('testId').optional().isInt({ min: 1 }).withMessage('Valid test ID required'),
    body('chapterId').optional().isInt({ min: 1 }).withMessage('Valid chapter ID required'),
    body('topicId').optional().isInt({ min: 1 }).withMessage('Valid topic ID required'),
    body('seriesId').optional().isInt({ min: 1 }).withMessage('Valid series ID required'),
    body('categoryId').optional().isString().withMessage('Valid category ID required'),
    body('studyMaterialId').optional().isInt({ min: 1 }).withMessage('Valid study material ID required'),
    body('isPractice').optional().isBoolean().withMessage('Must be true or false'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
  ],
};

// Attempt validation
export const validateAttempt = {
  create: [
    body('testId').isInt({ min: 1 }).withMessage('Valid test ID required'),
    body('questions').isArray({ min: 1 }).withMessage('Questions array required'),
    body('questions.*').isInt({ min: 1 }).withMessage('Valid question ID required'),
  ],
  submit: [
    param('id').isInt({ min: 1 }).withMessage('Valid attempt ID required'),
    body('answers').isObject().withMessage('Answers object required'),
    body('questionResults').optional().isObject().withMessage('Question results must be object'),
    body('sectionScores').optional().isObject().withMessage('Section scores must be object'),
    body('sectionTimes').optional().isObject().withMessage('Section times must be object'),
    body('isCompleted').optional().isBoolean().withMessage('Must be true or false'),
  ],
};

// Subject validation
export const validateSubject = {
  create: [
    body('title').trim().isLength({ min: 2, max: 255 }).withMessage('Title must be 2-255 chars'),
    body('slug').optional().isSlug().withMessage('Valid slug required'),
    body('description').optional().trim(),
    body('parentId').optional().isInt({ min: 1 }).withMessage('Valid parent ID required'),
    body('color').optional().matches(/^#[0-9a-f]{6}$/i).withMessage('Valid hex color required'),
    body('stageIds').optional().isArray().withMessage('Stage IDs must be an array'),
    body('stageIds.*').optional().isInt({ min: 1 }).withMessage('Valid stage ID required'),
    body('order').optional().isInt({ min: 0 }).withMessage('Order must be positive'),
  ],
  update: [
    idParam,
    body('title').optional().trim().isLength({ min: 2, max: 255 }).withMessage('Title must be 2-255 chars'),
    body('slug').optional().isSlug().withMessage('Valid slug required'),
    body('description').optional().trim(),
    body('parentId').optional().isInt({ min: 1 }).withMessage('Valid parent ID required'),
    body('color').optional().matches(/^#[0-9a-f]{6}$/i).withMessage('Valid hex color required'),
    body('stageIds').optional().isArray().withMessage('Stage IDs must be an array'),
    body('stageIds.*').optional().isInt({ min: 1 }).withMessage('Valid stage ID required'),
    body('order').optional().isInt({ min: 0 }).withMessage('Order must be positive'),
  ],
};

// Chapter validation
export const validateChapter = {
  create: [
    body('title').trim().isLength({ min: 2, max: 255 }).withMessage('Title must be 2-255 chars'),
    body('slug').optional().isSlug().withMessage('Valid slug required'),
    body('studyMaterialId').isInt({ min: 1 }).withMessage('Valid subject ID required'),
    body('unitId').optional().isInt({ min: 1 }).withMessage('Valid unit ID required'),
    body('stageIds').optional().isArray().withMessage('Stage IDs must be an array'),
    body('stageIds.*').optional().isInt({ min: 1 }).withMessage('Valid stage ID required'),
    body('orderIndex').optional().isInt({ min: 0 }).withMessage('Order must be positive'),
  ],
  update: [
    idParam,
    body('title').optional().trim().isLength({ min: 2, max: 255 }).withMessage('Title must be 2-255 chars'),
    body('slug').optional().isSlug().withMessage('Valid slug required'),
    body('studyMaterialId').optional().isInt({ min: 1 }).withMessage('Valid subject ID required'),
    body('unitId').optional().isInt({ min: 1 }).withMessage('Valid unit ID required'),
    body('stageIds').optional().isArray().withMessage('Stage IDs must be an array'),
    body('stageIds.*').optional().isInt({ min: 1 }).withMessage('Valid stage ID required'),
    body('orderIndex').optional().isInt({ min: 0 }).withMessage('Order must be positive'),
  ],
};

// Topic validation
export const validateTopic = {
  create: [
    body('name').trim().isLength({ min: 2, max: 255 }).withMessage('Name must be 2-255 chars'),
    body('slug').optional().isSlug().withMessage('Valid slug required'),
    body('chapterId').isInt({ min: 1 }).withMessage('Valid chapter ID required'),
    body('stageIds').optional().isArray().withMessage('Stage IDs must be an array'),
    body('stageIds.*').optional().isInt({ min: 1 }).withMessage('Valid stage ID required'),
    body('orderIndex').optional().isInt({ min: 0 }).withMessage('Order must be positive'),
  ],
  update: [
    idParam,
    body('name').optional().trim().isLength({ min: 2, max: 255 }).withMessage('Name must be 2-255 chars'),
    body('slug').optional().isSlug().withMessage('Valid slug required'),
    body('chapterId').optional().isInt({ min: 1 }).withMessage('Valid chapter ID required'),
    body('stageIds').optional().isArray().withMessage('Stage IDs must be an array'),
    body('stageIds.*').optional().isInt({ min: 1 }).withMessage('Valid stage ID required'),
    body('orderIndex').optional().isInt({ min: 0 }).withMessage('Order must be positive'),
  ],
};

// Role validation
export const validateRole = {
  create: [
    body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Role name must be 2-50 chars'),
    body('description').optional().trim(),
    body('permissions').optional().isArray().withMessage('Permissions must be an array'),
    body('permissions.*').isUUID().withMessage('Valid permission UUID required'),
  ],
  update: [
    param('id').isUUID().withMessage('Valid role UUID required'),
    body('name').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Role name must be 2-50 chars'),
    body('description').optional().trim(),
    body('permissions').optional().isArray().withMessage('Permissions must be an array'),
    body('permissions.*').isUUID().withMessage('Valid permission UUID required'),
  ],
  assign: [
    body('userId').isInt({ min: 1 }).withMessage('Valid user ID required'),
    body('roleId').isUUID().withMessage('Valid role UUID required'),
  ],
};

// Subscription validation
export const validateSubscription = {
  create: [
    body('userId').isInt({ min: 1 }).withMessage('Valid user ID required'),
    body('planType').isIn(['monthly', 'yearly', 'lifetime']).withMessage('Valid plan type required'),
    body('startDate').optional().isISO8601().withMessage('Valid timestamp required'),
    body('expiryDate').isISO8601().withMessage('Valid timestamp required'),
    body('amountPaid').optional().isFloat({ min: 0 }).withMessage('Amount must be positive'),
    body('transactionId').optional().trim(),
    body('paymentMethod').optional().isIn(['card', 'upi', 'netbanking', 'wallet']).withMessage('Invalid payment method'),
  ],
  update: [
    idParam,
    body('planType').optional().isIn(['monthly', 'yearly', 'lifetime']).withMessage('Valid plan type required'),
    body('expiryDate').optional().isISO8601().withMessage('Valid timestamp required'),
    body('status').optional().isIn(['active', 'expired', 'cancelled', 'pending']).withMessage('Invalid status'),
    body('autoRenew').optional().isBoolean().withMessage('Must be true or false'),
  ],
};

// Export all validators
export const validators = {
  validateUser,
  validateTestSeries,
  validateTest,
  validateQuestion,
  validateAttempt,
  validateSubject,
  validateChapter,
  validateTopic,
  validateRole,
  validateSubscription,
  pagination,
  idParam,
  publicIdParam,
};

// Validation error handler middleware
export const handleValidationErrors = (req, res, next) => {
  const errors = req.validationErrors?.() || [];
  if (errors.length === 0) return next();
  
  return res.status(400).json({
    success: false,
    error: 'Validation failed',
    details: errors.map(err => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value,
    })),
  });
};
