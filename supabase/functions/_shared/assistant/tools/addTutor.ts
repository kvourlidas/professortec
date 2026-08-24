/// <reference lib="deno.ns" />

import { validateCreateTutorBody } from "../../validators/tutorsValidators.ts";
import { createTutorService } from "../../services/tutorsService.ts";
import type { AssistantTool } from "../types.ts";

export const addTutorTool: AssistantTool = {
  definition: {
    name: "add_tutor",
    description:
      "Δημιουργεί νέο καθηγητή/tutor στη σχολή. Απαιτείται τουλάχιστον το ονοματεπώνυμο, και είτε " +
      "email είτε τηλέφωνο. Τα υπόλοιπα πεδία (ΑΦΜ, IBAN, σημειώσεις) είναι προαιρετικά.",
    input_schema: {
      type: "object",
      properties: {
        full_name: { type: "string", description: "Ονοματεπώνυμο καθηγητή" },
        date_of_birth: { type: "string", description: "Ημερομηνία γέννησης σε μορφή YYYY-MM-DD, αν δόθηκε" },
        phone: { type: "string", description: "Τηλέφωνο επικοινωνίας" },
        email: { type: "string", description: "Email επικοινωνίας" },
        afm: { type: "string", description: "ΑΦΜ" },
        iban: { type: "string", description: "IBAN για πληρωμές" },
        notes: { type: "string", description: "Σημειώσεις για τον καθηγητή" },
      },
      required: ["full_name"],
      additionalProperties: false,
    },
  },

  async execute(input, { supabase, schoolId }) {
    const validated = validateCreateTutorBody(input);
    const item = await createTutorService(supabase, schoolId, validated);

    return {
      content: { success: true, item },
      action: { type: "tutor_created", item },
    };
  },
};
