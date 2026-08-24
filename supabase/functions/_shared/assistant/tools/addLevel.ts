/// <reference lib="deno.ns" />

import { createLevelService } from "../../services/levelsService.ts";
import { ValidationError } from "../../errors.ts";
import type { AssistantTool } from "../types.ts";

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export const addLevelTool: AssistantTool = {
  definition: {
    name: "add_level",
    description:
      "Δημιουργεί νέο επίπεδο (level) στη σχολή, π.χ. \"Α Γυμνασίου\", \"Β Λυκείου\". Χρειάζεται " +
      "μόνο το όνομα.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Το όνομα του επιπέδου" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },

  async execute(input, { supabase, schoolId }) {
    const name = str(input?.name);
    if (!name) {
      throw new ValidationError("Missing name");
    }

    const item = await createLevelService(supabase, schoolId, { name });

    return {
      content: { success: true, item },
      action: { type: "level_created", item },
    };
  },
};
