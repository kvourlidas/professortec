/// <reference lib="deno.ns" />

import { deleteStudentByNameService } from "../../services/studentsService.ts";
import { ValidationError } from "../../errors.ts";
import type { AssistantTool } from "../types.ts";

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export const deleteStudentTool: AssistantTool = {
  definition: {
    name: "delete_student",
    description:
      "Διαγράφει έναν μαθητή. Χρησιμοποίησε student_id αν είναι ήδη γνωστό " +
      "(π.χ. από προηγούμενη αναζήτηση σε αυτή τη συνομιλία), αλλιώς δώσε student_name για " +
      "αναζήτηση με βάση το όνομα. Η ενέργεια αυτή είναι μη αναστρέψιμη από τον χρήστη μέσα από τη " +
      "συνομιλία — ζήτησε ρητή επιβεβαίωση από τον χρήστη πριν καλέσεις αυτό το tool.",
    input_schema: {
      type: "object",
      properties: {
        student_id: {
          type: "string",
          description: "Το ID του μαθητή, αν είναι ήδη γνωστό.",
        },
        student_name: {
          type: "string",
          description: "Το όνομα (ή μέρος του ονόματος) του μαθητή προς αναζήτηση.",
        },
      },
      required: [],
      additionalProperties: false,
    },
  },

  async execute(input, { supabase, schoolId }) {
    const student_id = str(input?.student_id);
    const student_name = str(input?.student_name);

    if (!student_id && !student_name) {
      throw new ValidationError("Missing student_id or student_name");
    }

    const result = await deleteStudentByNameService(supabase, schoolId, {
      student_id,
      student_name,
    });

    if (result.status === "not_found") {
      return {
        content: {
          success: false,
          error: "not_found",
          message: "Δεν βρέθηκε μαθητής με αυτό το όνομα. Ρώτησε τον χρήστη να διορθώσει το όνομα.",
        },
      };
    }

    if (result.status === "ambiguous") {
      return {
        content: {
          success: false,
          error: "ambiguous",
          candidates: result.candidates,
          message:
            "Βρέθηκαν περισσότεροι από ένας μαθητές με αυτό το όνομα. Παράθεσε τις επιλογές στον " +
            "χρήστη (όνομα + τηλέφωνο/email) και ζήτησέ του να διευκρινίσει ποιον εννοεί.",
        },
      };
    }

    return {
      content: { success: true, student_id: result.student_id, full_name: result.full_name },
      action: { type: "student_deleted", item: { id: result.student_id, full_name: result.full_name } },
    };
  },
};
