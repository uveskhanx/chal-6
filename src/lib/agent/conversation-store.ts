import "server-only";
import crypto from "crypto";
import { Conversation, AgentMessage } from "./types";
import { AGENT_CONFIG } from "./config";
import { logger } from "@/lib/logger";

// In-Memory Thread-Safe Conversation Store with User Isolation
const conversationsMap = new Map<string, Conversation>();

export function createConversation(userId: string, initialTitle: string = "New Inquiry"): Conversation {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const conversation: Conversation = {
    id,
    userId,
    title: initialTitle,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };

  conversationsMap.set(id, conversation);
  return conversation;
}

export function getConversation(conversationId: string, userId: string): Conversation | null {
  const conversation = conversationsMap.get(conversationId);
  if (!conversation) return null;

  // Strict User Ownership Enforcement
  if (conversation.userId !== userId) {
    logger.warn(`[Security Alert] User '${userId}' attempted to access conversation owned by '${conversation.userId}'.`);
    return null;
  }

  return conversation;
}

export function listUserConversations(userId: string): {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}[] {
  const userConvs: Conversation[] = [];

  for (const conv of conversationsMap.values()) {
    if (conv.userId === userId) {
      userConvs.push(conv);
    }
  }

  return userConvs
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map((c) => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messageCount: c.messages.length,
    }));
}

export function addMessageToConversation(
  conversationId: string,
  userId: string,
  message: Omit<AgentMessage, "id" | "timestamp">
): AgentMessage | null {
  const conversation = getConversation(conversationId, userId);
  if (!conversation) return null;

  const now = new Date().toISOString();
  const newMessage: AgentMessage = {
    ...message,
    id: crypto.randomUUID(),
    timestamp: now,
  };

  conversation.messages.push(newMessage);
  conversation.updatedAt = now;

  // Auto-generate dynamic title from first user query
  if (conversation.messages.length === 1 && message.role === "user") {
    const cleanTitle = message.content.slice(0, 42).trim() + (message.content.length > 42 ? "..." : "");
    conversation.title = cleanTitle;
  }

  return newMessage;
}

export function deleteConversation(conversationId: string, userId: string): boolean {
  const conversation = getConversation(conversationId, userId);
  if (!conversation) return false;

  conversationsMap.delete(conversationId);
  return true;
}

export function clearConversationMessages(conversationId: string, userId: string): boolean {
  const conversation = getConversation(conversationId, userId);
  if (!conversation) return false;

  conversation.messages = [];
  conversation.updatedAt = new Date().toISOString();
  return true;
}

/**
 * Bounds the conversation history for token economy and context window protection.
 */
export function getBoundedConversationContext(
  conversationId: string,
  userId: string,
  maxMessages: number = AGENT_CONFIG.maxContextMessages
): AgentMessage[] {
  const conversation = getConversation(conversationId, userId);
  if (!conversation) return [];

  if (conversation.messages.length <= maxMessages) {
    return conversation.messages;
  }

  // Preserve the initial user message + the latest recent messages
  const recent = conversation.messages.slice(-maxMessages);
  return recent;
}
