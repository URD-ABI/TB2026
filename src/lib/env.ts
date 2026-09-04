import { z } from "zod";

const environmentSchema = z.object({
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(20),
  VITE_EVENT_SLUG: z.string().min(1).default("team-building-2026"),
});

export type AppEnvironment = z.infer<typeof environmentSchema>;

export function parseEnv(value: Record<string, unknown>): AppEnvironment {
  return environmentSchema.parse(value);
}

export function readEnv(): AppEnvironment {
  return parseEnv((import.meta as ImportMeta & { env: Record<string, unknown> }).env);
}
