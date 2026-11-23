import "server-only";
import { getRegisteredTool } from "./registry";
import { AgentContext } from "../types";
import { AGENT_CONFIG } from "../config";
import { logger } from "@/lib/logger";

export interface ToolExecutionResponse {
  toolName: string;
  toolCallId: string;
  result: unknown;
  isError: boolean;
  executionTimeMs: number;
}

/**
 * Safely executes a registered tool with argument validation, bounded timeouts, and error containment.
 */
export async function executeToolCall(
  toolName: string,
  toolCallId: string,
  rawArgs: Record<string, unknown>,
  context: AgentContext
): Promise<ToolExecutionResponse> {
  const startTime = Date.now();
  const tool = getRegisteredTool(toolName);

  if (!tool) {
    return {
      toolName,
      toolCallId,
      result: {
        error: `TOOL_NOT_FOUND: The tool '${toolName}' is not registered.`,
      },
      isError: true,
      executionTimeMs: Date.now() - startTime,
    };
  }

  // 1. Validate Arguments with Zod
  const validation = tool.argumentSchema.safeParse(rawArgs ?? {});
  if (!validation.success) {
    return {
      toolName,
      toolCallId,
      result: {
        error: "INVALID_TOOL_ARGUMENTS",
        message: `Arguments provided for '${toolName}' failed schema validation.`,
        validationDetails: validation.error.format(),
      },
      isError: true,
      executionTimeMs: Date.now() - startTime,
    };
  }

  // 2. Execute with Bounded Timeout & Resource Cleanup
  let timeoutId: NodeJS.Timeout | undefined;
  try {
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error(`TOOL_TIMEOUT: '${toolName}' exceeded ${AGENT_CONFIG.toolTimeoutMs}ms execution limit.`)),
        AGENT_CONFIG.toolTimeoutMs
      );
    });

    const executionPromise = tool.execute(validation.data as Record<string, unknown>, context);
    const result = await Promise.race([executionPromise, timeoutPromise]);

    return {
      toolName,
      toolCallId,
      result,
      isError: false,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error occurred while executing tool.";
    logger.warn(`[ToolExecutor] Error executing '${toolName}':`, undefined, error);
    return {
      toolName,
      toolCallId,
      result: {
        error: "TOOL_EXECUTION_FAILURE",
        message: errorMsg,
      },
      isError: true,
      executionTimeMs: Date.now() - startTime,
    };
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
