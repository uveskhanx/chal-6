import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { logger } from "@/lib/logger";

describe("SaansAI Production Structured Logger Suite", () => {
  let originalDebug: typeof console.debug;
  let originalInfo: typeof console.info;
  let originalWarn: typeof console.warn;
  let originalError: typeof console.error;

  const captured: { level: string; message: string }[] = [];

  beforeEach(() => {
    captured.length = 0;
    originalDebug = console.debug;
    originalInfo = console.info;
    originalWarn = console.warn;
    originalError = console.error;

    console.debug = (msg: unknown) => captured.push({ level: "debug", message: String(msg) });
    console.info = (msg: unknown) => captured.push({ level: "info", message: String(msg) });
    console.warn = (msg: unknown) => captured.push({ level: "warn", message: String(msg) });
    console.error = (msg: unknown) => captured.push({ level: "error", message: String(msg) });
  });

  afterEach(() => {
    console.debug = originalDebug;
    console.info = originalInfo;
    console.warn = originalWarn;
    console.error = originalError;
  });

  it("logs info messages with timestamp and formatted context", () => {
    logger.info("Test info message", { requestId: "req-123", userId: "user-456" });

    assert.equal(captured.length, 1);
    assert.equal(captured[0].level, "info");
    assert.ok(captured[0].message.includes("Test info message"));
    assert.ok(captured[0].message.includes("req-123"));
  });

  it("logs warning messages with error objects", () => {
    const error = new Error("Sample warning error");
    logger.warn("Test warning message", { path: "/api/aqi/live" }, error);

    assert.equal(captured.length, 1);
    assert.equal(captured[0].level, "warn");
    assert.ok(captured[0].message.includes("Test warning message"));
    assert.ok(captured[0].message.includes("Sample warning error"));
  });

  it("logs error messages with string errors and Error instances", () => {
    logger.error("Standard error occurred", undefined, "Database timeout");
    assert.equal(captured.length, 1);
    assert.equal(captured[0].level, "error");
    assert.ok(captured[0].message.includes("Database timeout"));

    const realError = new TypeError("Invalid parameter type");
    logger.error("Type error occurred", { detail: "missing_field" }, realError);
    assert.equal(captured.length, 2);
    assert.ok(captured[1].message.includes("Invalid parameter type"));
  });

  it("handles debug messages according to environment flags", () => {
    process.env.DEBUG = "true";

    logger.debug("Debug telemetry event", { latencyMs: 42 });
    assert.ok(captured.some((c) => c.level === "debug" && c.message.includes("Debug telemetry event")));

    delete process.env.DEBUG;
  });
});
