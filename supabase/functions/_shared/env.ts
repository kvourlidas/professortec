/// <reference lib="deno.ns" />

import { AppError } from "./errors.ts";

export function getEnv(name: string): string {
  const value = Deno.env.get(name);

  if (!value) {
    throw new AppError(`Missing environment variable: ${name}`, 500, "ENV_MISSING");
  }

  return value;
}