import "server-only";
import { z } from "zod";

const emptyStringToUndefined = z.preprocess(
  (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
  z.string().optional()
);

const emptyStringToUrl = z.preprocess(
  (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
  z.string().url().optional()
);

const envSchema = z.object({
  GEMINI_API_KEY: z.string().optional().default(""),
  GOOGLE_GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_MODEL: z.string().default("gemini-3.8-flash"),
  GEMINI_FALLBACK_MODEL: z.string().default("gemini-2.5-flash"),
  OPENAQ_API_KEY: emptyStringToUndefined,
  UPSTASH_REDIS_REST_URL: emptyStringToUrl,
  UPSTASH_REDIS_REST_TOKEN: emptyStringToUndefined,
  ROUTING_API_KEY: emptyStringToUndefined,
  ROUTING_PROVIDER: emptyStringToUndefined,
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const env = envSchema.parse({
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY,
  GOOGLE_GEMINI_API_KEY: process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-3.8-flash",
  GEMINI_FALLBACK_MODEL: process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash",
  OPENAQ_API_KEY: process.env.OPENAQ_API_KEY,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  ROUTING_API_KEY: process.env.ROUTING_API_KEY,
  ROUTING_PROVIDER: process.env.ROUTING_PROVIDER,
  NODE_ENV: process.env.NODE_ENV,
});
