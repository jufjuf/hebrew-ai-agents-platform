import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../database/connection';
import { AppError } from './errorHandler';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user: {
        id: string;
        email: string;
        role: string;
        organizationIds: string[];
      };
    }
  }
}

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401);
    }

    const token = authHeader.substring(7);

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        organizations: {
          select: {
            organizationId: true,
            role: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new AppError('Invalid token', 401);
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationIds: user.organizations.map(org => org.organizationId),
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AppError('Token expired', 401));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new AppError('Invalid token', 401));
    }
    next(error);
  }
};

// Optional auth middleware (doesn't fail if no token)
export const optionalAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        organizations: {
          select: {
            organizationId: true,
            role: true,
          },
        },
      },
    });

    if (user && user.isActive) {
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        organizationIds: user.organizations.map(org => org.organizationId),
      };
    }

    next();
  } catch (error) {
    // Ignore errors and continue without user
    next();
  }
};