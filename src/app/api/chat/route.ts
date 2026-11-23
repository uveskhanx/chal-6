import { NextRequest } from "next/server";
import { ChatRequestSchema, AgentStreamEvent } from "@/lib/agent/types";
import { runAgentOrchestrator } from "@/lib/agent/orchestrator";
import { createConversation, getConversation } from "@/lib/agent/conversation-store";
import { getUserPreferences } from "@/lib/agent/user-store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parsed = ChatRequestSchema.safeParse(json);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          error: "INVALID_CHAT_REQUEST",
          details: parsed.error.format(),
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { message, userId, scenario, lat, lon } = parsed.data;

    // Resolve or create conversation
    let convId = parsed.data.conversationId;
    if (!convId || !getConversation(convId, userId)) {
      const newConv = createConversation(userId, message.slice(0, 35));
      convId = newConv.id;
    }

    const userPrefs = getUserPreferences(userId);

    // Create ReadableStream for real-time Server-Sent Events (SSE)
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const sendEvent = (event: AgentStreamEvent) => {
          try {
            const payload = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(payload));
          } catch (streamError) {
            // Client closed connection or stream terminated
            console.debug("[API /api/chat] Client disconnected or stream closed prematurely:", streamError);
          }
        };

        try {
          await runAgentOrchestrator({
            userMessage: message,
            context: {
              userId,
              conversationId: convId,
              scenario,
              lat,
              lon,
              userPreferences: userPrefs,
            },
            onEvent: sendEvent,
          });
        } catch (error: unknown) {
          console.error("[API /api/chat] Orchestrator exception:", error);
          const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred in the agent loop.";
          sendEvent({
            type: "error",
            error: errorMessage,
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-SaansAI-Conversation-Id": convId,
      },
    });
  } catch (error: unknown) {
    console.error("[API /api/chat] Failed to process request:", error);
    return new Response(
      JSON.stringify({
        error: "INTERNAL_SERVER_ERROR",
        message: "Failed to initialize agent conversation.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
