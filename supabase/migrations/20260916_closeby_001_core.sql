-- Closeby App #11 — isolated Project Hub core schema
-- Scope: closeby.* only. No public/auth/storage/realtime object modifications.

create schema if not exists closeby;

revoke all on schema closeby from public;
grant usage on schema closeby to authenticated;

create table if not exists closeby.profiles (
  user_id uuid primary key,
  username text not null,
  display_name text not null,
  bio text not null default '',
  avatar_url text,
  interests text[] not null default '{}',
  intent text not null default 'friends',
  visibility text not null default 'hidden' check (visibility in ('everyone','connections','hidden')),
  age_confirmed_18 boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  constraint profiles_display_name_length check (char_length(display_name) between 1 and 60),
  constraint profiles_bio_length check (char_length(bio) <= 240),
  constraint profiles_interests_count check (cardinality(interests) <= 12)
);

create unique index if not exists profiles_username_lower_uidx
  on closeby.profiles (lower(username));

create table if not exists closeby.presence (
  user_id uuid primary key references closeby.profiles(user_id) on delete cascade,
  approx_lat double precision,
  approx_lng double precision,
  is_online boolean not null default false,
  last_seen timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint presence_lat_range check (approx_lat is null or approx_lat between -90 and 90),
  constraint presence_lng_range check (approx_lng is null or approx_lng between -180 and 180)
);

create index if not exists presence_online_seen_idx
  on closeby.presence (is_online, last_seen desc);

create table if not exists closeby.connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references closeby.profiles(user_id) on delete cascade,
  addressee_id uuid not null references closeby.profiles(user_id) on delete cascade,
  pair_low uuid generated always as (least(requester_id, addressee_id)) stored,
  pair_high uuid generated always as (greatest(requester_id, addressee_id)) stored,
  status text not null default 'pending' check (status in ('pending','accepted','declined','disconnected')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint connections_not_self check (requester_id <> addressee_id),
  constraint connections_unique_pair unique (pair_low, pair_high)
);

create index if not exists connections_requester_idx on closeby.connections(requester_id, status);
create index if not exists connections_addressee_idx on closeby.connections(addressee_id, status);

create table if not exists closeby.messages (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references closeby.connections(id) on delete cascade,
  sender_id uuid not null references closeby.profiles(user_id) on delete cascade,
  body text not null,
  sent_at timestamptz not null default now(),
  read_at timestamptz,
  constraint messages_body_length check (char_length(body) between 1 and 2000)
);

create index if not exists messages_connection_sent_idx
  on closeby.messages(connection_id, sent_at desc);

create table if not exists closeby.blocks (
  blocker_id uuid not null references closeby.profiles(user_id) on delete cascade,
  blocked_id uuid not null references closeby.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

create index if not exists blocks_blocked_idx on closeby.blocks(blocked_id);

create table if not exists closeby.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references closeby.profiles(user_id) on delete cascade,
  reported_id uuid not null references closeby.profiles(user_id) on delete cascade,
  category text not null check (category in ('spam','harassment','impersonation','unsafe_behavior','underage','other')),
  details text not null default '',
  created_at timestamptz not null default now(),
  constraint reports_not_self check (reporter_id <> reported_id),
  constraint reports_details_length check (char_length(details) <= 1000)
);

create index if not exists reports_reporter_created_idx
  on closeby.reports(reporter_id, created_at desc);

create or replace function closeby.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function closeby.set_updated_at() from public;

create or replace trigger profiles_set_updated_at
before update on closeby.profiles
for each row execute function closeby.set_updated_at();

create or replace trigger connections_set_updated_at
before update on closeby.connections
for each row execute function closeby.set_updated_at();

alter table closeby.profiles enable row level security;
alter table closeby.presence enable row level security;
alter table closeby.connections enable row level security;
alter table closeby.messages enable row level security;
alter table closeby.blocks enable row level security;
alter table closeby.reports enable row level security;

