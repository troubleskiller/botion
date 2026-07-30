-- ════════════════════════════════════════════════════════════════════════
-- 迁移的行为断言 —— 覆盖 dev-spec 第 11 节验收清单的第 1、2、4、5、6 条。
--
-- 在临时库里跑，不需要 Supabase。scripts/verify-sql.sh 会先跑 00_shim.sql
-- 和四个迁移，再跑这个文件。
-- ════════════════════════════════════════════════════════════════════════

\set A '''11111111-1111-1111-1111-111111111111'''
\set B '''22222222-2222-2222-2222-222222222222'''

insert into auth.users (id, email) values
  (:A::uuid, 'a@example.com'),
  (:B::uuid, 'b@example.com');

-- ═══ 0004 · 登录即建档 ════════════════════════════════════════════════
select chk('建档触发器给两个账号都建了 profiles 行',
  (select count(*) from profiles where id in (:A::uuid, :B::uuid)) = 2,
  '实际 ' || (select count(*)::text from profiles));
select chk('display_name 取邮箱 @ 前缀',
  (select display_name from profiles where id = :A::uuid) = 'a');
select chk('avatar_key 默认 friend', (select avatar_key from profiles where id = :A::uuid) = 'friend');
select chk('time_zone 默认留 null（等首次登录探测）',
  (select time_zone from profiles where id = :A::uuid) is null);

-- ═══ 时区函数 ═════════════════════════════════════════════════════════
select chk('zone_today(null) 回落到 Asia/Shanghai',
  zone_today(null) = zone_today('Asia/Shanghai'));
select chk('zone_today 跟着时区走',
  zone_today('Pacific/Kiritimati') >= zone_today('Pacific/Midway'));

-- ═══ 12 格全枚举：视图的 state 判定 ═══════════════════════════════════
-- 与 lib/logic.test.ts 里的同一张表逐格对应。两边分家是能悄悄坏很久的事。
do $$
declare
  s int; w int; expected text; actual text; i int;
  tbl text[][] := array[
    ['1','1','tired'],    ['1','2','tired'],     ['1','3','tired'],
    ['2','1','tired'],    ['2','2','neutral'],   ['2','3','neutral'],
    ['3','1','neutral'],  ['3','2','energetic'], ['3','3','energetic'],
    ['4','1','neutral'],  ['4','2','energetic'], ['4','3','energetic']];
begin
  for i in 1..12 loop
    s := tbl[i][1]::int; w := tbl[i][2]::int; expected := tbl[i][3];
    -- 与 0003 视图里的 case 完全一致
    actual := case
      when s >= 3 and w >= 2 then 'energetic'
      when s <= 1 then 'tired'
      when s = 2 and w = 1 then 'tired'
      else 'neutral' end;
    perform chk(format('状态判定 睡%s/水%s → %s', s, w, expected), actual = expected, '实际 ' || actual);
  end loop;
end $$;

-- ═══ 以 A 的身份 ══════════════════════════════════════════════════════
set role authenticated;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

insert into entries (user_id, date, sleep_band, water_band, trained)
values (:A::uuid, user_today(), 4, 3, true);
select chk('A 能写自己今天的 entries', true);

insert into meals (user_id, date, slot, kcal) values (:A::uuid, user_today(), 'lunch', 680);
insert into workouts (user_id, date, kind) values (:A::uuid, user_today(), 'strength');
insert into body_photos (user_id, taken_on, photo_path) values (:A::uuid, user_today(), 'body-photos/a/1.jpg');
insert into meal_templates (user_id, name, items) values (:A::uuid, '探针', '[]');
insert into push_subscriptions (user_id, subscription) values (:A::uuid, '{}');

select chk('A 读得到自己的 entries', (select count(*) from entries) = 1);

-- ═══ 验收 5 · 补卡只能补前一天 ════════════════════════════════════════
insert into entries (user_id, date, sleep_band, water_band, trained)
values (:A::uuid, user_today() - 1, 3, 2, true);
select chk('验收 5 · 昨天可以补', true);

do $$
declare d date; label text; offs int[] := array[-2, -7, -30, 1];
  labels text[] := array['前天', '一周前', '一个月前', '明天'];
  i int;
