import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../database/connection';
import { asyncHandler } from '../middleware/errorHandler';
import { AppError } from '../middleware/errorHandler';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';
import { authRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Validation rules
const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('firstName').notEmpty().trim(),
  body('lastName').notEmpty().trim(),
  body('hebrewFirstName').optional().trim(),
  body('hebrewLastName').optional().trim(),
  body('organizationName').optional().trim(),
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
];

// Generate JWT tokens
const generateTokens = (userId: string) => {
  const token = jwt.sign(
    { userId },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );

  return { token, refreshToken };
};

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', registerValidation, asyncHandler(async (req, res) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Validation failed', 400);
  }

  const {
    email,
    password,
    firstName,
    lastName,
    hebrewFirstName,
    hebrewLastName,
    organizationName,
  } = req.body;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new AppError('User already exists', 409);
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Create user and organization in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create organization if provided
    let organization = null;
    if (organizationName) {
      organization = await tx.organization.create({
        data: {
          name: organizationName,
          hebrewName: organizationName,
          slug: organizationName.toLowerCase().replace(/\s+/g, '-'),
        },
      });
    }

    // Create user
    const user = await tx.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        hebrewFirstName,
        hebrewLastName,
      },
    });

    // Create user-organization relationship if organization was created
    if (organization) {
      await tx.userOrganization.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: 'OWNER',
        },
      });
    }

    return { user, organization };
  });

  logger.info(`New user registered: ${email}`);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        hebrewFirstName: result.user.hebrewFirstName,
        hebrewLastName: result.user.hebrewLastName,
      },
    },
  });
}));

/**
 * @route POST /api/auth/login
 * @desc Login user
 * @access Public
 */
router.post('/login', authRateLimiter, loginValidation, asyncHandler(async (req, res) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Validation failed', 400);
  }

  const { email, password } = req.body;

  // Find user with organizations
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      organizations: {
        include: {
          organization: true,
        },
      },
    },
  });

  if (!user || !user.isActive) {
    throw new AppError('Invalid credentials', 401);
  }

  // Check password
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new AppError('Invalid credentials', 401);
  }

  // Generate tokens
  const { token, refreshToken } = generateTokens(user.id);

  logger.info(`User logged in: ${email}`);

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        hebrewFirstName: user.hebrewFirstName,
        hebrewLastName: user.hebrewLastName,
        role: user.role,
        organizations: user.organizations.map(org => ({
          id: org.organization.id,
          name: org.organization.name,
          role: org.role,
        })),
      },
      token,
      refreshToken,
    },
  });
}));

/**
 * @route POST /api/auth/logout
 * @desc Logout user
 * @access Private
 */
router.post('/logout', authMiddleware, asyncHandler(async (req, res) => {
  // In a production app, you might want to blacklist the token
  logger.info(`User logged out: ${req.user.email}`);

  res.json({
    success: true,
    message: 'Logout successful',
  });
}));

/**
 * @route GET /api/auth/me
 * @desc Get current user
 * @access Private
 */
router.get('/me', authMiddleware, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: {
      organizations: {
        include: {
          organization: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        hebrewFirstName: user.hebrewFirstName,
        hebrewLastName: user.hebrewLastName,
        role: user.role,
        organizations: user.organizations.map(org => ({
          id: org.organization.id,
          name: org.organization.name,
          role: org.role,
        })),
      },
    },
  });
}));

/**
 * @route POST /api/auth/refresh
 * @desc Refresh access token
 * @access Public
 */
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AppError('Refresh token required', 400);
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET!) as any;
    
    if (decoded.type !== 'refresh') {
      throw new AppError('Invalid token type', 401);
    }

    // Generate new access token
    const token = jwt.sign(
      { userId: decoded.userId },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      data: { token },
    });
  } catch (error) {
    throw new AppError('Invalid refresh token', 401);
  }
}));

/**
 * @route POST /api/auth/change-password
 * @desc Change user password
 * @access Private
 */
router.post('/change-password', authMiddleware, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Validation failed', 400);
  }

  const { currentPassword, newPassword } = req.body;

  // Get user
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Check current password
  const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
  if (!isPasswordValid) {
    throw new AppError('Current password is incorrect', 401);
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 12);

  // Update password
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  logger.info(`Password changed for user: ${user.email}`);

  res.json({
    success: true,
    message: 'Password changed successfully',
  });
}));

export default router;