create policy profiles_select_self_or_related
on closeby.profiles
for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from closeby.connections c
    where c.status in ('pending','accepted')
      and (
        (c.requester_id = (select auth.uid()) and c.addressee_id = profiles.user_id)
        or (c.addressee_id = (select auth.uid()) and c.requester_id = profiles.user_id)
      )
  )
);

create policy profiles_insert_self
on closeby.profiles
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy profiles_update_self
on closeby.profiles
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy profiles_delete_self
on closeby.profiles
for delete
to authenticated
using (user_id = (select auth.uid()));

create policy presence_select_self
on closeby.presence
for select
to authenticated
using (user_id = (select auth.uid()));

create policy connections_select_member
on closeby.connections
for select
to authenticated
using (requester_id = (select auth.uid()) or addressee_id = (select auth.uid()));

create policy messages_select_connected_member
on closeby.messages
for select
to authenticated
using (
  exists (
    select 1
    from closeby.connections c
    where c.id = messages.connection_id
      and c.status = 'accepted'
      and ((c.requester_id = (select auth.uid())) or (c.addressee_id = (select auth.uid())))
  )
);

create policy blocks_select_self
on closeby.blocks
for select
to authenticated
using (blocker_id = (select auth.uid()));

create policy reports_select_self
on closeby.reports
for select
to authenticated
using (reporter_id = (select auth.uid()));

create policy reports_insert_self
on closeby.reports
for insert
to authenticated
with check (reporter_id = (select auth.uid()));

revoke all on all tables in schema closeby from anon;
revoke all on all tables in schema closeby from authenticated;

grant select, insert, update, delete on closeby.profiles to authenticated;
grant select on closeby.presence to authenticated;
grant select on closeby.connections to authenticated;
grant select on closeby.messages to authenticated;
grant select on closeby.blocks to authenticated;
grant select, insert on closeby.reports to authenticated;

create or replace function closeby.touch_presence(p_lat double precision, p_lng double precision)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_adult boolean;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'invalid coordinates' using errcode = '22023';
  end if;

  select age_confirmed_18 into v_adult
  from closeby.profiles
  where user_id = v_uid;

  if not found then
    raise exception 'profile required' using errcode = 'P0001';
  end if;

  if not v_adult then
    raise exception '18+ confirmation required' using errcode = '42501';
  end if;

  insert into closeby.presence (user_id, approx_lat, approx_lng, is_online, last_seen, updated_at)
  values (
    v_uid,
    (round((p_lat / 0.005)::numeric) * 0.005)::double precision,
    (round((p_lng / 0.005)::numeric) * 0.005)::double precision,
    true,
    now(),
    now()
  )
  on conflict (user_id) do update
  set approx_lat = excluded.approx_lat,
      approx_lng = excluded.approx_lng,
      is_online = true,
      last_seen = now(),
      updated_at = now();
end;
$$;

create or replace function closeby.set_offline()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  update closeby.presence
  set is_online = false, last_seen = now(), updated_at = now()
  where user_id = v_uid;
end;
$$;

