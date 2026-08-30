/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { getEnv } from "../_shared/env.ts";
import { ok, fail } from "../_shared/response.ts";
import { AppError, ValidationError } from "../_shared/errors.ts";

const CATEGORIES = [
  "Τεχνικό πρόβλημα",
  "Οικονομικό θέμα",
  "Ερώτηση για λειτουργία",
  "Πρόταση βελτίωσης",
  "Άλλο",
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== "POST") {
      throw new AppError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
    }

    const { user } = await requireAuth(req);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      throw new ValidationError("Invalid request body");
    }

    const category = String((body as Record<string, unknown>).category ?? "").trim();
    const message = String((body as Record<string, unknown>).message ?? "").trim();
    const name = String((body as Record<string, unknown>).name ?? "").trim();
    const phone = String((body as Record<string, unknown>).phone ?? "").trim();

    if (!message) {
      throw new ValidationError("Το μήνυμα είναι υποχρεωτικό");
    }
    if (message.length > 5000) {
      throw new ValidationError("Το μήνυμα είναι πολύ μεγάλο");
    }
    if (category && !CATEGORIES.includes(category)) {
      throw new ValidationError("Μη έγκυρη κατηγορία");
    }

    const apiKey = getEnv("RESEND_API_KEY");
    const from = getEnv("SUPPORT_EMAIL_FROM");
    const to = getEnv("SUPPORT_EMAIL_TO");

    const replyTo = user.email ?? undefined;
    const subject = `[Υποστήριξη] ${category || "Χωρίς κατηγορία"} — ${name || replyTo || "Χρήστης"}`;

    const html = `
      <h2>Νέο μήνυμα υποστήριξης</h2>
      <p><strong>Όνομα:</strong> ${escapeHtml(name) || "—"}</p>
      <p><strong>Email:</strong> ${escapeHtml(replyTo ?? "—")}</p>
      <p><strong>Τηλέφωνο:</strong> ${escapeHtml(phone) || "—"}</p>
      <p><strong>Κατηγορία:</strong> ${escapeHtml(category) || "—"}</p>
      <p><strong>User ID:</strong> ${escapeHtml(user.id)}</p>
      <hr />
      <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new AppError(`Email provider error: ${detail}`, 502, "EMAIL_SEND_FAILED");
    }

    return ok({ sent: true });
  } catch (error) {
    return fail(error);
  }
});
