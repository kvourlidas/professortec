/// <reference lib="deno.ns" />

import { resolveSubjectByNameOrId } from "../../services/subjectsService.ts";
import type { AssistantTool } from "../types.ts";

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

// This tool does not assign tutors itself. It only resolves the subject —
// the frontend then shows a tutor picker and syncs subject_tutors directly,
// so the user selects instead of typing.
export const assignSubjectTutorsTool: AssistantTool = {
  definition: {
    name: "assign_subject_tutors",
    description:
      "Ανοίγει την επιλογή καθηγητών (tutors) για ένα μάθημα (subject). Χρησιμοποίησε subject_id αν " +
      "είναι ήδη γνωστό (π.χ. από προηγούμενη αναζήτηση σε αυτή τη συνομιλία), αλλιώς δώσε " +
      "subject_name για αναζήτηση με βάση το όνομα — και level_name αν ο χρήστης ανέφερε επίπεδο, " +
      "ώστε να διαλευκανθεί αυτόματα ποιο μάθημα εννοεί όταν υπάρχουν παραπάνω από ένα με το ίδιο " +
      "όνομα σε διαφορετικά επίπεδα. ΜΗΝ ρωτήσεις ποιοι καθηγητές — αυτούς τους επιλέγει ο χρήστης " +
      "μέσα από την εφαρμογή αφού καλέσεις αυτό το tool.",
    input_schema: {
      type: "object",
      properties: {
        subject_id: { type: "string", description: "Το ID του μαθήματος, αν είναι ήδη γνωστό." },
        subject_name: { type: "string", description: "Το όνομα (ή μέρος του ονόματος) του μαθήματος προς αναζήτηση." },
        level_name: { type: "string", description: "Το επίπεδο του μαθήματος, αν το ανέφερε ο χρήστης." },
      },
      required: [],
      additionalProperties: false,
    },
  },

  async execute(input, { supabase, schoolId }) {
    const result = await resolveSubjectByNameOrId(supabase, schoolId, {
      subject_id: str(input?.subject_id),
      subject_name: str(input?.subject_name),
      level_name: str(input?.level_name),
    });

    if (result.status === "not_found") {
      return {
        content: {
          success: false,
          error: "not_found",
          message: "Δεν βρέθηκε μάθημα με αυτό το όνομα. Ρώτησε τον χρήστη να διορθώσει το όνομα.",
        },
      };
    }

    if (result.status === "ambiguous") {
      return {
        content: {
          success: true,
          awaiting_selection: true,
          message: "Ο χρήστης θα επιλέξει τώρα ποιο μάθημα εννοεί μέσα από την εφαρμογή.",
        },
        action: {
          type: "subject_needs_disambiguation",
          item: {
            subject_name: str(input?.subject_name),
            candidates: result.candidates,
            next: { kind: "assign_tutors" },
          },
        },
      };
    }

    return {
      content: {
        success: true,
        awaiting_selection: true,
        message: "Ο χρήστης θα επιλέξει τώρα καθηγητές μέσα από την εφαρμογή.",
      },
      action: {
        type: "subject_needs_tutor_selection",
        item: { subject_id: result.id, subject_name: result.name },
      },
    };
  },
};
