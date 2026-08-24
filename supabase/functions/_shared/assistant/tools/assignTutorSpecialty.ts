/// <reference lib="deno.ns" />

import { resolveTutorByNameOrId } from "../../services/tutorsService.ts";
import type { AssistantTool } from "../types.ts";

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

// This tool does not assign specialties itself. It only resolves the tutor —
// the frontend then shows a specialty picker and syncs tutor_specialties
// directly, so the user selects instead of typing.
export const assignTutorSpecialtyTool: AssistantTool = {
  definition: {
    name: "assign_tutor_specialty",
    description:
      "Ανοίγει την επιλογή ειδικοτήτων (specialties) για έναν καθηγητή. Χρησιμοποίησε tutor_id αν " +
      "είναι ήδη γνωστό (π.χ. από προηγούμενη αναζήτηση σε αυτή τη συνομιλία), αλλιώς δώσε " +
      "tutor_name για αναζήτηση με βάση το όνομα. ΜΗΝ ρωτήσεις ποιες ειδικότητες — αυτές τις " +
      "επιλέγει ο χρήστης μέσα από την εφαρμογή αφού καλέσεις αυτό το tool.",
    input_schema: {
      type: "object",
      properties: {
        tutor_id: { type: "string", description: "Το ID του καθηγητή, αν είναι ήδη γνωστό." },
        tutor_name: { type: "string", description: "Το όνομα (ή μέρος του ονόματος) του καθηγητή προς αναζήτηση." },
      },
      required: [],
      additionalProperties: false,
    },
  },

  async execute(input, { supabase, schoolId }) {
    const result = await resolveTutorByNameOrId(supabase, schoolId, {
      tutor_id: str(input?.tutor_id),
      tutor_name: str(input?.tutor_name),
    });

    if (result.status === "not_found") {
      return {
        content: {
          success: false,
          error: "not_found",
          message: "Δεν βρέθηκε καθηγητής με αυτό το όνομα. Ρώτησε τον χρήστη να διορθώσει το όνομα.",
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
            "Βρέθηκαν περισσότεροι από ένας καθηγητές με αυτό το όνομα. Παράθεσε τις επιλογές στον " +
            "χρήστη (όνομα + τηλέφωνο/email) και ζήτησέ του να διευκρινίσει ποιον εννοεί.",
        },
      };
    }

    return {
      content: {
        success: true,
        awaiting_selection: true,
        message: "Ο χρήστης θα επιλέξει τώρα ειδικότητες μέσα από την εφαρμογή.",
      },
      action: {
        type: "tutor_needs_specialty_selection",
        item: { tutor_id: result.id, tutor_name: result.full_name },
      },
    };
  },
};
