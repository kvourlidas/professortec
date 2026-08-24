/// <reference lib="deno.ns" />

import { ValidationError } from "../../errors.ts";
import type { AssistantTool } from "../types.ts";

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

// This tool does not create the subject itself. It only captures the name —
// the frontend then shows a level picker and calls subjects-create directly
// (level_id is required by the table), so the user selects instead of typing.
export const addSubjectTool: AssistantTool = {
  definition: {
    name: "add_subject",
    description:
      "Ξεκινά τη δημιουργία νέου μαθήματος (subject) στη σχολή, π.χ. \"Άλγεβρα\", \"Έκθεση\". Χρειάζεται " +
      "μόνο το όνομα — ΜΗΝ ρωτήσεις για επίπεδο (level), αυτό το επιλέγει ο χρήστης μέσα από την " +
      "εφαρμογή αφού καλέσεις αυτό το tool.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Το όνομα του μαθήματος" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },

  async execute(input) {
    const name = str(input?.name);
    if (!name) {
      throw new ValidationError("Missing name");
    }

    return {
      content: {
        success: true,
        awaiting_selection: true,
        message: "Ο χρήστης θα επιλέξει τώρα επίπεδο μέσα από την εφαρμογή.",
      },
      action: { type: "subject_needs_level_selection", item: { name } },
    };
  },
};
