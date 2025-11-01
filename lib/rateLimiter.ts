import { RateLimiterMemory } from 'rate-limiter-flexible';
import { NextRequest, NextResponse } from 'next/server';

// Rate limiters for different endpoint types
// Limits are: { points: maxRequests, duration: timeWindowInSeconds }

// Public API endpoints (more lenient)
export const publicApiLimiter = new RateLimiterMemory({
  points: 100, // 100 requests
  duration: 60, // per 60 seconds
});

// Authenticated endpoints (moderate)
export const authenticatedLimiter = new RateLimiterMemory({
  points: 50, // 50 requests
  duration: 60, // per 60 seconds
});

// Order creation endpoint (strict - prevent abuse)
export const orderLimiter = new RateLimiterMemory({
  points: 5, // 5 requests
  duration: 60, // per 60 seconds
});

// Admin endpoints (very strict)
export const adminLimiter = new RateLimiterMemory({
  points: 30, // 30 requests
  duration: 60, // per 60 seconds
});

// TMDB proxy endpoints (moderate - prevent TMDB API abuse)
export const tmdbLimiter = new RateLimiterMemory({
  points: 200, // 200 requests (increased for homepage which makes multiple calls)
  duration: 60, // per 60 seconds
});

/**
 * Get client IP address from request
 */
function getClientIP(request: NextRequest): string {
  // Try various headers (for proxies/load balancers)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const ip = forwarded.split(',')[0].trim();
    if (ip) return ip;
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  // Try CF-Connecting-IP (Cloudflare)
  const cfIP = request.headers.get('cf-connecting-ip');
  if (cfIP) {
    return cfIP;
  }
  
  // Try request headers for IP
  const ipHeader = request.headers.get('x-client-ip') || request.headers.get('x-forwarded');
  if (ipHeader) {
    return ipHeader.split(',')[0].trim();
  }
  
  // Generate a unique key based on request URL and user agent for serverless environments
  // This ensures different users/sessions get different rate limits
  const url = request.url;
  const userAgent = request.headers.get('user-agent') || '';
  const acceptLang = request.headers.get('accept-language') || '';
  
  // Create a hash-like identifier from request characteristics
  // In production with proper IP headers, this won't be used
  const fallbackKey = `${url.slice(0, 50)}:${userAgent.slice(0, 20)}:${acceptLang.slice(0, 10)}`;
  return Buffer.from(fallbackKey).toString('base64').slice(0, 32);
}

/**
 * Rate limit wrapper for API routes
 */
export async function rateLimit(
  request: NextRequest,
  limiter: RateLimiterMemory,
  identifier?: string
): Promise<{ success: boolean; response?: NextResponse }> {
  try {
    // Use provided identifier or IP address
    const key = identifier || getClientIP(request);
    
    // For authenticated routes, prefer user ID over IP
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ') && !identifier) {
      // Extract user ID from token if possible (simplified - in production you'd decode JWT)
      // For now, we'll use IP + auth header hash
      const token = authHeader.replace('Bearer ', '');
      const tokenHash = Buffer.from(token.slice(0, 10)).toString('base64');
      const authKey = `${key}:${tokenHash}`;
      
      await limiter.consume(authKey);
    } else {
      await limiter.consume(key);
    }
    
    return { success: true };
  } catch (rejRes: any) {
    // Rate limit exceeded
    const retryAfter = Math.round(rejRes.msBeforeNext / 1000) || 1;
    const resetTime = typeof Date.now === 'function' && typeof rejRes.msBeforeNext === 'number'
      ? new Date(Date.now() + rejRes.msBeforeNext).toISOString()
      : new Date().toISOString();
    
    return {
      success: false,
      response: NextResponse.json(
        {
          error: 'Too many requests. Please try again later.',
          retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(limiter.points),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': resetTime,
          },
        }
      ),
    };
  }
}

/**
 * Helper to get remaining points (for debugging)
 */
export async function getRemainingPoints(
  request: NextRequest,
  limiter: RateLimiterMemory,
  identifier?: string
): Promise<number> {
  try {
    const key = identifier || getClientIP(request);
    const res = await limiter.get(key);
    return res ? res.remainingPoints : limiter.points;
  } catch {
    return limiter.points;
  }
}


