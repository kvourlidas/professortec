/// <reference lib="deno.ns" />

import type Anthropic from "npm:@anthropic-ai/sdk";
import type { AssistantTool } from "../types.ts";
import { addStudentTool } from "./addStudent.ts";
import { updateStudentTool } from "./updateStudent.ts";
import { deleteStudentTool } from "./deleteStudent.ts";
import { addClassTool } from "./addClass.ts";
import { updateClassTool } from "./updateClass.ts";
import { deleteClassTool } from "./deleteClass.ts";
import { addTutorTool } from "./addTutor.ts";
import { addSpecialtyTool } from "./addSpecialty.ts";
import { deleteSpecialtyTool } from "./deleteSpecialty.ts";
import { assignTutorSpecialtyTool } from "./assignTutorSpecialty.ts";
import { addSubjectTool } from "./addSubject.ts";
import { assignSubjectTutorsTool } from "./assignSubjectTutors.ts";
import { updateSubjectTool } from "./updateSubject.ts";
import { addLevelTool } from "./addLevel.ts";

// Register every new tool here — one line each.
export const ASSISTANT_TOOLS: AssistantTool[] = [
  addStudentTool,
  updateStudentTool,
  deleteStudentTool,
  addClassTool,
  updateClassTool,
  deleteClassTool,
  addTutorTool,
  addSpecialtyTool,
  deleteSpecialtyTool,
  assignTutorSpecialtyTool,
  addSubjectTool,
  assignSubjectTutorsTool,
  updateSubjectTool,
  addLevelTool,
];

export const TOOL_DEFINITIONS: Anthropic.Tool[] = ASSISTANT_TOOLS.map((t) => t.definition);

const TOOL_BY_NAME = new Map(ASSISTANT_TOOLS.map((t) => [t.definition.name, t]));

export function getTool(name: string): AssistantTool | undefined {
  return TOOL_BY_NAME.get(name);
}
