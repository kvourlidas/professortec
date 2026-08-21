/// <reference lib="deno.ns" />

import { validateCreateStudentBody } from "../../validators/studentsValidators.ts";
import { createStudentWithLevelNameService } from "../../services/studentsService.ts";
import type { AssistantTool } from "../types.ts";

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export const addStudentTool: AssistantTool = {
  definition: {
    name: "add_student",
    description:
      "Δημιουργεί νέο μαθητή στη σχολή. Απαιτείται τουλάχιστον το ονοματεπώνυμο, και είτε email " +
      "είτε τηλέφωνο. Όλα τα υπόλοιπα πεδία (επίπεδο, στοιχεία γονέων, σημειώσεις) είναι προαιρετικά.",
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
        special_notes: { type: "string", description: "Σημειώσεις για τον μαθητή" },
        level_name: { type: "string", description: "Το όνομα του επιπέδου (level) στο οποίο ανήκει ο μαθητής" },
        father_name: { type: "string", description: "Ονοματεπώνυμο πατέρα" },
        father_date_of_birth: { type: "string", description: "Ημερομηνία γέννησης πατέρα (YYYY-MM-DD)" },
        father_phone: { type: "string", description: "Τηλέφωνο πατέρα" },
        father_email: { type: "string", description: "Email πατέρα" },
        mother_name: { type: "string", description: "Ονοματεπώνυμο μητέρας" },
        mother_date_of_birth: { type: "string", description: "Ημερομηνία γέννησης μητέρας (YYYY-MM-DD)" },
        mother_phone: { type: "string", description: "Τηλέφωνο μητέρας" },
        mother_email: { type: "string", description: "Email μητέρας" },
      },
      required: ["full_name"],
      additionalProperties: false,
    },
  },

  async execute(input, { supabase, schoolId }) {
    const validated = validateCreateStudentBody(input);
    const level_name = str(input?.level_name);

    const result = await createStudentWithLevelNameService(supabase, schoolId, {
      level_name,
      student: validated,
    });

    if (result.status === "level_not_found") {
      return {
        content: {
          success: false,
          error: "level_not_found",
          message: "Δεν βρέθηκε επίπεδο (level) με αυτό το όνομα. Ρώτησε τον χρήστη να διορθώσει το όνομα ή να το αφήσει κενό.",
        },
      };
    }

    if (result.status === "level_ambiguous") {
      return {
        content: {
          success: false,
          error: "level_ambiguous",
          candidates: result.candidates,
          message:
            "Βρέθηκαν περισσότερα από ένα επίπεδα με αυτό το όνομα. Παράθεσε τις επιλογές στον " +
            "χρήστη και ζήτησέ του να διευκρινίσει ποιο εννοεί.",
        },
      };
    }

    return {
      content: { success: true, item: result.item },
      action: { type: "student_created", item: result.item },
    };
  },
};
