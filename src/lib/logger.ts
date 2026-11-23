import "server-only";

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  userId?: string;
  conversationId?: string;
  requestId?: string;
  path?: string;
  [key: string]: unknown;
}

class Logger {
  private isProduction = process.env.NODE_ENV === "production";

  private formatMessage(level: LogLevel, message: string, context?: LogContext, error?: unknown): string {
    const timestamp = new Date().toISOString();

    if (this.isProduction) {
      const errorObj =
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : error !== undefined
          ? { error: String(error) }
          : undefined;

      return JSON.stringify({
        timestamp,
        level,
        message,
        ...context,
        ...(errorObj ? { error: errorObj } : {}),
      });
    }

    // Development & Test: Human-readable colored output
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    const ctxStr = context && Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : "";
    const errStr = error instanceof Error ? ` - Error: ${error.message}` : error ? ` - ${String(error)}` : "";
    return `${prefix} ${message}${ctxStr}${errStr}`;
  }

  public debug(message: string, context?: LogContext): void {
    if (process.env.DEBUG || process.env.NODE_ENV === "development") {
      console.debug(this.formatMessage("debug", message, context));
    }
  }

  public info(message: string, context?: LogContext): void {
    console.info(this.formatMessage("info", message, context));
  }

  public warn(message: string, context?: LogContext, error?: unknown): void {
    console.warn(this.formatMessage("warn", message, context, error));
  }

  public error(message: string, context?: LogContext, error?: unknown): void {
    console.error(this.formatMessage("error", message, context, error));
  }
}

export const logger = new Logger();
