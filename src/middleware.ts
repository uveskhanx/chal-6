import { NextResponse, type NextRequest } from "next/server";

// In-memory sliding-window rate limiter
interface RateLimitRecord {
  count: number;
  resetTime: number;
}
const rateLimitMap = new Map<string, RateLimitRecord>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 60 seconds
const MAX_REQUESTS_PER_WINDOW = 120; // 120 requests per minute

// Periodically clean up expired rate-limit records
if (typeof setInterval !== "undefined") {
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of rateLimitMap.entries()) {
      if (now > record.resetTime) {
        rateLimitMap.delete(ip);
      }
    }
  }, 5 * 60 * 1000);
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }
}

// Allowed origins and pattern matchers for cross-origin requests
const ALLOWED_ORIGIN_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/saanshealth\.vercel\.app$/,
  /^https:\/\/.*saanshealth.*\.vercel\.app$/,
  /^https:\/\/.*\.vercel\.app$/,
  /^https:\/\/.*\.onrender\.com$/,
];

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;

  // Custom environment override
  const envAllowed = process.env.CORS_ALLOWED_ORIGINS;
  if (envAllowed) {
    const list = envAllowed.split(",").map((s) => s.trim().toLowerCase());
    if (list.includes("*") || list.includes(origin.toLowerCase())) {
      return true;
    }
  }

  return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

function buildCorsHeaders(origin: string | null): Record<string, string> {
  const isAllowed = isOriginAllowed(origin);
  // If origin is in allowed list, reflect origin to allow credentials
  // Otherwise, fallback to request origin if provided, or wildcard
  const allowOrigin = origin && isAllowed ? origin : (origin || "*");

  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD",
    "Access-Control-Allow-Headers":
      "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, Origin, Cache-Control, Pragma, X-SaansAI-User",
    "Access-Control-Max-Age": "86400",
  };

  if (allowOrigin !== "*") {
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  return headers;
}

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");
  const corsHeaders = buildCorsHeaders(origin);

  // 1. Path traversal & null-byte injection guard
  const urlPath = request.nextUrl.pathname;
  const rawSearch = request.nextUrl.search;
  const rawUrl = request.url;
  if (
    urlPath.includes("..") ||
    rawSearch.includes("..") ||
    rawUrl.includes("..") ||
    rawSearch.includes("%00") ||
    rawUrl.includes("%00") ||
    rawSearch.includes("\0") ||
    rawUrl.includes("\0")
  ) {
    return new NextResponse(
      JSON.stringify({ error: "BAD_REQUEST", message: "Malicious sequence detected." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 2. Request body size / DoS guard for API routes (max 1MB payload)
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > 1048576) {
    return new NextResponse(
      JSON.stringify({ error: "PAYLOAD_TOO_LARGE", message: "Request payload exceeds 1MB threshold." }),
      { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 3. Handle Preflight OPTIONS Request
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // 4. Sliding-window Rate Limiting for API routes
  if (urlPath.startsWith("/api/")) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";
    const now = Date.now();
    let record = rateLimitMap.get(ip);

    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS };
      rateLimitMap.set(ip, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, MAX_REQUESTS_PER_WINDOW - record.count);
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

    // If rate limit exceeded
    if (record.count > MAX_REQUESTS_PER_WINDOW) {
      return new NextResponse(
        JSON.stringify({
          error: "TOO_MANY_REQUESTS",
          message: "API rate limit exceeded. Please retry in a few seconds.",
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(resetSeconds),
            "X-RateLimit-Limit": String(MAX_REQUESTS_PER_WINDOW),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(resetSeconds),
          },
        }
      );
    }

    const response = NextResponse.next();
    for (const [key, value] of Object.entries(corsHeaders)) {
      response.headers.set(key, value);
    }
    response.headers.set("X-RateLimit-Limit", String(MAX_REQUESTS_PER_WINDOW));
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    response.headers.set("X-RateLimit-Reset", String(resetSeconds));
    return response;
  }

  // 4. Handle Standard Requests
  const response = NextResponse.next();
  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  matcher: "/api/:path*",
};
