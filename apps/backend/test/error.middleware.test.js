import { jest, describe, it, expect, beforeEach } from '@jest/globals'

describe('Error Middleware', () => {
  let mockReq
  let mockRes
  let mockNext

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      path: '/test',
      originalUrl: '/test',
    }
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    }
    mockNext = jest.fn()
  })

  describe('AppError', () => {
    it('should create an error with default values', async () => {
      const { AppError } = await import('../src/middleware/error.middleware.js')
      const error = new AppError('Test error')
      expect(error.message).toBe('Test error')
      expect(error.statusCode).toBe(500)
      expect(error.code).toBe('INTERNAL_ERROR')
      expect(error.isOperational).toBe(true)
    })

    it('should create an error with custom values', async () => {
      const { AppError } = await import('../src/middleware/error.middleware.js')
      const error = new AppError('Not found', 404, 'NOT_FOUND')
      expect(error.message).toBe('Not found')
      expect(error.statusCode).toBe(404)
      expect(error.code).toBe('NOT_FOUND')
    })
  })

  describe('ValidationError', () => {
    it('should create a validation error', async () => {
      const { ValidationError } = await import('../src/middleware/error.middleware.js')
      const error = new ValidationError('Validation failed', [{ field: 'email', message: 'Invalid' }])
      expect(error.statusCode).toBe(400)
      expect(error.code).toBe('VALIDATION_ERROR')
      expect(error.errors).toHaveLength(1)
    })
  })

  describe('errorHandler', () => {
    it('should handle operational errors', async () => {
      const { errorHandler, NotFoundError } = await import('../src/middleware/error.middleware.js')
      const error = new NotFoundError('Resource not found')
      
      errorHandler(error, mockReq, mockRes, mockNext)
      
      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'NOT_FOUND',
            message: 'Resource not found',
          }),
        })
      )
    })

    it('should handle JWT errors', async () => {
      const { errorHandler } = await import('../src/middleware/error.middleware.js')
      const error = new Error('Invalid token')
      error.name = 'JsonWebTokenError'
      
      errorHandler(error, mockReq, mockRes, mockNext)
      
      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INVALID_TOKEN',
          }),
        })
      )
    })

    it('should handle token expiration', async () => {
      const { errorHandler } = await import('../src/middleware/error.middleware.js')
      const error = new Error('Token expired')
      error.name = 'TokenExpiredError'
      
      errorHandler(error, mockReq, mockRes, mockNext)
      
      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'TOKEN_EXPIRED',
          }),
        })
      )
    })

    it('should handle PostgreSQL unique violation (23505)', async () => {
      const { errorHandler } = await import('../src/middleware/error.middleware.js')
      const error = new Error('Unique violation')
      error.code = '23505'
      
      errorHandler(error, mockReq, mockRes, mockNext)
      
      expect(mockRes.status).toHaveBeenCalledWith(409)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'DUPLICATE_ENTRY',
          }),
        })
      )
    })

    it('should handle file size limit errors', async () => {
      const { errorHandler } = await import('../src/middleware/error.middleware.js')
      const error = new Error('File too large')
      error.code = 'LIMIT_FILE_SIZE'
      
      errorHandler(error, mockReq, mockRes, mockNext)
      
      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'FILE_TOO_LARGE',
          }),
        })
      )
    })

    it('should handle CORS errors', async () => {
      const { errorHandler } = await import('../src/middleware/error.middleware.js')
      const error = new Error('Not allowed by CORS')
      
      errorHandler(error, mockReq, mockRes, mockNext)
      
      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'CORS_ERROR',
          }),
        })
      )
    })

    it('should hide error details in production', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'
      
      const { errorHandler } = await import('../src/middleware/error.middleware.js')
      const error = new Error('Internal database connection failed')
      
      errorHandler(error, mockReq, mockRes, mockNext)
      
      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: 'An unexpected error occurred. Please try again later.',
          }),
        })
      )
      
      process.env.NODE_ENV = originalEnv
    })
  })

  describe('notFoundHandler', () => {
    it('should create a 404 error and call next', async () => {
      const { notFoundHandler } = await import('../src/middleware/error.middleware.js')
      notFoundHandler(mockReq, mockRes, mockNext)
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          code: 'NOT_FOUND',
        })
      )
    })
  })

  describe('asyncHandler', () => {
    it('should catch async errors and pass to next', async () => {
      const { asyncHandler } = await import('../src/middleware/error.middleware.js')
      const asyncFn = jest.fn().mockRejectedValue(new Error('Async error'))
      const handler = asyncFn
      
      await asyncHandler(handler)(mockReq, mockRes, mockNext)
      
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Async error' })
      )
    })
  })
})
