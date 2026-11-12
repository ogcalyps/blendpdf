/**
 * Simple in-memory rate limiter for API routes
 * For production, consider using Redis or a dedicated rate limiting service
 */

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
}

const defaultOptions: RateLimitOptions = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per 15 minutes
};

/**
 * Check if a request should be rate limited
 * @param identifier - Unique identifier (IP address, user ID, etc.)
 * @param options - Rate limit options
 * @returns Object with allowed status and remaining requests
 */
export function checkRateLimit(
  identifier: string,
  options: Partial<RateLimitOptions> = {}
): { allowed: boolean; remaining: number; resetTime: number } {
  const opts = { ...defaultOptions, ...options };
  const now = Date.now();
  const key = identifier;

  // Clean up expired entries periodically (every 1000 checks)
  if (Math.random() < 0.001) {
    cleanupExpiredEntries(now);
  }

  // Get or create entry
  let entry = store[key];

  if (!entry || now > entry.resetTime) {
    // Create new entry or reset expired one
    entry = {
      count: 0,
      resetTime: now + opts.windowMs,
    };
    store[key] = entry;
  }

  // Increment count
  entry.count++;

  const allowed = entry.count <= opts.maxRequests;
  const remaining = Math.max(0, opts.maxRequests - entry.count);

  return {
    allowed,
    remaining,
    resetTime: entry.resetTime,
  };
}

/**
 * Clean up expired entries from the store
 */
function cleanupExpiredEntries(now: number): void {
  const keys = Object.keys(store);
  for (const key of keys) {
    if (now > store[key].resetTime) {
      delete store[key];
    }
  }
}

/**
 * Get client IP address from request
 *
 * Security note: nginx uses proxy_add_x_forwarded_for, which APPENDS the real
 * client IP to whatever X-Forwarded-For the client sent. The leftmost entry is
 * therefore client-controlled and must never be trusted for rate limiting.
 * Prefer x-real-ip (set by nginx from $remote_addr), then the RIGHTMOST
 * x-forwarded-for entry (the one our proxy appended).
 */
export function getClientIP(request: Request): string {
  const realIP = request.headers.get('x-real-ip');
  if (realIP && realIP.trim()) {
    return realIP.trim();
  }

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // Take the rightmost entry: it is the only one appended by our own proxy.
    const parts = forwarded.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) {
      return parts[parts.length - 1];
    }
  }

  // Fallback (won't work in serverless, but useful for development)
  return 'unknown';
}

/**
 * Every API route together, per IP: the per-route budgets below add up to
 * well over 100 heavy calls per window, so this keeps one IP's total near
 * the old single shared counter (20). A real workspace save chains at most
 * unlock, OCR, compress and protect (4 calls); three tries of that, plus a
 * couple of other tools, stay far under it.
 */
export const GLOBAL_MAX_REQUESTS = 40;
export const GLOBAL_WINDOW_MS = 15 * 60 * 1000;

/**
 * The route a request reaches, as the limiter keys it. Next routes
 * /api/ocr%2Dpdf to the same handler as /api/ocr-pdf, so the key is the
 * decoded path (repeated and trailing slashes dropped); a malformed escape
 * keeps the raw path, and the global counter still applies to it.
 */
export function routeKey(request: Request): string {
  const raw = new URL(request.url).pathname;
  let path = raw;
  try {
    path = decodeURIComponent(raw);
  } catch {
    path = raw;
  }
  return path.replace(/\/{2,}/g, '/').replace(/(.)\/+$/, '$1');
}

/**
 * Rate limit middleware for Next.js API routes. Each route keeps its own
 * budget per IP (one workspace save can chain unlock, OCR, compress and
 * protect, and a shared counter would let those use up OCR's 5), and every
 * call also counts against the IP's GLOBAL_MAX_REQUESTS across all routes.
 */
export function rateLimitMiddleware(
  request: Request,
  options: Partial<RateLimitOptions> = {}
): { allowed: boolean; remaining: number; resetTime: number; error?: string } {
  const ip = getClientIP(request);
  const route = checkRateLimit(`route:${routeKey(request)}:${ip}`, options);
  const global = checkRateLimit(`all:${ip}`, { windowMs: GLOBAL_WINDOW_MS, maxRequests: GLOBAL_MAX_REQUESTS });
  const result = route.allowed && !global.allowed ? global : route;

  if (!result.allowed) {
    return {
      ...result,
      error: `Too many requests. Please try again after ${new Date(result.resetTime).toISOString()}`,
    };
  }

  return { ...result, remaining: Math.min(route.remaining, global.remaining) };
}
