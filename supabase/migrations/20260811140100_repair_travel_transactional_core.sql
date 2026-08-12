-- Repair helper when 20260811000000 partially applied or failed on confirmed-without-supplier rows.
-- Safe / idempotent: only demotes invalid CONFIRMED journeys/attempts, then ensures ledger exists.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'travel_hotel_booking_journeys'
      and column_name = 'status'
  ) then
    update public.travel_hotel_booking_journeys
    set
      failure_reason = coalesce(
        nullif(btrim(failure_reason), ''),
        'Legacy journey lacked supplier confirmation number'
      ),
      updated_at = now()
    where status::text = 'CONFIRMED'
      and (
        supplier_confirmation_number is null
        or length(btrim(supplier_confirmation_number)) < 3
      );

    begin
      update public.travel_hotel_booking_journeys
      set status = 'FAILED'
      where status::text = 'CONFIRMED'
        and (
          supplier_confirmation_number is null
          or length(btrim(supplier_confirmation_number)) < 3
        );
    exception when others then
      null;
    end;
  end if;
end $$;