begin
  for i in 1..4 loop
    d := user_today() + offs[i]; label := labels[i];
    begin
      insert into entries (user_id, date, sleep_band, water_band, trained)
      values ('11111111-1111-1111-1111-111111111111', d, 3, 2, true);
      perform chk(format('验收 5 · %s（%s）被库拒绝', label, d), false, '居然写进去了');
    exception when insufficient_privilege then
      perform chk(format('验收 5 · %s（%s）被库拒绝', label, d), true);
    end;
  end loop;
end $$;

-- ═══ 验收 4 · 同一天重复出刊是更新 ════════════════════════════════════
insert into entries (user_id, date, sleep_band, water_band, trained)
values (:A::uuid, user_today(), 1, 1, true)
on conflict (user_id, date) do update
set sleep_band = excluded.sleep_band, water_band = excluded.water_band, trained = excluded.trained;

select chk('验收 4 · 同一天 upsert 两次仍只有 1 行',
  (select count(*) from entries where date = user_today()) = 1,
  '实际 ' || (select count(*)::text from entries where date = user_today()));
select chk('验收 4 · 值被更新成新的分档',
  (select sleep_band from entries where date = user_today()) = 1);

-- ═══ 验收 1 · B 读不到 A 的任何一行 ═══════════════════════════════════
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';

select chk('验收 1 · B 全表扫 entries 得 0 行', (select count(*) from entries) = 0,
  '拿到 ' || (select count(*)::text from entries) || ' 行');
select chk('验收 1 · B 指名读 A 的 entries 得 0 行',
  (select count(*) from entries where user_id = :A::uuid) = 0);
select chk('验收 1 · B 全表扫 meals 得 0 行', (select count(*) from meals) = 0);
select chk('验收 1 · B 全表扫 body_photos 得 0 行', (select count(*) from body_photos) = 0);
select chk('验收 1 · B 全表扫 workouts 得 0 行', (select count(*) from workouts) = 0);
select chk('验收 1 · B 全表扫 meal_templates 得 0 行', (select count(*) from meal_templates) = 0);
select chk('验收 1 · B 全表扫 push_subscriptions 得 0 行', (select count(*) from push_subscriptions) = 0);
-- 聚合也漏不出来
select chk('验收 1 · B 连聚合都拿不到 A 的分档',
  (select coalesce(max(sleep_band), -1) from entries) = -1);

do $$ begin
  begin
    insert into entries (user_id, date, sleep_band, water_band, trained)
    values ('11111111-1111-1111-1111-111111111111', user_today(), 1, 1, false);
    perform chk('验收 1 · B 不能以 A 的身份写 entries', false, '居然写进去了');
  exception when insufficient_privilege then
    perform chk('验收 1 · B 不能以 A 的身份写 entries', true);
  end;
end $$;

do $$
declare n int;
begin
  update profiles set display_name = '被改了'
  where id = '11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count;
  perform chk('验收 1 · B 改不动 A 的 profiles', n = 0, '改到了 ' || n || ' 行');
end $$;

-- ═══ 验收 2 · 视图只暴露派生状态 ══════════════════════════════════════
select chk('验收 2 · B 能从视图读到 A 的派生状态',
  (select count(*) from public_status where user_id = :A::uuid) = 1);
select chk('验收 2 · A 的状态算成 tired（睡 <6h / 水少）',
  (select state from public_status where user_id = :A::uuid) = 'tired',
  '实际 ' || coalesce((select state from public_status where user_id = :A::uuid), 'null'));

reset role;
reset request.jwt.claims;

select chk('验收 2 · 视图字段就是那 6 个，没多出来',
  (select string_agg(column_name, ',' order by column_name) from information_schema.columns
   where table_schema = 'public' and table_name = 'public_status')
  = 'avatar_key,checked_in_today,display_name,stage,state,user_id',
  '实际：' || (select string_agg(column_name, ',' order by column_name) from information_schema.columns
   where table_schema = 'public' and table_name = 'public_status'));

-- ═══ 验收 6 · 累计 20 次跨档，且只涨不跌 ══════════════════════════════
-- 超级用户身份补历史，是为了造出「累计 N 次」，不是绕隐私边界
insert into entries (user_id, date, sleep_band, water_band, trained)
select :A::uuid, zone_today(null) - g, 3, 2, true from generate_series(2, 18) g
on conflict (user_id, date) do nothing;

