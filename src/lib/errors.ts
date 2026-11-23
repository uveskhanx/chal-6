import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * SaansAI Standard Domain Error Architecture.
 * Provides strongly-typed, serialization-safe error primitives across API routes and services.
 */

export type ErrorCode =
  | "VALIDATION_FAILED"
  | "INVALID_COORDINATES_QUERY"
  | "INVALID_STATIONS_QUERY"
  | "INVALID_CHAT_REQUEST"
  | "INVALID_SIMULATION_PARAMETERS"
  | "INVALID_COMPARISON_PARAMETERS"
  | "INVALID_ROOM_CONFIGURATION"
  | "INVALID_ROOM_DATA"
  | "MISSING_ROOM_DATA"
  | "NOT_FOUND"
  | "ROOM_NOT_FOUND"
  | "CONVERSATION_NOT_FOUND"
  | "UNAUTHORIZED"
  | "RATE_LIMIT_EXCEEDED"
  | "TOO_MANY_REQUESTS"
  | "PAYLOAD_TOO_LARGE"
  | "EXTERNAL_PROVIDER_ERROR"
  | "SIMULATION_FAILED"
  | "COMPARISON_FAILED"
  | "SAVE_ROOM_FAILED"
  | "UPDATE_ROOM_FAILED"
  | "FAILED_TO_CREATE_CONVERSATION"
  | "BAD_REQUEST"
  | "INTERNAL_SERVER_ERROR";

export class SaansAIError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;
  public readonly timestamp: string;

  constructor(message: string, code: ErrorCode = "INTERNAL_SERVER_ERROR", statusCode: number = 500, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  public toJSON() {
    return {
      success: false,
      error: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

export class ValidationError extends SaansAIError {
  constructor(message: string = "Request validation failed", details?: unknown, code: ErrorCode = "VALIDATION_FAILED") {
    super(message, code, 400, details);
  }
}

export class NotFoundError extends SaansAIError {
  constructor(resource: string = "Resource", code: ErrorCode = "NOT_FOUND") {
    super(`${resource} not found`, code, 404);
  }
}

export class UnauthorizedError extends SaansAIError {
  constructor(message: string = "Unauthorized access attempt", code: ErrorCode = "UNAUTHORIZED") {
    super(message, code, 403);
  }
}

export class RateLimitExceededError extends SaansAIError {
  constructor(retryAfterSeconds: number = 60, code: ErrorCode = "RATE_LIMIT_EXCEEDED") {
    super("API rate limit exceeded. Please retry later.", code, 429, {
      retryAfterSeconds,
    });
  }
}

export class ExternalProviderError extends SaansAIError {
  constructor(providerName: string, message: string = "Provider unavailable") {
    super(`External provider '${providerName}' failed: ${message}`, "EXTERNAL_PROVIDER_ERROR", 502);
  }
}

export function isSaansAIError(error: unknown): error is SaansAIError {
  return error instanceof SaansAIError;
}

/**
 * Formats any caught error into a consistent, strongly typed HTTP JSON response.
 */
export function formatErrorResponse(
  error: unknown,
  fallbackMessage = "An unexpected server error occurred."
): NextResponse {
  if (isSaansAIError(error)) {
    return NextResponse.json(
      {
        success: false,
        error: error.code,
        message: error.message,
        details: error.details,
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: "VALIDATION_FAILED",
        message: "Request validation failed.",
        details: error.format(),
      },
      { status: 400 }
    );
  }

  const message = error instanceof Error ? error.message : fallbackMessage;
  return NextResponse.json(
    {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message,
    },
    { status: 500 }
  );
}
