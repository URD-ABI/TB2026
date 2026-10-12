import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

describe("parseEnv", () => {
  it("refuse une configuration Supabase absente", () => {
    expect(() => parseEnv({})).toThrow(/VITE_SUPABASE_URL/);
  });

  it("refuse une URL Supabase invalide", () => {
    expect(() => parseEnv({
      VITE_SUPABASE_URL: "not-an-url",
      VITE_SUPABASE_ANON_KEY: "a".repeat(20),
    })).toThrow(/VITE_SUPABASE_URL/);
  });

  it("refuse une clé publique trop courte", () => {
    expect(() => parseEnv({
      VITE_SUPABASE_URL: "https://project-ref.supabase.co",
      VITE_SUPABASE_ANON_KEY: "short",
    })).toThrow(/VITE_SUPABASE_ANON_KEY/);
  });

  it("utilise le slug Team Building par défaut", () => {
    expect(parseEnv({
      VITE_SUPABASE_URL: "https://project-ref.supabase.co",
      VITE_SUPABASE_ANON_KEY: "a".repeat(20),
    }).VITE_EVENT_SLUG).toBe("team-building-2026");
  });

  it("conserve un slug configuré explicitement", () => {
    expect(parseEnv({
      VITE_SUPABASE_URL: "https://project-ref.supabase.co",
      VITE_SUPABASE_ANON_KEY: "a".repeat(20),
      VITE_EVENT_SLUG: "tournoi-des-arcanes",
    }).VITE_EVENT_SLUG).toBe("tournoi-des-arcanes");
  });
});
