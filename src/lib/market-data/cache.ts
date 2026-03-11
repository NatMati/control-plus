// src/lib/market-data/cache.ts
import { createAdminClient } from "@/lib/supabase/admin";

type CacheRow = {
  key: string;
  payload: any;
  source: string | null;
  updated_at: string;
  expires_at: string;
};

function nowIso() {
  return new Date().toISOString();
}

function addSecondsIso(sec: number) {
  const d = new Date();
  d.setSeconds(d.getSeconds() + sec);
  return d.toISOString();
}

export async function cacheGet<T>(key: string): Promise<null | { payload: T; source: string; updated_at: string }> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("market_data_cache")
    .select("key,payload,source,updated_at,expires_at")
    .eq("key", key)
    .maybeSingle<CacheRow>();

  if (error) throw error;
  if (!data) return null;

  const exp = new Date(data.expires_at).getTime();
  const isFresh = exp > Date.now();

  if (!isFresh) return null;

  return {
    payload: data.payload as T,
    source: data.source ?? "unknown",
    updated_at: data.updated_at,
  };
}

export async function cacheSet(key: string, payload: any, source: string, ttlSeconds: number) {
  const supabase = createAdminClient();

  const row = {
    key,
    payload,
    source,
    updated_at: nowIso(),
    expires_at: addSecondsIso(ttlSeconds),
  };

  const { error } = await supabase
    .from("market_data_cache")
    .upsert(row, { onConflict: "key" });

  if (error) throw error;
}
