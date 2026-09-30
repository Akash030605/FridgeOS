import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for POST /api/analyze
 * 10 requests per hour per IP using in-memory store
 */
export const analyzeRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many image analysis requests. Limit is 10 requests per hour.',
  },
});

/**
 * Rate limiter for POST /api/recipes
 * 20 requests per hour per IP using in-memory store
 */
export const recipesRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many recipe generation requests. Limit is 20 requests per hour.',
  },
});
