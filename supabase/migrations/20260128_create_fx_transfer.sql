create or replace function public.create_fx_transfer(
  p_date date,
  p_from_account uuid,
  p_to_account uuid,
  p_from_amount numeric,
  p_to_amount numeric,
  p_description text default null,
  p_fee_amount numeric default null,
  p_fee_currency text default null,
  p_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_group uuid := gen_random_uuid();
  v_from_cur text;
  v_to_cur text;
begin
  -- Fuente de verdad: JWT real
  v_user := auth.uid();

  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  -- Si alguien pasa p_user_id, solo aceptarlo si coincide (evita bugs y confusión)
  if p_user_id is not null and p_user_id <> v_user then
    raise exception 'p_user_id mismatch (auth=%, passed=%)', v_user, p_user_id;
  end if;

  if p_from_account is null or p_to_account is null then
    raise exception 'from_account and to_account are required';
  end if;

  if p_from_account = p_to_account then
    raise exception 'from_account and to_account must be different';
  end if;

  if p_from_amount is null or p_to_amount is null then
    raise exception 'from_amount and to_amount are required';
  end if;

  if p_from_amount <= 0 or p_to_amount <= 0 then
    raise exception 'amounts must be > 0';
  end if;

  -- Confirmar ownership (ESTO ES LO QUE TE ESTÁ FALLANDO cuando el user_id es distinto)
  select a.currency into v_from_cur
  from public.accounts a
  where a.id = p_from_account
    and a.user_id = v_user;

  if v_from_cur is null then
    raise exception 'from_account not found or not owned (account_id=%, user_id=%)', p_from_account, v_user;
  end if;

  select a.currency into v_to_cur
  from public.accounts a
  where a.id = p_to_account
    and a.user_id = v_user;

  if v_to_cur is null then
    raise exception 'to_account not found or not owned (account_id=%, user_id=%)', p_to_account, v_user;
  end if;

  -- Insert FX_OUT
  insert into public.movements (
    user_id, date, account_id,
    type, category,
    amount, currency,
    description,
    transfer_group_id,
    counterparty_account_id,
    direction,
    created_at,
    transfer_leg
  ) values (
    v_user, p_date, p_from_account,
    'TRANSFER', 'FX_OUT',
    -abs(p_from_amount), v_from_cur,
    p_description,
    v_group,
    p_to_account,
    'OUT',
    now(),
    'FX_OUT'
  );

  -- Insert FX_IN
  insert into public.movements (
    user_id, date, account_id,
    type, category,
    amount, currency,
    description,
    transfer_group_id,
    counterparty_account_id,
    direction,
    created_at,
    transfer_leg
  ) values (
    v_user, p_date, p_to_account,
    'TRANSFER', 'FX_IN',
    abs(p_to_amount), v_to_cur,
    p_description,
    v_group,
    p_from_account,
    'IN',
    now(),
    'FX_IN'
  );

  return v_group;
end;
$$;
