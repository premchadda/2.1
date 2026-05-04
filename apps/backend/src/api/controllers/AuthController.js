import { BaseController } from './BaseController.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import EnrollmentService from '../../services/EnrollmentService.js';

export class AuthController extends BaseController {
  constructor() {
    super();
  }

  // Generate JWT Token
  generateToken(id, role = 'user') {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
  }

  // @desc    Register new user
  // @route   POST /api/auth/register
  register = this.handleAsync(async (req, res) => {
    try {
      const { name, email, password, mobile } = req.body;

      // Check if user exists
      const existingUsers = await global.dbHelpers.find('users', { email });
      if (existingUsers.length > 0) {
        return this.sendError(res, 'User already exists with this email', 400);
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create user
      const userData = {
        name,
        email,
        password: hashedPassword,
        mobile: mobile || '',
        role: 'user',
        isProUser: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const newUser = await global.dbHelpers.insertOne('users', userData);

      // Remove password from response
      const { password: _, ...userWithoutPassword } = newUser;

      const token = this.generateToken(newUser._id || newUser.id, newUser.role);

      return this.sendSuccess(res, {
        user: userWithoutPassword,
        token
      }, 'User registered successfully', 201);

    } catch (error) {
      return this.sendError(res, 'Registration failed', 500, error);
    }
  });

  // @desc    Login user
  // @route   POST /api/auth/login
  login = this.handleAsync(async (req, res) => {
    try {
      const { email, password } = req.body;

      // Find user
      const users = await global.dbHelpers.find('users', { email });
      if (users.length === 0) {
        return this.sendError(res, 'Invalid credentials', 401);
      }

      const user = users[0];

      // Check password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return this.sendError(res, 'Invalid credentials', 401);
      }

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;

      const token = this.generateToken(user._id || user.id, user.role);

      return this.sendSuccess(res, {
        user: userWithoutPassword,
        token
      }, 'Login successful');

    } catch (error) {
      return this.sendError(res, 'Login failed', 500, error);
    }
  });

  // @desc    Get current user
  // @route   GET /api/auth/me
  getMe = this.handleAsync(async (req, res) => {
    try {
      const userId = req.user.id;
      const user = await global.dbHelpers.findById('users', userId);

      if (!user) {
        return this.sendError(res, 'User not found', 404);
      }

      // Fetch enrolled IDs from enrollments table (with fallback to legacy arrays)
      const [enrolledSeries, enrolledExams, enrolledStudyMaterials] = await Promise.all([
        EnrollmentService.getEnrolledSeriesIds(global.dbHelpers, userId),
        EnrollmentService.getEnrolledExamIds(global.dbHelpers, userId),
        EnrollmentService.getEnrolledStudyMaterialIds(global.dbHelpers, userId)
      ]);

      const { password: _, ...safeUser } = user;
      
      const normalizedUser = {
        ...safeUser,
        enrolledSeries,
        enrolledExams,
        enrolledStudyMaterials,
        attemptedTests: safeUser.attemptedTests || safeUser.attempted_tests || {},
        attemptedTestIds: safeUser.attemptedTestIds || safeUser.attempted_test_ids || [],
      };
      
      return this.sendSuccess(res, normalizedUser);

    } catch (error) {
      return this.sendError(res, 'Failed to get user', 500, error);
    }
  });
}
