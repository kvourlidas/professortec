/// <reference lib="deno.ns" />

import { updateClassByTitleService } from "../../services/classesService.ts";
import type { AssistantTool } from "../types.ts";

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export const updateClassTool: AssistantTool = {
  definition: {
    name: "update_class",
    description:
      "Ενημερώνει τίτλο ή μάθημα υπάρχοντος τμήματος (class). Χρησιμοποίησε class_id αν είναι ήδη " +
      "γνωστό (π.χ. από προηγούμενη αναζήτηση σε αυτή τη συνομιλία), αλλιώς δώσε class_title για " +
      "αναζήτηση με βάση τον τίτλο. Αν ο χρήστης θέλει να αλλάξει το μάθημα του τμήματος, βάλε " +
      "change_subject: true — ΜΗΝ ρωτήσεις ή μαντέψεις ποιο επίπεδο/μάθημα, αυτό το επιλέγει ο " +
      "χρήστης μέσα από την εφαρμογή αφού καλέσεις το tool.",
    input_schema: {
      type: "object",
      properties: {
        class_id: { type: "string", description: "Το ID του τμήματος, αν είναι ήδη γνωστό." },
        class_title: { type: "string", description: "Ο τίτλος (ή μέρος του) του τμήματος προς αναζήτηση." },
        title: { type: "string", description: "Νέος τίτλος του τμήματος, αν αλλάζει." },
        change_subject: {
          type: "boolean",
          description: "true αν ο χρήστης θέλει να αλλάξει το μάθημα του τμήματος (ανεξάρτητα από το αν είπε ποιο).",
        },
      },
      required: [],
      additionalProperties: false,
    },
  },

  async execute(input, { supabase, schoolId }) {
    const result = await updateClassByTitleService(supabase, schoolId, {
      class_id: str(input?.class_id),
      class_title: str(input?.class_title),
      title: str(input?.title),
      change_subject: input?.change_subject === true,
    });

    if (result.status === "not_found") {
      return {
        content: {
          success: false,
          error: "not_found",
          message: "Δεν βρέθηκε τμήμα με αυτόν τον τίτλο. Ρώτησε τον χρήστη να διορθώσει τον τίτλο.",
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
            "Βρέθηκαν περισσότερα από ένα τμήματα με αυτόν τον τίτλο. Παράθεσε τις επιλογές στον " +
            "χρήστη και ζήτησέ του να διευκρινίσει ποιο εννοεί.",
        },
      };
    }

    if (result.status === "needs_subject_selection") {
      return {
        content: {
          success: true,
          awaiting_selection: true,
          message: "Ο χρήστης θα επιλέξει τώρα το νέο μάθημα μέσα από την εφαρμογή.",
        },
        action: {
          type: "class_update_needs_subject_selection",
          item: { class_id: result.class_id, title: result.title },
        },
      };
    }

    return {
      content: { success: true, item: result.item },
      action: { type: "class_updated", item: result.item },
    };
  },
};
