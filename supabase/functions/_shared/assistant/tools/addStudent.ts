/// <reference lib="deno.ns" />

import { validateCreateStudentBody } from "../../validators/studentsValidators.ts";
import type { AssistantTool } from "../types.ts";

// This tool does not create the student itself. It validates and captures
// every field except the level — the frontend then shows a level picker and
// calls student-create directly, so the user selects instead of typing.
export const addStudentTool: AssistantTool = {
  definition: {
    name: "add_student",
    description:
      "Ξεκινά τη δημιουργία νέου μαθητή στη σχολή. Απαιτείται τουλάχιστον το ονοματεπώνυμο, και είτε " +
      "email είτε τηλέφωνο. Τα στοιχεία γονέων και οι σημειώσεις είναι προαιρετικά. ΜΗΝ ρωτήσεις για " +
      "επίπεδο (level) — αυτό το επιλέγει ο χρήστης μέσα από την εφαρμογή αφού καλέσεις αυτό το tool.",
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

  async execute(input) {
    const validated = validateCreateStudentBody(input);

    return {
      content: {
        success: true,
        awaiting_selection: true,
        message: "Ο χρήστης θα επιλέξει τώρα επίπεδο μέσα από την εφαρμογή.",
      },
      action: { type: "student_needs_level_selection", item: validated },
    };
  },
};
