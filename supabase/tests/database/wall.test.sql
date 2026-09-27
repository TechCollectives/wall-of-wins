-- Security and integrity rules for the sticky wall (eng review R2, R3, R6).
-- Run: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

-- ---------------------------------------------------------------- fixtures (as postgres)

insert into public.events (id, slug, title, is_open, admin_token_hash) values
  ('00000000-0000-0000-0000-00000000000a', 'open-wall', 'Open', true,
   encode(sha256(convert_to('tok-open', 'UTF8')), 'hex')),
  ('00000000-0000-0000-0000-00000000000b', 'closed-wall', 'Closed', false,
   encode(sha256(convert_to('tok-closed', 'UTF8')), 'hex')),
  ('00000000-0000-0000-0000-00000000000c', 'cap-wall', 'Cap', true,
   encode(sha256(convert_to('tok-cap', 'UTF8')), 'hex'));

insert into public.stickies (id, event_id, text, color, font_idx, ink, hidden) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'visible', 'lime', 0, 'green', false),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'already hidden', 'pink', 1, 'black', true);

-- 499 stickies on the cap wall, so the 500th is allowed and the 501st is not.
insert into public.stickies (id, event_id, text, color, font_idx, ink)
select gen_random_uuid(), '00000000-0000-0000-0000-00000000000c', 'filler ' || g, 'blue', 2, 'blue'
from generate_series(1, 499) g;

-- ---------------------------------------------------------------- posting (as anon)

set local role anon;

select lives_ok(
  $$ insert into public.stickies (id, event_id, text, color, font_idx, ink, name, type)
     values ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a',
             'I wish to ship my first product', 'lime', 0, 'green', 'Alex', 'wish') $$,
  'anon can post to an open wall');

select throws_ok(
  $$ insert into public.stickies (id, event_id, text, color, font_idx, ink)
     values (gen_random_uuid(), '00000000-0000-0000-0000-00000000000b', 'hi', 'lime', 0, 'green') $$,
  '42501', null, 'anon cannot post to a closed wall');

select throws_ok(
  $$ insert into public.stickies (id, event_id, text, color, font_idx, ink, hidden)
     values (gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'hi', 'lime', 0, 'green', true) $$,
  '42501', null, 'anon cannot set hidden on insert');

select throws_ok(
  $$ insert into public.stickies (id, event_id, text, color, font_idx, ink)
     values ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', 'retry', 'lime', 0, 'green') $$,
  '23505', null, 'reposting the same sticky id is a unique violation (client treats as success)');

select throws_ok(
  $$ insert into public.stickies (id, event_id, text, color, font_idx, ink)
     values (gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', '   ', 'lime', 0, 'green') $$,
  '23514', null, 'blank text is rejected');

select throws_ok(
  format($$ insert into public.stickies (id, event_id, text, color, font_idx, ink)
     values (gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', %L, 'lime', 0, 'green') $$, repeat('x', 281)),
  '23514', null, '281 characters is rejected');

select lives_ok(
  format($$ insert into public.stickies (id, event_id, text, color, font_idx, ink)
     values ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000a', %L, 'orange', 3, 'blue') $$, repeat('x', 280)),
  '280 characters is accepted');

select throws_ok(
  $$ insert into public.stickies (id, event_id, text, color, font_idx, ink)
     values (gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'hi', 'purple', 0, 'green') $$,
  '23514', null, 'unknown color is rejected');

select throws_ok(
  format($$ insert into public.stickies (id, event_id, text, color, font_idx, ink, name)
     values (gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'hi', 'lime', 0, 'green', %L) $$, repeat('n', 41)),
  '23514', null, 'names over 40 characters are rejected');

-- ---------------------------------------------------------------- reading (as anon)

select is(
  (select count(*)::int from public.stickies where event_id = '00000000-0000-0000-0000-00000000000a'),
  3, 'anon sees only visible stickies on the wall');

select is(
  (select count(*)::int from public.stickies where id = '00000000-0000-0000-0000-000000000002'),
  0, 'hidden sticky is invisible to anon');

select lives_ok(
  $$ select id, slug, title, is_open from public.events $$,
  'anon can read public event columns');

select throws_ok(
  $$ select admin_token_hash from public.events $$,
  '42501', null, 'anon cannot read admin_token_hash');

select throws_ok(
  $$ update public.stickies set hidden = false $$,
  '42501', null, 'anon cannot update stickies directly');

select throws_ok(
  $$ delete from public.stickies $$,
  '42501', null, 'anon cannot delete stickies');

select throws_ok(
  $$ select public.event_for_token('tok-open') $$,
  '42501', null, 'anon cannot call the token lookup helper');

-- ---------------------------------------------------------------- admin RPCs (as anon holding a token)

select throws_ok(
  $$ select public.hide_sticky('wrong-token', '00000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'hide_sticky rejects a bad token');

select lives_ok(
  $$ select public.hide_sticky('tok-closed', '00000000-0000-0000-0000-000000000001') $$,
  'hide_sticky with another wall''s token runs');

select is(
  (select count(*)::int from public.stickies where id = '00000000-0000-0000-0000-000000000001'),
  1, '... but does not hide a sticky on a different wall');

select lives_ok(
  $$ select public.hide_sticky('tok-open', '00000000-0000-0000-0000-000000000001') $$,
  'hide_sticky with the right token runs');

select is(
  (select count(*)::int from public.stickies where id = '00000000-0000-0000-0000-000000000001'),
  0, '... and the sticky disappears for anon');

select is(
  (select count(*)::int from public.export_event('tok-open')),
  2, 'export_event returns only visible stickies');

select throws_ok(
  $$ select * from public.export_event('nope') $$,
  '42501', null, 'export_event rejects a bad token');

select throws_ok(
  $$ select public.set_open('nope', false) $$,
  '42501', null, 'set_open rejects a bad token');

select lives_ok(
  $$ select public.set_open('tok-open', false) $$,
  'set_open closes a wall with the right token');

select throws_ok(
  $$ insert into public.stickies (id, event_id, text, color, font_idx, ink)
     values (gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'late', 'lime', 0, 'green') $$,
  '42501', null, 'posting to a wall closed via set_open fails');

-- ---------------------------------------------------------------- 500-sticky cap (as anon)

select lives_ok(
  $$ insert into public.stickies (id, event_id, text, color, font_idx, ink)
     values (gen_random_uuid(), '00000000-0000-0000-0000-00000000000c', 'number 500', 'lime', 0, 'green') $$,
  'the 500th sticky is accepted');

select throws_ok(
  $$ insert into public.stickies (id, event_id, text, color, font_idx, ink)
     values (gen_random_uuid(), '00000000-0000-0000-0000-00000000000c', 'number 501', 'lime', 0, 'green') $$,
  'P0001', 'wall_full', 'the 501st sticky is rejected with wall_full');

-- ---------------------------------------------------------------- realtime

reset role;

select is(
  (select count(*)::int from pg_publication_tables
   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'stickies'),
  1, 'stickies is in the realtime publication');

select * from finish();
rollback;
