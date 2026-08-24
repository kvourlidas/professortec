/// <reference lib="deno.ns" />

import { createSpecialtyService } from "../../services/specialtiesService.ts";
import { ValidationError } from "../../errors.ts";
import type { AssistantTool } from "../types.ts";

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export const addSpecialtyTool: AssistantTool = {
  definition: {
    name: "add_specialty",
    description:
      "Δημιουργεί νέα ειδικότητα (specialty) καθηγητή στη σχολή, π.χ. \"Μαθηματικά\", \"IB\", " +
      "\"Φυσική\". Χρειάζεται μόνο το όνομα.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Το όνομα της ειδικότητας" },
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

    const result = await createSpecialtyService(supabase, schoolId, name);

    if (result.status === "duplicate") {
      return {
        content: {
          success: false,
          error: "duplicate",
          message: "Η ειδικότητα υπάρχει ήδη.",
        },
      };
    }

    return {
      content: { success: true, item: result.item },
      action: { type: "specialty_created", item: result.item },
    };
  },
};
