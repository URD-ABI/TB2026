import { createClient } from "@supabase/supabase-js";
import { readEnv } from "./env";

const environment = readEnv();

export const supabase = createClient(
  environment.VITE_SUPABASE_URL,
  environment.VITE_SUPABASE_ANON_KEY,
);