create or replace function closeby.discover_nearby(
  p_radius_km double precision default 20,
  p_limit integer default 50
)
returns table (
  user_id uuid,
  username text,
  display_name text,
  bio text,
  avatar_url text,
  interests text[],
  intent text,
  approx_lat double precision,
  approx_lng double precision,
  last_seen timestamptz,
  distance_band text,
  connection_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select p.user_id, pr.approx_lat, pr.approx_lng, p.age_confirmed_18
    from closeby.profiles p
    join closeby.presence pr on pr.user_id = p.user_id
    where p.user_id = auth.uid()
      and p.age_confirmed_18 = true
      and pr.approx_lat is not null
      and pr.approx_lng is not null
  ), candidates as (
    select
      p.user_id,
      p.username,
      p.display_name,
      p.bio,
      p.avatar_url,
      p.interests,
      p.intent,
      pr.approx_lat,
      pr.approx_lng,
      pr.last_seen,
      c.status as connection_status,
      6371.0 * 2.0 * asin(
        sqrt(
          power(sin(radians(pr.approx_lat - me.approx_lat) / 2.0), 2)
          + cos(radians(me.approx_lat)) * cos(radians(pr.approx_lat))
          * power(sin(radians(pr.approx_lng - me.approx_lng) / 2.0), 2)
        )
      ) as distance_km
    from me
    join closeby.profiles p on p.user_id <> me.user_id
    join closeby.presence pr on pr.user_id = p.user_id
    left join closeby.connections c
      on c.pair_low = least(me.user_id, p.user_id)
     and c.pair_high = greatest(me.user_id, p.user_id)
    where p.age_confirmed_18 = true
      and p.visibility = 'everyone'
      and pr.is_online = true
      and pr.last_seen > now() - interval '5 minutes'
      and not exists (
        select 1 from closeby.blocks b
        where (b.blocker_id = me.user_id and b.blocked_id = p.user_id)
           or (b.blocker_id = p.user_id and b.blocked_id = me.user_id)
      )
  )
  select
    candidates.user_id,
    candidates.username,
    candidates.display_name,
    candidates.bio,
    candidates.avatar_url,
    candidates.interests,
    candidates.intent,
    candidates.approx_lat,
    candidates.approx_lng,
    candidates.last_seen,
    case
      when candidates.distance_km < 1 then '< 1 km'
      when candidates.distance_km < 3 then '1–3 km'
      when candidates.distance_km < 5 then '3–5 km'
      when candidates.distance_km < 10 then '5–10 km'
      else '10+ km'
    end as distance_band,
    coalesce(candidates.connection_status, 'none') as connection_status
  from candidates
  where candidates.distance_km <= least(greatest(coalesce(p_radius_km, 20), 1), 50)
  order by candidates.distance_km asc, candidates.last_seen desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

