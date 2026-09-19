import { createClient } from "@supabase/supabase-js";

// These are the public anon/publishable Supabase credentials — safe to ship
// client-side because the database is protected by row-level security.
// Env vars override these if present (useful for pointing at a different project).
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://cptvdtpmpnpzxkzxeylh.supabase.co";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_RXBU2u6GXbiaso6d2WAkEw_jLyLfHP9";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
