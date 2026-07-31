-- ════════════════════════════════════════════════════════════════════════
-- 0005 · 训练计划
--
-- dev-spec 第 9 节原本把「训练计划推荐」列为 Phase 4 的占位卡片，
-- 现在做成真的：AI 按本人情况生成一份周计划，管理员可以改，
-- 本人也可以在 App 里跟 AI 对话反复调整。
--
-- 隐私边界和其它表一致：只有本人可读写。计划里可能带体重、伤病、
-- 训练偏好这类信息，一行都不进 public_status。
-- ════════════════════════════════════════════════════════════════════════

-- 一人一份当前计划。改是覆盖，不留版本 —— 20 个人的产品不需要计划的历史。
create table if not exists public.training_plans (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  plan jsonb not null,
  -- 生成/修改这份计划时用的模型，出问题好追
  model text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.training_plans is
  '每人一份当前训练计划。plan 的结构见 lib/plan.ts 的 zod schema。';

-- 和 AI 调计划的对话。留着是为了让 AI 有上下文，也让用户回看自己提过什么。
create table if not exists public.plan_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

create index if not exists plan_messages_user_time_idx
  on public.plan_messages (user_id, created_at);

alter table public.training_plans enable row level security;
alter table public.plan_messages  enable row level security;

drop policy if exists "own training plan" on public.training_plans;
create policy "own training plan" on public.training_plans for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own plan messages" on public.plan_messages;
create policy "own plan messages" on public.plan_messages for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 计划和对话都不进朋友视图。public_status 保持只有那 6 个字段。
