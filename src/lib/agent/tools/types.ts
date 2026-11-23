import { z } from "zod";
import { AgentContext } from "../types";

export interface ToolParameterSchema {
  type: "object";
  properties: Record<
    string,
    {
      type: string;
      description: string;
      enum?: string[];
    }
  >;
  required?: string[];
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
  argumentSchema: z.ZodSchema;
  execute: (args: Record<string, unknown>, context: AgentContext) => Promise<unknown>;
}