create or replace function closeby.send_connection_request(p_target uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_existing closeby.connections%rowtype;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_target is null or p_target = v_uid then
    raise exception 'invalid target' using errcode = '22023';
  end if;
  if not exists (select 1 from closeby.profiles where user_id = p_target and age_confirmed_18 = true) then
    raise exception 'target unavailable' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from closeby.blocks
    where (blocker_id = v_uid and blocked_id = p_target)
       or (blocker_id = p_target and blocked_id = v_uid)
  ) then
    raise exception 'connection unavailable' using errcode = '42501';
  end if;

  select * into v_existing
  from closeby.connections
  where pair_low = least(v_uid, p_target)
    and pair_high = greatest(v_uid, p_target)
  for update;

  if found then
    if v_existing.status = 'accepted' then
      return v_existing.id;
    elsif v_existing.status = 'pending' and v_existing.requester_id = p_target then
      update closeby.connections
      set status = 'accepted', responded_at = now(), updated_at = now()
      where id = v_existing.id;
      return v_existing.id;
    elsif v_existing.status = 'pending' then
      return v_existing.id;
    elsif v_existing.status = 'declined' and v_existing.updated_at > now() - interval '24 hours' then
      raise exception 'request cooldown active' using errcode = 'P0001';
    else
      update closeby.connections
      set requester_id = v_uid,
          addressee_id = p_target,
          status = 'pending',
          created_at = now(),
          responded_at = null,
          updated_at = now()
      where id = v_existing.id
      returning id into v_id;
      return v_id;
    end if;
  end if;

  if (select count(*) from closeby.connections where requester_id = v_uid and status = 'pending') >= 20 then
    raise exception 'too many pending requests' using errcode = 'P0001';
  end if;

  insert into closeby.connections (requester_id, addressee_id, status)
  values (v_uid, p_target, 'pending')
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function closeby.respond_connection_request(p_connection_id uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  update closeby.connections
  set status = case when coalesce(p_accept, false) then 'accepted' else 'declined' end,
      responded_at = now(),
      updated_at = now()
  where id = p_connection_id
    and addressee_id = v_uid
    and status = 'pending'
  returning status into v_status;

  if v_status is null then
    raise exception 'pending request not found' using errcode = 'P0002';
  end if;

  return v_status;
end;
$$;

create or replace function closeby.disconnect(p_connection_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  update closeby.connections
  set status = 'disconnected', responded_at = now(), updated_at = now()
  where id = p_connection_id
    and status = 'accepted'
    and (requester_id = v_uid or addressee_id = v_uid);
end;
$$;

create or replace function closeby.send_message(p_connection_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_body text := btrim(coalesce(p_body, ''));
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 2000 then
    raise exception 'message must be 1 to 2000 characters' using errcode = '22023';
  end if;
  if not exists (
    select 1 from closeby.connections
    where id = p_connection_id
      and status = 'accepted'
      and (requester_id = v_uid or addressee_id = v_uid)
  ) then
    raise exception 'active connection required' using errcode = '42501';
  end if;
  if (select count(*) from closeby.messages where sender_id = v_uid and sent_at > now() - interval '1 minute') >= 30 then
    raise exception 'message rate limit exceeded' using errcode = 'P0001';
  end if;

  insert into closeby.messages (connection_id, sender_id, body)
  values (p_connection_id, v_uid, v_body)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function closeby.mark_conversation_read(p_connection_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from closeby.connections
    where id = p_connection_id
      and status = 'accepted'
      and (requester_id = v_uid or addressee_id = v_uid)
  ) then
    raise exception 'active connection required' using errcode = '42501';
  end if;

  update closeby.messages
  set read_at = now()
  where connection_id = p_connection_id
    and sender_id <> v_uid
    and read_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function closeby.block_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_target is null or p_target = v_uid then
    raise exception 'invalid target' using errcode = '22023';
  end if;

  insert into closeby.blocks (blocker_id, blocked_id)
  values (v_uid, p_target)
  on conflict (blocker_id, blocked_id) do nothing;

  update closeby.connections
  set status = 'disconnected', responded_at = now(), updated_at = now()
  where pair_low = least(v_uid, p_target)
    and pair_high = greatest(v_uid, p_target)
    and status in ('pending','accepted');
end;
$$;

create or replace function closeby.unblock_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  delete from closeby.blocks
  where blocker_id = v_uid and blocked_id = p_target;
end;
$$;

revoke all on function closeby.touch_presence(double precision, double precision) from public;
revoke all on function closeby.set_offline() from public;
revoke all on function closeby.discover_nearby(double precision, integer) from public;
revoke all on function closeby.send_connection_request(uuid) from public;
revoke all on function closeby.respond_connection_request(uuid, boolean) from public;
revoke all on function closeby.disconnect(uuid) from public;
revoke all on function closeby.send_message(uuid, text) from public;
revoke all on function closeby.mark_conversation_read(uuid) from public;
revoke all on function closeby.block_user(uuid) from public;
revoke all on function closeby.unblock_user(uuid) from public;

grant execute on function closeby.touch_presence(double precision, double precision) to authenticated;
grant execute on function closeby.set_offline() to authenticated;
grant execute on function closeby.discover_nearby(double precision, integer) to authenticated;
grant execute on function closeby.send_connection_request(uuid) to authenticated;
grant execute on function closeby.respond_connection_request(uuid, boolean) to authenticated;
grant execute on function closeby.disconnect(uuid) to authenticated;
grant execute on function closeby.send_message(uuid, text) to authenticated;
grant execute on function closeby.mark_conversation_read(uuid) to authenticated;
grant execute on function closeby.block_user(uuid) to authenticated;
grant execute on function closeby.unblock_user(uuid) to authenticated;