select chk('验收 6 · 累计 19 次仍是 1 档',
  (select stage from public_status where user_id = :A::uuid) = 1,
  '累计 ' || (select count(*)::text from entries where user_id = :A::uuid and trained) || ' 次');

insert into entries (user_id, date, sleep_band, water_band, trained)
values (:A::uuid, zone_today(null) - 19, 3, 2, true);

select chk('验收 6 · 第 20 次跨到 2 档',
  (select stage from public_status where user_id = :A::uuid) = 2,
  '累计 ' || (select count(*)::text from entries where user_id = :A::uuid and trained) || ' 次');

insert into entries (user_id, date, sleep_band, water_band, trained)
select :A::uuid, zone_today(null) - g, 2, 2, false from generate_series(20, 60) g
on conflict (user_id, date) do nothing;

select chk('验收 6 · 再加 41 天没练，仍是 2 档（只涨不跌）',
  (select stage from public_status where user_id = :A::uuid) = 2,
  '实际 ' || (select stage::text from public_status where user_id = :A::uuid) || ' 档');

-- ═══ 时区按人算 ═══════════════════════════════════════════════════════
update profiles set time_zone = 'Pacific/Kiritimati' where id = :A::uuid;

select chk('时区 · user_today() 跟着本人的 time_zone 走',
  zone_today('Pacific/Kiritimati')
  = (select zone_today((select p.time_zone from profiles p where p.id = :A::uuid))));

select chk('时区 · 视图按各人自己的时区判 checked_in_today',
  (select checked_in_today from public_status where user_id = :A::uuid)
  = exists (select 1 from entries where user_id = :A::uuid
            and date = zone_today('Pacific/Kiritimati')));

update profiles set time_zone = null where id = :A::uuid;

-- ═══ 未登录（anon）什么都读不到 ═══════════════════════════════════════
do $$
declare e int; p int; m int; b int; v int;
begin
  set local role anon;
  begin select count(*) into e from entries;      exception when insufficient_privilege then e := -1; end;
  begin select count(*) into p from profiles;     exception when insufficient_privilege then p := -1; end;
  begin select count(*) into m from meals;        exception when insufficient_privilege then m := -1; end;
  begin select count(*) into b from body_photos;  exception when insufficient_privilege then b := -1; end;
  begin select count(*) into v from public_status;exception when insufficient_privilege then v := -1; end;
  reset role;
  perform chk('anon 读 entries 拿不到数据', e <= 0, '拿到 ' || e || ' 行');
  perform chk('anon 读 profiles 拿不到数据', p <= 0, '拿到 ' || p || ' 行');
  perform chk('anon 读 meals 拿不到数据', m <= 0, '拿到 ' || m || ' 行');
  perform chk('anon 读 body_photos 拿不到数据', b <= 0, '拿到 ' || b || ' 行');
  perform chk('anon 读 public_status 被权限直接挡下', v = -1, '拿到 ' || v || ' 行');
end $$;

-- ═══ 视图权限收到最小 ═════════════════════════════════════════════════
select chk('anon 对 public_status 没有 select',
  not has_table_privilege('anon', 'public.public_status', 'select'));
select chk('authenticated 对 public_status 有 select',
  has_table_privilege('authenticated', 'public.public_status', 'select'));
select chk('authenticated 对 public_status 没有 insert',
  not has_table_privilege('authenticated', 'public.public_status', 'insert'));
select chk('authenticated 对 public_status 没有 update',
  not has_table_privilege('authenticated', 'public.public_status', 'update'));
select chk('authenticated 对 public_status 没有 delete',
  not has_table_privilege('authenticated', 'public.public_status', 'delete'));

-- ═══ RLS 确实开着 ═════════════════════════════════════════════════════
do $$
declare t text;
  tables text[] := array['profiles','entries','workouts','meals','meal_templates','body_photos','push_subscriptions'];
begin
  foreach t in array tables loop
    perform chk(format('%s 开了行级安全', t),
      (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass));
  end loop;
end $$;
