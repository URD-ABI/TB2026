import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { AppProviders } from "./app/AppProviders";
import { readEnv } from "./lib/env";
import { supabase } from "./lib/supabase";
import { SupabaseEventRepository } from "./repositories/SupabaseEventRepository";
import "./styles/global.css";

const environment = readEnv();
const repository = new SupabaseEventRepository(supabase);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProviders repository={repository} eventSlug={environment.VITE_EVENT_SLUG}>
      <App />
    </AppProviders>
  </React.StrictMode>,
);
