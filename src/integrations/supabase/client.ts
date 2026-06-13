import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const isConfigured =
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  !SUPABASE_URL.includes("your-project") &&
  !SUPABASE_ANON_KEY.includes("your-anon-key") &&
  !SUPABASE_ANON_KEY.includes("placeholder");

const url = isConfigured ? SUPABASE_URL : "https://placeholder.supabase.co";
const key = isConfigured
  ? SUPABASE_ANON_KEY
  : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder";

export const supabase = createClient<Database>(url, key, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
