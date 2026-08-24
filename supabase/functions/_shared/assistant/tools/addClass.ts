/// <reference lib="deno.ns" />

import { ValidationError } from "../../errors.ts";
import type { AssistantTool } from "../types.ts";

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

// This tool does not create the class itself. It only captures the title —
// the frontend then takes over with a picker for level/subject and calls
// classes-create directly, so the user selects instead of typing.
export const addClassTool: AssistantTool = {
  definition: {
    name: "add_class",
    description:
      "Ξεκινά τη δημιουργία νέου τμήματος (class) στη σχολή. Χρειάζεται μόνο τον τίτλο του τμήματος — " +
      "ΜΗΝ ρωτήσεις για μάθημα ή επίπεδο, αυτά τα επιλέγει ο χρήστης μέσα από την εφαρμογή αφού καλέσεις " +
      "αυτό το tool.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Τίτλος του τμήματος" },
      },
      required: ["title"],
      additionalProperties: false,
    },
  },

  async execute(input) {
    const title = str(input?.title);
    if (!title) {
      throw new ValidationError("Missing title");
    }

    return {
      content: {
        success: true,
        awaiting_selection: true,
        message: "Ο χρήστης θα επιλέξει τώρα επίπεδο και μάθημα μέσα από την εφαρμογή.",
      },
      action: { type: "class_needs_level_selection", item: { title } },
    };
  },
};
