/// <reference lib="deno.ns" />

import { updateSubjectByNameService } from "../../services/subjectsService.ts";
import type { AssistantTool } from "../types.ts";

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export const updateSubjectTool: AssistantTool = {
  definition: {
    name: "update_subject",
    description:
      "Ενημερώνει όνομα ή επίπεδο υπάρχοντος μαθήματος (subject). Χρησιμοποίησε subject_id αν είναι " +
      "ήδη γνωστό, αλλιώς subject_name για αναζήτηση με βάση το όνομα — και level_name αν ο χρήστης " +
      "ανέφερε επίπεδο, ώστε να διαλευκανθεί αυτόματα ποιο μάθημα εννοεί όταν υπάρχουν παραπάνω από " +
      "ένα με το ίδιο όνομα. Αν ο χρήστης θέλει να αλλάξει το επίπεδο του μαθήματος, βάλε " +
      "change_level: true — ΜΗΝ ρωτήσεις ή μαντέψεις ποιο επίπεδο, αυτό το επιλέγει ο χρήστης μέσα " +
      "από την εφαρμογή αφού καλέσεις το tool.",
    input_schema: {
      type: "object",
      properties: {
        subject_id: { type: "string", description: "Το ID του μαθήματος, αν είναι ήδη γνωστό." },
        subject_name: { type: "string", description: "Το όνομα (ή μέρος του ονόματος) του μαθήματος προς αναζήτηση." },
        level_name: { type: "string", description: "Το τρέχον επίπεδο του μαθήματος, αν το ανέφερε ο χρήστης (για διάκριση όταν υπάρχουν ομώνυμα)." },
        name: { type: "string", description: "Νέο όνομα του μαθήματος, αν αλλάζει." },
        change_level: {
          type: "boolean",
          description: "true αν ο χρήστης θέλει να αλλάξει το επίπεδο του μαθήματος (ανεξάρτητα από το αν είπε ποιο).",
        },
      },
      required: [],
      additionalProperties: false,
    },
  },

  async execute(input, { supabase, schoolId }) {
    const name = str(input?.name);
    const change_level = input?.change_level === true;

    const result = await updateSubjectByNameService(supabase, schoolId, {
      subject_id: str(input?.subject_id),
      subject_name: str(input?.subject_name),
      level_name: str(input?.level_name),
      change_level,
      name,
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
            next: { kind: "update", change_level, name },
          },
        },
      };
    }

    if (result.status === "needs_level_selection") {
      return {
        content: {
          success: true,
          awaiting_selection: true,
          message: "Ο χρήστης θα επιλέξει τώρα το νέο επίπεδο μέσα από την εφαρμογή.",
        },
        action: {
          type: "subject_update_needs_level_selection",
          item: { subject_id: result.subject_id, name: result.name },
        },
      };
    }

    return {
      content: { success: true, item: result.item },
      action: { type: "subject_updated", item: result.item },
    };
  },
};
