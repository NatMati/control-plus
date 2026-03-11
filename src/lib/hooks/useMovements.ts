"use client";

import useSWR from "swr";

export type Movement = {
  id: string;
  date: string; // YYYY-MM-DD
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  movement_type?: "TRANSFER_IN" | "TRANSFER_OUT" | "FEE" | null;
  amount: number;
  currency: string;
  category?: string | null;
  description?: string | null;
  account_id: string;
  counterparty_account_id?: string | null;
  transfer_group_id?: string | null;
  created_at?: string;
};

type MovementsResponse = {
  movements: Movement[];
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useMovements(params?: { from?: string; to?: string; limit?: number }) {
  const qs = new URLSearchParams();
  if (params?.from) qs.set("from", params.from);
  if (params?.to) qs.set("to", params.to);
  if (params?.limit) qs.set("limit", String(params.limit));

  const key = `/api/movements?${qs.toString()}`;

  const { data, error, isLoading, mutate } = useSWR<MovementsResponse>(key, fetcher);

  return {
    movements: data?.movements ?? [],
    isLoading,
    error,
    reload: mutate,
  };
}
