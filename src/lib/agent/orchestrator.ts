import "server-only";
import {
  AgentContext,
  AgentStreamEvent,
} from "./types";
import { AGENT_CONFIG, isGeminiConfigured } from "./config";
import { callGemini, GeminiCallParams, GeminiContent, GeminiPart } from "./gemini-client";
import { executeToolCall } from "./tools/executor";
import { getBoundedConversationContext, addMessageToConversation } from "./conversation-store";
import { logger } from "@/lib/logger";

export interface AgentRunOptions {
  userMessage: string;
  context: AgentContext;
  onEvent?: (event: AgentStreamEvent) => void;
}

export interface AgentRunResult {
  response: string;
  toolCallsExecuted: { tool: string; args: Record<string, unknown>; result: unknown }[];
  conversationId: string;
  messageId: string;
  iterationsCount: number;
}

/**
 * Main Bounded Agentic Orchestrator.
 * Implements bounded iteration loop, argument/result validation, infinite loop guards,
 * and real tool execution.
 */
export async function runAgentOrchestrator(options: AgentRunOptions): Promise<AgentRunResult> {
  const { userMessage, context, onEvent } = options;
  const emit = onEvent || (() => {});

  // 1. Check if Gemini is configured; if missing, return friendly configuration guide
  if (!isGeminiConfigured()) {
    const missingKeyMessage =
      "**Gemini API Key Required**\n\nThe AI assistant requires a valid Gemini API key to run tool-calling models.\n\nPlease add your API key to `.env.local`:\n```env\nGEMINI_API_KEY=your_actual_key_here\n```\nNon-AI dashboards and calculations remain fully operational.";

    emit({ type: "status", message: "Gemini API key missing" });
    emit({ type: "text_delta", delta: missingKeyMessage });

    const savedMsg = addMessageToConversation(context.conversationId, context.userId, {
      role: "assistant",
      content: missingKeyMessage,
    });

    emit({
      type: "done",
      conversationId: context.conversationId,
      messageId: savedMsg?.id || "msg_err",
      totalToolCalls: 0,
    });

    return {
      response: missingKeyMessage,
      toolCallsExecuted: [],
      conversationId: context.conversationId,
      messageId: savedMsg?.id || "msg_err",
      iterationsCount: 0,
    };
  }

  // 2. Save user message to persistent conversation store
  addMessageToConversation(context.conversationId, context.userId, {
    role: "user",
    content: userMessage,
  });

  // 3. Build bounded conversation context
  const history = getBoundedConversationContext(context.conversationId, context.userId);

  // Format history for Gemini API contents
  const geminiContents: GeminiContent[] = [];
  for (const msg of history) {
    if (msg.role === "user") {
      geminiContents.push({ role: "user", parts: [{ text: msg.content }] });
    } else if (msg.role === "assistant") {
      const parts: GeminiPart[] = [];
      if (msg.content) parts.push({ text: msg.content });
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        for (const tc of msg.toolCalls) {
          parts.push({ functionCall: { name: tc.name, args: tc.args } });
        }
      }
      if (parts.length > 0) {
        geminiContents.push({ role: "model", parts });
      }
    }
  }

  // Contextual grounding hint injected into current turn
  const contextNote = `[SYSTEM CONTEXT: User Location lat=${context.lat ?? 28.6468}, lon=${context.lon ?? 77.3160}, activeScenario=${context.scenario || "delhi-anand-vihar"}]`;
  geminiContents.push({
    role: "user",
    parts: [{ text: `${contextNote}\nUser Query: ${userMessage}` }],
  });

  // 4. Bounded Agent Execution Loop
  let iteration = 0;
  const toolCallsExecuted: { tool: string; args: Record<string, unknown>; result: unknown }[] = [];
  const executedSignatures = new Set<string>(); // Infinite loop / duplicate call prevention
  let finalResponseText = "";

  emit({ type: "status", message: "Analyzing query and deciding tool actions..." });

  while (iteration < AGENT_CONFIG.maxIterations) {
    iteration++;

    // Step A: Call Gemini model with tool definitions
    const callParams: GeminiCallParams = {
      contents: geminiContents,
      enableTools: true,
      timeoutMs: AGENT_CONFIG.overallDeadlineMs,
    };

    const modelOutput = await callGemini(callParams);

    // Step B: Check if model decided to call tools
    if (modelOutput.functionCalls && modelOutput.functionCalls.length > 0) {
      // Model selected tool(s)
      const functionResponseParts: GeminiPart[] = [];

      for (const call of modelOutput.functionCalls) {
        const signature = `${call.name}:${JSON.stringify(call.args)}`;

        // Loop detection: Prevent repeated identical tool calls
        if (executedSignatures.has(signature)) {
          logger.warn(`[AgentLoop] Duplicate tool call detected: ${signature}. Breaking potential infinite loop.`);
          functionResponseParts.push({
            functionResponse: {
              name: call.name,
              response: {
                warning: "DUPLICATE_CALL_SKIPPED: Identical tool call was already evaluated in this turn.",
              },
            },
          });
          continue;
        }

        executedSignatures.add(signature);

        emit({
          type: "status",
          message: `Executing ${call.name}...`,
        });

        emit({
          type: "tool_start",
          tool: call.name,
          args: call.args,
        });

        // Step C: Validate arguments & execute tool safely
        const execResult = await executeToolCall(call.name, call.id || "call_id", call.args, context);

        toolCallsExecuted.push({
          tool: call.name,
          args: call.args,
          result: execResult.result,
        });

        const resultSummary = execResult.isError
          ? "Execution failed"
          : `Success (${execResult.executionTimeMs}ms)`;

        emit({
          type: "tool_end",
          tool: call.name,
          resultSummary,
        });

        // Step D: Feed tool result back to Gemini contents
        functionResponseParts.push({
          functionResponse: {
            name: call.name,
            response: {
              output: execResult.result,
            },
          },
        });
      }

      // Append model's functionCall turn and user's functionResponse turn
      geminiContents.push({
        role: "model",
        parts:
          modelOutput.rawParts ||
          modelOutput.functionCalls.map((fc) => ({
            functionCall: { name: fc.name, args: fc.args },
          })),
      });

      geminiContents.push({
        role: "user",
        parts: functionResponseParts,
      });

      // Continue loop so model can observe tool results and decide next step
      continue;
    }

    // Step E: Model generated final grounded response
    finalResponseText = modelOutput.text;
    break;
  }

  // If loop exhausted maximum iterations without producing text, synthesize safe wrap-up
  if (!finalResponseText) {
    finalResponseText =
      "I have gathered the environmental observations from our monitoring network above. In summary, please follow the precautionary guidelines outlined by our statutory CPCB advisories.";
  }

  // 5. Stream final response text
  emit({ type: "text_delta", delta: finalResponseText });

  // 6. Save assistant response to conversation history
  const savedAssistantMsg = addMessageToConversation(context.conversationId, context.userId, {
    role: "assistant",
    content: finalResponseText,
    toolCalls: toolCallsExecuted.map((tc, idx) => ({
      id: `tc_${idx}`,
      name: tc.tool,
      args: tc.args,
    })),
  });

  emit({
    type: "done",
    conversationId: context.conversationId,
    messageId: savedAssistantMsg?.id || "msg_done",
    totalToolCalls: toolCallsExecuted.length,
  });

  return {
    response: finalResponseText,
    toolCallsExecuted,
    conversationId: context.conversationId,
    messageId: savedAssistantMsg?.id || "msg_done",
    iterationsCount: iteration,
  };
}
