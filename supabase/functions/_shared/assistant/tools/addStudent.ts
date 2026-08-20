/// <reference lib="deno.ns" />

import { validateCreateStudentBody } from "../../validators/studentsValidators.ts";
import { createStudentService } from "../../services/studentsService.ts";
import type { AssistantTool } from "../types.ts";

export const addStudentTool: AssistantTool = {
  definition: {
    name: "add_student",
    description:
      "Δημιουργεί νέο μαθητή στη σχολή. Απαιτείται τουλάχιστον το ονοματεπώνυμο, και είτε email είτε τηλέφωνο.",
    input_schema: {
      type: "object",
      properties: {
        full_name: { type: "string", description: "Ονοματεπώνυμο μαθητή" },
        date_of_birth: {
          type: "string",
          description: "Ημερομηνία γέννησης σε μορφή YYYY-MM-DD, αν δόθηκε",
        },
        phone: { type: "string", description: "Τηλέφωνο επικοινωνίας" },
        email: { type: "string", description: "Email επικοινωνίας" },
      },
      required: ["full_name"],
      additionalProperties: false,
    },
  },

  async execute(input, { supabase, schoolId }) {
    const validated = validateCreateStudentBody(input);
    const item = await createStudentService(supabase, schoolId, validated);
    return {
      content: { success: true, item },
      action: { type: "student_created", item },
    };
  },
};
