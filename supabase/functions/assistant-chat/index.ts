/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Anthropic from "npm:@anthropic-ai/sdk";
import { handleCors } from "../_shared/cors.ts";
import { requireSchoolContext } from "../_shared/auth.ts";
import { ok, fail } from "../_shared/response.ts";
import { AppError, ValidationError } from "../_shared/errors.ts";
import { getEnv } from "../_shared/env.ts";
import { TOOL_DEFINITIONS, getTool } from "../_shared/assistant/tools/index.ts";

const MODEL = "claude-haiku-4-5";

const SYSTEM_PROMPT = `Είσαι ο βοηθός διαχείρισης για μια σχολή/φροντιστήριο.
Εκτελείς ενέργειες μόνο μέσω των εργαλείων (tools) που σου δίνονται — ποτέ μην ισχυριστείς ότι έκανες κάτι αν δεν κάλεσες το αντίστοιχο tool.
Απάντα πάντα σύντομα, στα ελληνικά, με φιλικό αλλά επαγγελματικό τόνο.

Όταν ο χρήστης θέλει να δημιουργήσει κάτι (π.χ. "Δημιουργία μαθητή") αλλά δεν έχει δώσει αρκετές
πληροφορίες ακόμα, ΜΗΝ καλέσεις το tool αμέσως. Αντί αυτού, ρώτησε σε ένα μήνυμα όλα τα σχετικά
πεδία του tool μαζί (όχι ένα-ένα σε ξεχωριστά μηνύματα), και ξεκαθάρισε ρητά ποια πεδία είναι
υποχρεωτικά και ποια προαιρετικά — ώστε ο χρήστης να αποφασίσει ποια θα συμπληρώσει και ποια θα
αφήσει κενά. Κάλεσε το tool μόνο αφού ο χρήστης απαντήσει ή πει ρητά να προχωρήσεις (π.χ. "αυτά
είναι όλα", "προχώρα", "τα υπόλοιπα άσ' τα κενά") — και τότε άφησε κενά ό,τι δεν δόθηκε, χωρίς να
το μαντέψεις. Αν λείπει κάποιο υποχρεωτικό πεδίο ακόμα και μετά, ρώτησε ξανά μόνο γι' αυτό.`;

function textOf(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== "POST") {
      throw new AppError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
    }

    const { supabase, schoolId } = await requireSchoolContext(req);
    const body = await req.json();

    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message) {
      throw new ValidationError("Missing message");
    }

    const history: Anthropic.MessageParam[] = Array.isArray(body?.history)
      ? body.history
      : [];

    const client = new Anthropic({ apiKey: getEnv("ANTHROPIC_API_KEY") });

    const messages: Anthropic.MessageParam[] = [
      ...history,
      { role: "user", content: message },
    ];

    const first = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOL_DEFINITIONS,
      messages,
    });

    // No tool call — just a text reply (e.g. clarifying question).
    if (first.stop_reason !== "tool_use") {
      return ok({
        reply: textOf(first.content),
        history: [...messages, { role: "assistant", content: first.content }],
      });
    }

    // Execute every tool_use block Claude asked for, in order.
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    const actions: { type: string; item: unknown }[] = [];

    for (const block of first.content) {
      if (block.type !== "tool_use") continue;

      const tool = getTool(block.name);
      if (!tool) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify({ success: false, error: "Unknown tool" }),
          is_error: true,
        });
        continue;
      }

      try {
        const result = await tool.execute(block.input, { supabase, schoolId });
        if (result.action) actions.push(result.action);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result.content),
        });
      } catch (err) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify({
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
          }),
          is_error: true,
        });
      }
    }

    const messagesWithTool: Anthropic.MessageParam[] = [
      ...messages,
      { role: "assistant", content: first.content },
      { role: "user", content: toolResults },
    ];

    const final = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOL_DEFINITIONS,
      messages: messagesWithTool,
    });

    return ok({
      reply: textOf(final.content),
      actions,
      history: [...messagesWithTool, { role: "assistant", content: final.content }],
    });
  } catch (error) {
    return fail(error);
  }
});
