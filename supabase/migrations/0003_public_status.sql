-- ════════════════════════════════════════════════════════════════════════
-- 0003 · 朋友视图：只暴露派生状态 —— dev-spec 第 4.3 节
--
-- security_invoker = off 让视图以创建者权限执行，绕过 entries 的 RLS，
-- 但只输出聚合后的档位和状态 —— 原始的睡眠分档、饮水分档、训练明细
-- 一律不出库。
--
-- 这是整个隐私边界的关键一环：朋友横排的数据来源只有这个视图，
-- 视图里没有的东西，前端就算写错也拿不到。
--
-- 「今日」按各人自己的时区算（zone_today(p.time_zone)）—— 在国外的朋友
-- 打卡了就该显示打卡了，不该按国内的日历判。时区本身不出视图。
--
-- 注意 Supabase 的 linter 会把 security_invoker = off 标成
-- security_definer_view 警告 —— 这里是刻意的，见上。
-- ════════════════════════════════════════════════════════════════════════

create or replace view public.public_status
with (security_invoker = off) as
select
  p.id            as user_id,
  p.display_name,
  p.avatar_key,
  -- 体型档位：累计训练次数，只涨不跌。与 lib/logic.ts 的 computeStage 同源。
  (select case
     when count(*) >= 120 then 4
     when count(*) >= 60  then 3
     when count(*) >= 20  then 2
     else 1 end
   from public.entries e where e.user_id = p.id and e.trained) as stage,
  -- 今日是否出刊
  exists (select 1 from public.entries e
          where e.user_id = p.id and e."date" = public.zone_today(p.time_zone)) as checked_in_today,
  -- 今日状态：未打卡时为 null，前端渲染成灰色剪影 +「还没出刊」。
  -- 这段 case 与 lib/logic.ts 的 computeState 逐格对应，
  -- logic.test.ts 里有 12 格全枚举表锁住 —— 改这里就要改那边。
  (select case
     when e.sleep_band >= 3 and e.water_band >= 2 then 'energetic'
     when e.sleep_band <= 1 then 'tired'
     when e.sleep_band = 2 and e.water_band = 1 then 'tired'
     else 'neutral' end
   from public.entries e
   where e.user_id = p.id and e."date" = public.zone_today(p.time_zone)) as state
from public.profiles p;

comment on view public.public_status is
  '朋友能看到的全部内容：名字、头像键、体型档位、今日是否出刊、今日状态。没有任何原始打卡数据。';

-- 权限收到最小：登录用户只读，anon 什么都没有。
--
-- 两个 revoke 都是必要的。Supabase 给 public schema 配了
--   alter default privileges in schema public grant all on tables to anon, authenticated;
-- 所以新建的视图会自动带上 INSERT / UPDATE / DELETE / TRUNCATE。
-- 这个视图的 select 列表里有子查询，本来就不是可更新视图，写进去只会报错 ——
-- 但把写权限挂在一个隐私边界对象上是没必要的风险，直接收掉。
revoke all on public.public_status from anon;
revoke all on public.public_status from authenticated;
grant select on public.public_status to authenticated;
