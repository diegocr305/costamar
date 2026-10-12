create function public.club_admin_overview(p_actor uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
 v_day date := (now() at time zone 'America/Santiago')::date;
 v_start timestamptz := v_day::timestamp at time zone 'America/Santiago';
 v_end timestamptz := (v_day+1)::timestamp at time zone 'America/Santiago';
 v_result jsonb;
begin
 if public.club_effective_role(p_actor) not in ('superadmin','admin') then raise exception 'OVERVIEW_REQUIRED';end if;
 with member_counts as (
  select count(*) as total,count(*) filter(where status='active') as active,
   count(*) filter(where enrolled_at>=v_start and enrolled_at<v_end) as today,
   count(*) filter(where enrolled_at >= (v_day-6)::timestamp at time zone 'America/Santiago' and enrolled_at<v_end) as last7,
   count(*) filter(where enrolled_at >= (v_day-29)::timestamp at time zone 'America/Santiago' and enrolled_at<v_end) as last30,
   count(*) filter(where status='active' and extract(month from birth_date)=extract(month from v_day)) as birthdays
  from public.club_members
 ), surveys as (
  select count(*) as total,
   count(*) filter(where coalesce(p.survey_status,'not_shown')='not_shown') as not_shown,
   count(*) filter(where p.survey_status='viewed') as viewed,
   count(*) filter(where p.survey_status='skipped') as skipped,
   count(*) filter(where p.survey_status='responded') as responded
  from public.club_members m left join public.club_member_preferences p on p.user_id=m.user_id where m.status='active'
 ), coupons as (
  select count(*) filter(where c.status='issued' and (c.expires_at is null or c.expires_at>now()) and m.status='active') as available,
   count(*) filter(where c.status='redeemed') as redeemed,
   count(*) filter(where c.status='expired' or (c.status='issued' and c.expires_at<=now())) as expired
  from public.club_coupons c join public.club_members m on m.user_id=c.user_id
 ), redemptions as (
  select count(*) filter(where created_at>=v_start and created_at<v_end) as today,
   count(*) filter(where created_at >= (v_day-6)::timestamp at time zone 'America/Santiago' and created_at<v_end) as last7
  from public.club_coupon_redemptions
 )
 select jsonb_build_object('date',to_char(v_day,'YYYY-MM-DD'),'timeZone','America/Santiago','generatedAt',now(),
  'members',jsonb_build_object('total',m.total,'active',m.active,'newToday',m.today,'new7Days',m.last7,'new30Days',m.last30,'birthdaysThisMonth',m.birthdays),
  'surveys',jsonb_build_object('total',s.total,'notShown',s.not_shown,'viewed',s.viewed,'skipped',s.skipped,'responded',s.responded),
  'coupons',jsonb_build_object('available',c.available,'redeemed',c.redeemed,'expired',c.expired),
  'redemptions',jsonb_build_object('today',r.today,'last7Days',r.last7)) into v_result
 from member_counts m cross join surveys s cross join coupons c cross join redemptions r;
 return v_result;
end;
$$;
revoke all on function public.club_admin_overview(uuid) from public,anon,authenticated;
grant execute on function public.club_admin_overview(uuid) to service_role;
