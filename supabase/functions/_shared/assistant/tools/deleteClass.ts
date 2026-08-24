/// <reference lib="deno.ns" />

import { deleteClassByTitleService } from "../../services/classesService.ts";
import type { AssistantTool } from "../types.ts";

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export const deleteClassTool: AssistantTool = {
  definition: {
    name: "delete_class",
    description:
      "Διαγράφει ένα τμήμα (class). Χρησιμοποίησε class_id αν είναι ήδη γνωστό (π.χ. από " +
      "προηγούμενη αναζήτηση σε αυτή τη συνομιλία), αλλιώς δώσε class_title για αναζήτηση με βάση " +
      "τον τίτλο. Η ενέργεια αυτή είναι μη αναστρέψιμη από τον χρήστη μέσα από τη συνομιλία — ζήτησε " +
      "ρητή επιβεβαίωση από τον χρήστη πριν καλέσεις αυτό το tool.",
    input_schema: {
      type: "object",
      properties: {
        class_id: { type: "string", description: "Το ID του τμήματος, αν είναι ήδη γνωστό." },
        class_title: { type: "string", description: "Ο τίτλος (ή μέρος του) του τμήματος προς αναζήτηση." },
      },
      required: [],
      additionalProperties: false,
    },
  },

  async execute(input, { supabase, schoolId }) {
    const result = await deleteClassByTitleService(supabase, schoolId, {
      class_id: str(input?.class_id),
      class_title: str(input?.class_title),
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

    return {
      content: { success: true, class_id: result.class_id, title: result.title },
      action: { type: "class_deleted", item: { id: result.class_id, title: result.title } },
    };
  },
};
