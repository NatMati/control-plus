"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export const supabaseBrowser = (): SupabaseClient =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

// Alias por si en algún lado usás createClient:
export const createClient = supabaseBrowser;

export type SupabaseBrowser = SupabaseClient;
