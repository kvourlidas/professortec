/// <reference lib="deno.ns" />

import { updateStudentByNameService } from "../../services/studentsService.ts";
import { ValidationError } from "../../errors.ts";
import type { AssistantTool } from "../types.ts";

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export const updateStudentTool: AssistantTool = {
  definition: {
    name: "update_student",
    description:
      "Ενημερώνει στοιχεία υπάρχοντος μαθητή. Χρησιμοποίησε student_id αν είναι ήδη γνωστό " +
      "(π.χ. από προηγούμενη αναζήτηση σε αυτή τη συνομιλία), αλλιώς δώσε student_name για " +
      "αναζήτηση με βάση το όνομα. Δώσε ΜΟΝΟ τα πεδία που πρέπει να αλλάξουν — όσα δεν δίνονται " +
      "παραμένουν όπως είναι.",
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
        level_name: {
          type: "string",
          description: "Το όνομα του επιπέδου (level) στο οποίο θα μετακινηθεί ο μαθητής, αν αλλάζει.",
        },
        full_name: { type: "string", description: "Νέο ονοματεπώνυμο, αν αλλάζει." },
        date_of_birth: { type: "string", description: "Νέα ημερομηνία γέννησης (YYYY-MM-DD), αν αλλάζει." },
        phone: { type: "string", description: "Νέο τηλέφωνο, αν αλλάζει." },
        email: { type: "string", description: "Νέο email, αν αλλάζει." },
        special_notes: { type: "string", description: "Νέες σημειώσεις, αν αλλάζουν." },
        father_name: { type: "string", description: "Νέο ονοματεπώνυμο πατέρα, αν αλλάζει." },
        father_date_of_birth: { type: "string", description: "Νέα ημερομηνία γέννησης πατέρα (YYYY-MM-DD), αν αλλάζει." },
        father_phone: { type: "string", description: "Νέο τηλέφωνο πατέρα, αν αλλάζει." },
        father_email: { type: "string", description: "Νέο email πατέρα, αν αλλάζει." },
        mother_name: { type: "string", description: "Νέο ονοματεπώνυμο μητέρας, αν αλλάζει." },
        mother_date_of_birth: { type: "string", description: "Νέα ημερομηνία γέννησης μητέρας (YYYY-MM-DD), αν αλλάζει." },
        mother_phone: { type: "string", description: "Νέο τηλέφωνο μητέρας, αν αλλάζει." },
        mother_email: { type: "string", description: "Νέο email μητέρας, αν αλλάζει." },
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

    const level_name = str(input?.level_name);

    const result = await updateStudentByNameService(supabase, schoolId, {
      student_id,
      student_name,
      level_name,
      updates: {
        full_name: str(input?.full_name),
        date_of_birth: str(input?.date_of_birth),
        phone: str(input?.phone),
        email: str(input?.email),
        special_notes: str(input?.special_notes),
        father_name: str(input?.father_name),
        father_date_of_birth: str(input?.father_date_of_birth),
        father_phone: str(input?.father_phone),
        father_email: str(input?.father_email),
        mother_name: str(input?.mother_name),
        mother_date_of_birth: str(input?.mother_date_of_birth),
        mother_phone: str(input?.mother_phone),
        mother_email: str(input?.mother_email),
      },
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

    if (result.status === "level_not_found") {
      return {
        content: {
          success: false,
          error: "level_not_found",
          message: "Δεν βρέθηκε επίπεδο (level) με αυτό το όνομα. Ρώτησε τον χρήστη να διορθώσει το όνομα ή να επιβεβαιώσει ότι υπάρχει.",
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
      action: { type: "student_updated", item: result.item },
    };
  },
};
