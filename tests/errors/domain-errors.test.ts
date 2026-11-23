import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  SaansAIError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  RateLimitExceededError,
  ExternalProviderError,
  isSaansAIError,
  formatErrorResponse,
} from "@/lib/errors";

describe("SaansAI Domain Errors Architecture", () => {
  it("initializes base SaansAIError with custom codes and JSON serialization", () => {
    const err = new SaansAIError("Test error", "INTERNAL_SERVER_ERROR", 500, { foo: "bar" });
    assert.strictEqual(err.message, "Test error");
    assert.strictEqual(err.code, "INTERNAL_SERVER_ERROR");
    assert.strictEqual(err.statusCode, 500);
    assert.ok(err.timestamp);

    const json = err.toJSON();
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error, "INTERNAL_SERVER_ERROR");
    assert.strictEqual(json.message, "Test error");
  });

  it("creates ValidationError with 400 Bad Request status", () => {
    const valErr = new ValidationError("Invalid coordinates", { field: "lat" });
    assert.strictEqual(valErr.statusCode, 400);
    assert.strictEqual(valErr.code, "VALIDATION_FAILED");
    assert.strictEqual(valErr.message, "Invalid coordinates");
  });

  it("creates NotFoundError with 404 Not Found status", () => {
    const notFound = new NotFoundError("Conversation");
    assert.strictEqual(notFound.statusCode, 404);
    assert.strictEqual(notFound.code, "NOT_FOUND");
    assert.strictEqual(notFound.message, "Conversation not found");
  });

  it("creates UnauthorizedError with 403 Forbidden status", () => {
    const unauth = new UnauthorizedError();
    assert.strictEqual(unauth.statusCode, 403);
    assert.strictEqual(unauth.code, "UNAUTHORIZED");
  });

  it("creates RateLimitExceededError with 429 Too Many Requests status", () => {
    const rateLimit = new RateLimitExceededError(45);
    assert.strictEqual(rateLimit.statusCode, 429);
    assert.strictEqual(rateLimit.code, "RATE_LIMIT_EXCEEDED");
  });

  it("creates ExternalProviderError with 502 Bad Gateway status", () => {
    const providerErr = new ExternalProviderError("OpenAQ", "Connection timeout");
    assert.strictEqual(providerErr.statusCode, 502);
    assert.strictEqual(providerErr.code, "EXTERNAL_PROVIDER_ERROR");
    assert.ok(providerErr.message.includes("OpenAQ"));
  });

  it("identifies SaansAIError instances with isSaansAIError type guard", () => {
    assert.strictEqual(isSaansAIError(new ValidationError()), true);
    assert.strictEqual(isSaansAIError(new Error("plain error")), false);
    assert.strictEqual(isSaansAIError(null), false);
    assert.strictEqual(isSaansAIError("string error"), false);
  });

  it("formats domain errors into uniform HTTP JSON responses", async () => {
    const res = formatErrorResponse(new NotFoundError("Station"));
    assert.strictEqual(res.status, 404);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error, "NOT_FOUND");
    assert.strictEqual(data.message, "Station not found");
  });

  it("formats Zod validation errors into uniform 400 responses", async () => {
    const schema = z.object({ lat: z.number() });
    const parseResult = schema.safeParse({ lat: "invalid" });
    assert.strictEqual(parseResult.success, false);

    if (!parseResult.success) {
      const res = formatErrorResponse(parseResult.error);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error, "VALIDATION_FAILED");
      assert.ok(data.details);
    }
  });

  it("formats generic unknown exceptions into uniform 500 responses", async () => {
    const res = formatErrorResponse(new Error("Unexpected crash"));
    assert.strictEqual(res.status, 500);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error, "INTERNAL_SERVER_ERROR");
    assert.strictEqual(data.message, "Unexpected crash");
  });
});
