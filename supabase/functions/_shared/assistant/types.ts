/// <reference lib="deno.ns" />

import type Anthropic from "npm:@anthropic-ai/sdk";

export type ToolContext = {
  supabase: any;
  schoolId: string;
};

export type ToolExecutionResult = {
  // Included as the tool_result content Claude sees.
  content: unknown;
  // Set when the tool performed a data-changing action worth surfacing
  // to the frontend as a structured "action" (e.g. to refresh a list).
  action?: { type: string; item: unknown };
};

export type AssistantTool = {
  definition: Anthropic.Tool;
  execute: (input: any, ctx: ToolContext) => Promise<ToolExecutionResult>;
};
