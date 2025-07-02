import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redisClient } from '../services/redis';
import { Request, Response } from 'express';

// Create different rate limiters for different endpoints
export const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: {
      message: 'יותר מדי בקשות מכתובת IP זו, אנא נסה שוב מאוחר יותר.',
      message_en: 'Too many requests from this IP, please try again later.'
    }
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:'
  }),
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        message: 'יותר מדי בקשות מכתובת IP זו, אנא נסה שוב מאוחר יותר.',
        message_en: 'Too many requests from this IP, please try again later.',
        retryAfter: req.rateLimit?.resetTime
      }
    });
  }
});

// Stricter rate limiter for auth endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  skipSuccessfulRequests: true, // Don't count successful requests
  message: {
    success: false,
    error: {
      message: 'יותר מדי ניסיונות התחברות, אנא נסה שוב מאוחר יותר.',
      message_en: 'Too many login attempts, please try again later.'
    }
  },
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:auth:'
  })
});

// API rate limiter for external API calls
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // limit each API key to 30 requests per minute
  keyGenerator: (req: Request) => {
    // Use API key as identifier if present, otherwise use IP
    return req.headers['x-api-key'] as string || req.ip;
  },
  message: {
    success: false,
    error: {
      message: 'חריגה ממגבלת קריאות API, אנא נסה שוב מאוחר יותר.',
      message_en: 'API rate limit exceeded, please try again later.'
    }
  },
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:api:'
  })
});