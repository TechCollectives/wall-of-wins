-- TIQC Live Sticky Wall: initial schema.
-- Design: ../../Design - TIQC Live Sticky Wall.md (Data model, RLS, eng review R2/R3/R5).
--
-- Access model
--   anon (phones, projector)  read events (id, slug, title, is_open) + visible stickies,
--                             insert stickies into open events (limited columns)
--   admin token holder        hide_sticky / set_open / export_event RPCs
--   service_role (laptop)     creates events via scripts/new-event.ts

-- ---------------------------------------------------------------- tables

create table public.events (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  title            text not null check (char_length(title) between 1 and 120),
  is_open          boolean not null default true,
  admin_token_hash text not null unique,  -- sha256 hex of the admin token; never readable by anon
  created_at       timestamptz not null default now()
);

create table public.stickies (
  id              uuid primary key,  -- generated on the phone, once per draft (idempotent retries)
  event_id        uuid not null references public.events (id) on delete cascade,
  text            text not null check (char_length(btrim(text)) between 1 and 280),
  color           text not null check (color in ('lime', 'pink', 'orange', 'blue', 'peri')),
  font_idx        smallint not null check (font_idx between 0 and 3),
  ink             text not null check (ink in ('green', 'black', 'blue')),
  name            text check (char_length(name) <= 40),
  type            text check (type in ('wish', 'win', 'thanks')),
  granted_wish_id uuid references public.stickies (id) on delete set null,  -- reserved: Wish→Win yarn
  hidden          boolean not null default false,
  created_at      timestamptz not null default now()
);

create index stickies_event_created_idx on public.stickies (event_id, created_at);

-- ---------------------------------------------------------------- privileges
-- Supabase grants everything on new public tables to anon/authenticated by default.
-- Start from nothing and grant only what the app needs.

revoke all on public.events, public.stickies from anon, authenticated;

-- Column-level grants: RLS filters rows, not columns, so this is what keeps
-- admin_token_hash unreadable (eng review, office-hours round 2).
grant select (id, slug, title, is_open) on public.events to anon, authenticated;
grant select on public.stickies to anon, authenticated;
-- Phones can't set hidden, granted_wish_id or created_at.
grant insert (id, event_id, text, color, font_idx, ink, name, type)
  on public.stickies to anon, authenticated;

-- ---------------------------------------------------------------- row level security

alter table public.events enable row level security;
alter table public.stickies enable row level security;

create policy "events are public"
  on public.events for select to anon, authenticated
  using (true);

create policy "visible stickies are public"
  on public.stickies for select to anon, authenticated
  using (hidden = false);

create policy "post to open walls"
  on public.stickies for insert to anon, authenticated
  with check (
    hidden = false
    and exists (select 1 from public.events e where e.id = event_id and e.is_open)
  );

-- ---------------------------------------------------------------- 500-sticky cap (eng review R2)

create function public.enforce_wall_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Serialize inserts per wall so concurrent posts can't slip past the cap.
  perform 1 from public.events where id = new.event_id for update;
  if (select count(*) from public.stickies where event_id = new.event_id) >= 500 then
    raise exception 'wall_full' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_wall_cap() from public, anon, authenticated;

create trigger stickies_wall_cap
  before insert on public.stickies
  for each row execute function public.enforce_wall_cap();

-- ---------------------------------------------------------------- admin RPCs (token-checked)

create function public.event_for_token(p_token text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.events
  where admin_token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;

revoke execute on function public.event_for_token(text) from public, anon, authenticated;

create function public.hide_sticky(p_token text, p_sticky_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event uuid := public.event_for_token(p_token);
begin
  if v_event is null then
    raise exception 'invalid_token' using errcode = '42501';
  end if;
  update public.stickies set hidden = true
  where id = p_sticky_id and event_id = v_event;
end;
$$;

create function public.set_open(p_token text, p_open boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event uuid := public.event_for_token(p_token);
begin
  if v_event is null then
    raise exception 'invalid_token' using errcode = '42501';
  end if;
  update public.events set is_open = p_open where id = v_event;
end;
$$;

create function public.export_event(p_token text)
returns table (
  id uuid, created_at timestamptz, color text, type text, name text, text text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_event uuid := public.event_for_token(p_token);
begin
  if v_event is null then
    raise exception 'invalid_token' using errcode = '42501';
  end if;
  return query
    select s.id, s.created_at, s.color, s.type, s.name, s.text
    from public.stickies s
    where s.event_id = v_event and not s.hidden
    order by s.created_at, s.id;
end;
$$;

revoke execute on function public.hide_sticky(text, uuid) from public;
revoke execute on function public.set_open(text, boolean) from public;
revoke execute on function public.export_event(text) from public;
grant execute on function public.hide_sticky(text, uuid) to anon, authenticated;
grant execute on function public.set_open(text, boolean) to anon, authenticated;
grant execute on function public.export_event(text) to anon, authenticated;

-- ---------------------------------------------------------------- realtime

alter publication supabase_realtime add table public.stickies;
