/// <reference lib="deno.ns" />

import { corsHeaders } from "./cors.ts";
import { AppError } from "./errors.ts";

export function ok(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders,
  });
}

export function fail(error: unknown) {
  if (error instanceof AppError) {
    return new Response(
      JSON.stringify({
        error: error.message,
        code: error.code,
      }),
      {
        status: error.status,
        headers: corsHeaders,
      }
    );
  }

  return new Response(
    JSON.stringify({
      error: error instanceof Error ? error.message : "Unexpected error",
      code: "INTERNAL_ERROR",
    }),
    {
      status: 500,
      headers: corsHeaders,
    }
  );
}