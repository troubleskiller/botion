-- ════════════════════════════════════════════════════════════════════════
-- 0004 · 登录即建档
--
-- dev-spec 补的一个缺口：第 4.2 节的 profiles 只有 select 和 update 策略，
-- 没有 insert —— 用户永远建不出自己的档案。而第 0 节又明确不做注册引导流程，
-- 所以档案必须在 Magic Link 首次登录时自动出现。
--
-- 用 security definer 触发器而不是开一条 INSERT 策略：客户端完全碰不到
-- profiles 的写入路径，攻击面更小。
--
-- display_name 默认取邮箱 @ 前面那一段。没有设置页（第 0 节），
-- 想改名字直接在 Supabase 里改这一行 —— 「own profile writable」策略
-- 也允许用户自己改。
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_key)
  values (
    new.id,
    coalesce(nullif(split_part(new.email, '@', 1), ''), '朋友'),
    'friend'
  )
  on conflict (id) do nothing;
  return new;
end
$$;

comment on function public.handle_new_user() is
  'Magic Link 首次登录时自动建 profiles 行。avatar_key 默认 friend（首页自己的主位固定用 you 素材）；time_zone 留 null，首次登录时前端探测一次写进来。';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 已经存在但没有档案的用户补一遍（重跑迁移时用得上）
insert into public.profiles (id, display_name, avatar_key)
select
  u.id,
  coalesce(nullif(split_part(u.email, '@', 1), ''), '朋友'),
  'friend'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
