/// <reference lib="deno.ns" />

import { deleteSpecialtyByNameService } from "../../services/specialtiesService.ts";
import type { AssistantTool } from "../types.ts";

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export const deleteSpecialtyTool: AssistantTool = {
  definition: {
    name: "delete_specialty",
    description:
      "Διαγράφει μια ειδικότητα (specialty) καθηγητή. Χρησιμοποίησε specialty_id αν είναι ήδη γνωστό " +
      "(π.χ. από προηγούμενη αναζήτηση σε αυτή τη συνομιλία), αλλιώς δώσε specialty_name για " +
      "αναζήτηση με βάση το όνομα. Η ενέργεια αυτή είναι μη αναστρέψιμη από τον χρήστη μέσα από τη " +
      "συνομιλία — ζήτησε ρητή επιβεβαίωση από τον χρήστη πριν καλέσεις αυτό το tool.",
    input_schema: {
      type: "object",
      properties: {
        specialty_id: { type: "string", description: "Το ID της ειδικότητας, αν είναι ήδη γνωστό." },
        specialty_name: { type: "string", description: "Το όνομα (ή μέρος του ονόματος) της ειδικότητας προς αναζήτηση." },
      },
      required: [],
      additionalProperties: false,
    },
  },

  async execute(input, { supabase, schoolId }) {
    const result = await deleteSpecialtyByNameService(supabase, schoolId, {
      specialty_id: str(input?.specialty_id),
      specialty_name: str(input?.specialty_name),
    });

    if (result.status === "not_found") {
      return {
        content: {
          success: false,
          error: "not_found",
          message: "Δεν βρέθηκε ειδικότητα με αυτό το όνομα. Ρώτησε τον χρήστη να διορθώσει το όνομα.",
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
            "Βρέθηκαν περισσότερες από μία ειδικότητες με αυτό το όνομα. Παράθεσε τις επιλογές στον " +
            "χρήστη και ζήτησέ του να διευκρινίσει ποια εννοεί.",
        },
      };
    }

    return {
      content: { success: true, specialty_id: result.specialty_id, name: result.name },
      action: { type: "specialty_deleted", item: { id: result.specialty_id, name: result.name } },
    };
  },
};
