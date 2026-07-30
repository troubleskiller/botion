-- ════════════════════════════════════════════════════════════════════════
-- 0002 · 行级安全 —— dev-spec 第 4.2 节
--
-- 「这是本文档最重要的一条。」朋友能看到的只有派生状态，不是原始数据。
-- 边界写在数据库里，即使前端写错也泄露不了。
--
-- 所有策略都只授予 authenticated —— anon 一行都读不到。
-- ════════════════════════════════════════════════════════════════════════

alter table public.profiles           enable row level security;
alter table public.entries            enable row level security;
alter table public.workouts           enable row level security;
alter table public.meals              enable row level security;
alter table public.meal_templates     enable row level security;
alter table public.body_photos        enable row level security;
alter table public.push_subscriptions enable row level security;

-- ── profiles：所有登录用户可读（需要显示名字和头像），只能改自己的 ──────
drop policy if exists "profiles readable"    on public.profiles;
drop policy if exists "own profile writable" on public.profiles;

create policy "profiles readable" on public.profiles
  for select to authenticated using (true);

create policy "own profile writable" on public.profiles
  for update to authenticated using (auth.uid() = id);

-- 注意：故意没有 profiles 的 INSERT 策略。
-- dev-spec 第 0 节明确不做注册引导流程，所以档案不由客户端创建 ——
-- 由 0004 迁移里挂在 auth.users 上的 security definer 触发器建，
-- 攻击面比开一条 INSERT 策略小。

-- ── entries：仅本人可读写。朋友读不到任何一行原始数据 ───────────────────
-- dev-spec 第 4.2 节给的是一条 for all 策略，这里拆成四条，因为：
--   · SELECT 不能有日期窗口 —— 体型档位要数全部历史的累计训练次数
--   · INSERT / UPDATE 必须有日期窗口 —— 第 5 节规则 4「补卡只能补前一天」
--     和第 11 节验收第 5 条要求库里就拒绝，不能只靠 UI 挡
-- 窗口用 user_today()，也就是写入者自己时区里的今天 —— 在国外的朋友
-- 「昨天」和国内不是同一天。
drop policy if exists "own entries"               on public.entries;
drop policy if exists "entries select own"        on public.entries;
drop policy if exists "entries insert own recent" on public.entries;
drop policy if exists "entries update own recent" on public.entries;
drop policy if exists "entries delete own"        on public.entries;

create policy "entries select own" on public.entries
  for select to authenticated
  using (auth.uid() = user_id);

create policy "entries insert own recent" on public.entries
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and "date" >= (public.user_today() - 1)
    and "date" <= public.user_today()
  );

create policy "entries update own recent" on public.entries
  for update to authenticated
  using (
    auth.uid() = user_id
    and "date" >= (public.user_today() - 1)
    and "date" <= public.user_today()
  )
  with check (
    auth.uid() = user_id
    and "date" >= (public.user_today() - 1)
    and "date" <= public.user_today()
  );

create policy "entries delete own" on public.entries
  for delete to authenticated
  using (auth.uid() = user_id);

-- ── 其余所有表：仅本人可读写 ───────────────────────────────────────────
drop policy if exists "own workouts"  on public.workouts;
create policy "own workouts" on public.workouts for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own meals" on public.meals;
create policy "own meals" on public.meals for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own templates" on public.meal_templates;
create policy "own templates" on public.meal_templates for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own photos" on public.body_photos;
create policy "own photos" on public.body_photos for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own push" on public.push_subscriptions;
create policy "own push" on public.push_subscriptions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
