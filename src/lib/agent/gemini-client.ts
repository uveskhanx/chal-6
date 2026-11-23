import "server-only";
import { GoogleGenAI } from "@google/genai";
import { AGENT_CONFIG, isGeminiConfigured } from "./config";
import { SAANSAI_SYSTEM_INSTRUCTION } from "./system-instructions";
import { getGeminiFunctionDeclarations } from "./tools/registry";
import { logger } from "@/lib/logger";

export class GeminiConfigurationError extends Error {
  constructor(message = "Gemini API key is not configured. Please set GEMINI_API_KEY in your environment.") {
    super(message);
    this.name = "GeminiConfigurationError";
  }
}

let genAIInstance: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
  if (!isGeminiConfigured()) {
    throw new GeminiConfigurationError();
  }

  if (!genAIInstance) {
    genAIInstance = new GoogleGenAI({
      apiKey: AGENT_CONFIG.apiKey,
      apiVersion: "v1beta",
    });
  }

  return genAIInstance;
}

function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("resource_exhausted") ||
    msg.includes("503") ||
    msg.includes("unavailable") ||
    msg.includes("fetch failed") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown>; id?: string };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

export interface GeminiContent {
  role: "user" | "model" | "system";
  parts: GeminiPart[];
}

export interface GeminiCallParams {
  contents: GeminiContent[];
  model?: string;
  enableTools?: boolean;
  timeoutMs?: number;
}

export interface GeminiCallOutput {
  text: string;
  functionCalls?: { id?: string; name: string; args: Record<string, unknown> }[];
  modelUsed: string;
  finishReason?: string;
  rawParts?: GeminiPart[];
}

interface RawCandidate {
  content?: {
    parts?: Array<{
      text?: string;
      functionCall?: { id?: string; name: string; args?: Record<string, unknown> };
    }>;
  };
  finishReason?: string;
}

interface RawGeminiResponse {
  candidates?: RawCandidate[];
  functionCalls?: Array<{ id?: string; name: string; args?: Record<string, unknown> }>;
}

/**
 * Executes a call to the official Google Gemini API with timeout handling and model fallback.
 */
export async function callGemini(params: GeminiCallParams): Promise<GeminiCallOutput> {
  const ai = getGenAI();
  const primaryModel = params.model || AGENT_CONFIG.primaryModel;
  const timeoutMs = params.timeoutMs || AGENT_CONFIG.overallDeadlineMs;

  const tools = params.enableTools !== false ? getGeminiFunctionDeclarations() : undefined;

  const generateWithTimeout = async (modelName: string): Promise<unknown> => {
    let timeoutId: NodeJS.Timeout | undefined;
    try {
      const abortController = new AbortController();
      timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

      const response = await ai.models.generateContent({
        model: modelName,
        contents: params.contents as unknown as string, // SDK accepts structured content array or string
        config: {
          systemInstruction: SAANSAI_SYSTEM_INSTRUCTION,
          temperature: AGENT_CONFIG.temperature,
          tools,
        },
      });

      return response;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  const generateWithRetry = async (modelName: string): Promise<unknown> => {
    const maxRetries = 2;
    let attempt = 0;
    while (attempt <= maxRetries) {
      try {
        return await generateWithTimeout(modelName);
      } catch (err) {
        attempt++;
        if (attempt <= maxRetries && isTransientError(err)) {
          const delayMs = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 200, 3000);
          logger.warn(`[GeminiClient] Transient error on ${modelName}. Retrying in ${Math.round(delayMs)}ms...`, undefined, err);
          await sleep(delayMs);
        } else {
          throw err;
        }
      }
    }
  };

  try {
    const response = await generateWithRetry(primaryModel);
    return parseGeminiResponse(response, primaryModel);
  } catch (primaryError: unknown) {
    const primaryMsg = primaryError instanceof Error ? primaryError.message : String(primaryError);
    // If rate limited or model not found, try fallback model if configured
    if (
      AGENT_CONFIG.fallbackModel &&
      AGENT_CONFIG.fallbackModel !== primaryModel &&
      !primaryMsg.includes("GEMINI_API_KEY")
    ) {
      logger.warn(
        `[GeminiClient] Primary model (${primaryModel}) failed. Attempting fallback model (${AGENT_CONFIG.fallbackModel}): ${primaryMsg}`
      );
      try {
        const fallbackResponse = await generateWithRetry(AGENT_CONFIG.fallbackModel);
        return parseGeminiResponse(fallbackResponse, AGENT_CONFIG.fallbackModel);
      } catch (fallbackError: unknown) {
        const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        logger.error(`[GeminiClient] Fallback model also failed: ${fallbackMsg}`, undefined, fallbackError);
        throw fallbackError;
      }
    }
    throw primaryError;
  }
}

function parseGeminiResponse(response: unknown, modelUsed: string): GeminiCallOutput {
  const res = response as RawGeminiResponse | undefined;
  const candidate = res?.candidates?.[0];
  const parts = candidate?.content?.parts || [];

  let text = "";
  const functionCalls: { id?: string; name: string; args: Record<string, unknown> }[] = [];

  for (const part of parts) {
    if (part.text) {
      text += part.text;
    }
    if (part.functionCall) {
      functionCalls.push({
        id: part.functionCall.id || `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: part.functionCall.name,
        args: part.functionCall.args || {},
      });
    }
  }

  // Also check top-level response.functionCalls if provided by SDK
  if (functionCalls.length === 0 && Array.isArray(res?.functionCalls)) {
    for (const fc of res.functionCalls) {
      functionCalls.push({
        id: fc.id || `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: fc.name,
        args: fc.args || {},
      });
    }
  }

  return {
    text: text.trim(),
    functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
    modelUsed,
    finishReason: candidate?.finishReason,
    rawParts: parts.length > 0 ? (parts as unknown as GeminiPart[]) : undefined,
  };
}
