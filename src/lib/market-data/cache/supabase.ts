// src/lib/market-data/cache/supabase.ts
import { createAdminClient } from "@/lib/supabase/admin";
import type { CacheGetResult, ProviderName } from "../types";

type CacheRow = {
  key: string;
  payload: any;
  source: ProviderName;
  updated_at: string;
  expires_at: string;
};

function nowIso() {
  return new Date().toISOString();
}

export async function cacheGet<T>(key: string): Promise<CacheGetResult<T>> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("market_data_cache")
    .select("key,payload,source,updated_at,expires_at")
    .eq("key", key)
    .maybeSingle<CacheRow>();

  if (error || !data) {
    return { found: false, fresh: false, value: null };
  }

  const expires = new Date(data.expires_at).getTime();
  const fresh = expires > Date.now();

  return {
    found: true,
    fresh,
    value: data.payload as T,
    updated_at: data.updated_at,
    source: data.source,
    expires_at: data.expires_at,
  };
}

export async function cacheSet<T>(key: string, payload: T, ttlMs: number, source: ProviderName): Promise<void> {
  const supabase = createAdminClient();
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();

  const { error } = await supabase.from("market_data_cache").upsert(
    {
      key,
      payload,
      source,
      updated_at: nowIso(),
      expires_at: expiresAt,
    },
    { onConflict: "key" }
  );

  if (error) throw error;
}
