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

export interface AgentTool<TArgs = Record<string, unknown>> {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
  argumentSchema: z.ZodType<TArgs>;
  execute: (args: TArgs, context: AgentContext) => Promise<unknown>;
}
