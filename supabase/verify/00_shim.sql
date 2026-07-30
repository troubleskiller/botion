-- ════════════════════════════════════════════════════════════════════════
-- 本地校验用：把 Supabase 的运行环境仿制出来。
-- 只在 scripts/verify-sql.sh 建的临时库里跑，不进云端项目。
--
-- 仿的是三样东西：
--   auth.users 表和 auth.uid()（RLS 策略全靠它）
--   anon / authenticated 两个角色
--   public schema 的默认授权 —— Supabase 配了
--     alter default privileges in schema public grant all on tables to anon, authenticated
--   新建的表和视图会自动带上全部权限。迁移里的 revoke 必须能压过它，
--   不仿这一条就测不出权限有没有收干净。
-- ════════════════════════════════════════════════════════════════════════

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

create or replace function auth.uid() returns uuid
language sql stable
as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated;

-- ── 断言收集 ───────────────────────────────────────────────────────────
create table if not exists _checks (n serial, label text, ok boolean, detail text);

-- security definer：断言要在 set role anon / authenticated 之后也能写进来
create or replace function chk(label text, ok boolean, detail text default '')
returns void language sql security definer as $$
  insert into _checks(label, ok, detail) values (label, ok, detail)
$$;

grant execute on function chk(text, boolean, text) to anon, authenticated;
