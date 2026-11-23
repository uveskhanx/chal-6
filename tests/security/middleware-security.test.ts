import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

describe("SaansAI Security Middleware & Threat Defense", () => {
  it("rejects path traversal attempts with 400 Bad Request", () => {
    const req = new NextRequest("http://localhost:3000/api/aqi/live?path=../../etc/passwd");
    const res = middleware(req);

    assert.strictEqual(res.status, 400);
  });

  it("rejects null-byte injection attempts with 400 Bad Request", () => {
    const req = new NextRequest("http://localhost:3000/api/aqi/live?station=delhi%00admin");
    const res = middleware(req);

    assert.strictEqual(res.status, 400);
  });

  it("rejects oversized request payloads (> 1MB) with 413 Payload Too Large", () => {
    const req = new NextRequest("http://localhost:3000/api/simulator/simulate", {
      method: "POST",
      headers: {
        "Content-Length": "2097152", // 2MB
        "Content-Type": "application/json",
      },
    });
    const res = middleware(req);

    assert.strictEqual(res.status, 413);
  });

  it("injects defense-in-depth rate limit headers on API routes", () => {
    const req = new NextRequest("http://localhost:3000/api/aqi/stations", {
      headers: {
        "x-forwarded-for": "198.51.100.42",
      },
    });
    const res = middleware(req);

    assert.ok(res.headers.has("x-ratelimit-limit"));
    assert.ok(res.headers.has("x-ratelimit-remaining"));
    assert.ok(res.headers.has("x-ratelimit-reset"));
  });

  it("handles CORS preflight OPTIONS requests with 204 No Content", () => {
    const req = new NextRequest("http://localhost:3000/api/commute/route", {
      method: "OPTIONS",
      headers: {
        origin: "https://saanshealth.vercel.app",
        "access-control-request-method": "POST",
      },
    });
    const res = middleware(req);

    assert.strictEqual(res.status, 204);
    assert.strictEqual(res.headers.get("access-control-allow-origin"), "https://saanshealth.vercel.app");
    assert.strictEqual(res.headers.get("access-control-allow-credentials"), "true");
  });
});
