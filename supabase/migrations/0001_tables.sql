-- ════════════════════════════════════════════════════════════════════════
-- 0001 · 表结构 —— dev-spec 第 4.1 节
--
-- 全部语句可重复执行（if not exists / create or replace），
-- 在 Supabase SQL Editor 里粘重复了也不会炸。
-- ════════════════════════════════════════════════════════════════════════

-- ── App 的「今天」 ──────────────────────────────────────────────────────
-- dev-spec 没写时区。Postgres 的 current_date 走 DB 会话时区，Supabase 默认
-- UTC —— 东八区每天有 8 小时的「今天」会算错，直接影响 checked_in_today
-- 和补卡窗口（晚上 8 点打卡会被记成前一天）。
--
-- 视图和 RLS 策略一律用这个函数，前端用 lib/date.ts 的 todayInAppZone()。
-- 两边必须是同一个定义，改一处就要改另一处。
create or replace function public.app_today()
returns date
language sql
stable
set search_path = pg_catalog
as $$ select ((now() at time zone 'Asia/Shanghai')::date) $$;

comment on function public.app_today() is
  'App 的日历日（Asia/Shanghai）。与前端 lib/date.ts 的 todayInAppZone() 同源。';

-- ── 用户档案 ───────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_key text not null,              -- 对应 public/avatars/{key}_N.png
  sex text check (sex in ('male','female')),
  birth_year int,
  height_cm numeric,
  activity_factor numeric default 1.375,
  created_at timestamptz default now()
);

-- ── 每日核心打卡（唯一影响小人状态的数据）──────────────────────────────
create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  sleep_band int not null check (sleep_band between 1 and 4),
  water_band int not null check (water_band between 1 and 3),
  trained boolean not null,
  source text not null default 'manual' check (source in ('manual','auto')),
  created_at timestamptz default now(),
  unique (user_id, date)
);

comment on table public.entries is
  '唯一影响小人状态和体型档位的表。workouts / meals / body_photos 一律不参与计算。';

-- ── 运动明细（可选，不影响小人）────────────────────────────────────────
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  kind text not null check (kind in ('run','strength','sport','other')),
  detail jsonb not null default '{}',    -- 力量: {exercises:[{name,sets,reps,weight_kg}]}
                                         -- 有氧: {minutes, distance_km}
  created_at timestamptz default now()
);

-- ── 饮食记录（私密）────────────────────────────────────────────────────
create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  slot text check (slot in ('breakfast','lunch','dinner','snack')),
  photo_path text,                       -- storage: meal-photos/{user_id}/...
  transcript text,                       -- 用户口述的份量
  items jsonb not null default '[]',     -- 模型返回的逐项结果
  kcal int,
  protein_g int, carbs_g int, fat_g int,
  kcal_low int, kcal_high int,
  user_adjusted boolean default false,
  created_at timestamptz default now()
);

-- ── 常吃模板（长期准确度的主要来源）────────────────────────────────────
create table if not exists public.meal_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  items jsonb not null,
  kcal int, protein_g int, carbs_g int, fat_g int,
  use_count int default 0,
  created_at timestamptz default now()
);

-- ── 身材照片（最高敏感度，每周一次）────────────────────────────────────
create table if not exists public.body_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  taken_on date not null,
  photo_path text not null,              -- storage: body-photos/{user_id}/...
  created_at timestamptz default now()
);

-- ── 推送订阅 ───────────────────────────────────────────────────────────
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz default now()
);

-- ── 索引 ───────────────────────────────────────────────────────────────
create index if not exists entries_user_date_idx      on public.entries (user_id, date desc);
create index if not exists workouts_user_date_idx     on public.workouts (user_id, date desc);
create index if not exists meals_user_date_idx        on public.meals (user_id, date desc);
create index if not exists body_photos_user_date_idx  on public.body_photos (user_id, taken_on desc);
