/// <reference lib="deno.ns" />

import type Anthropic from "npm:@anthropic-ai/sdk";
import type { AssistantTool } from "../types.ts";
import { addStudentTool } from "./addStudent.ts";

// Register every new tool here — one line each.
export const ASSISTANT_TOOLS: AssistantTool[] = [
  addStudentTool,
];

export const TOOL_DEFINITIONS: Anthropic.Tool[] = ASSISTANT_TOOLS.map((t) => t.definition);

const TOOL_BY_NAME = new Map(ASSISTANT_TOOLS.map((t) => [t.definition.name, t]));

export function getTool(name: string): AssistantTool | undefined {
  return TOOL_BY_NAME.get(name);
}
