# 数据库迁移

按编号顺序执行，一次一个文件。两种跑法：

**A. Supabase SQL Editor**（不需要装任何东西）
打开项目 → SQL Editor → New query → 粘贴 → Run。四个文件依次跑完。

**B. psql**（需要 Project Settings → Database → Connection string 的 URI）

```bash
for f in supabase/migrations/*.sql; do
  echo "── $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done
```

全部语句都是可重复执行的（`if not exists` / `create or replace` /
`drop policy if exists`），粘重复了不会炸。

| 文件 | 内容 | 对应 dev-spec |
|---|---|---|
| `0001_tables.sql` | 七张表 + 索引 + `app_today()` | 第 4.1 节 |
| `0002_rls.sql` | RLS 策略 | 第 4.2 节 |
| `0003_public_status.sql` | 朋友视图 | 第 4.3 节 |
| `0004_profile_trigger.sql` | 登录即建档 | 补 dev-spec 的缺口 |

## 先在本地验一遍（不需要 Supabase）

```bash
npm run verify:sql
```

在本机 Postgres 的临时库里仿出 Supabase 的环境（`auth.uid()`、
`anon` / `authenticated` 两个角色、`public` schema 的默认授权），
跑一遍四个迁移，再撞每一条隐私边界 —— 62 项断言，覆盖第 11 节验收的
第 1、2、4、5、6 条。跑完临时库就删掉，不碰任何已有的库。

云端项目还没建就能先跑。它已经抓到过两个问题：`user_today()` 建在
`profiles` 之前导致迁移直接报错，以及视图上多余的写权限。

## 跑完之后（打真库）

```bash
npm run verify:rls
```

用 service role 建两个探针账号，以普通登录用户的身份再验一遍，
外加视图字段白名单和按人存时区的交叉验证。跑完删掉探针账号。

## 与 dev-spec 的三处差异

1. **「今天」按人算** —— dev-spec 用 `current_date`，走 DB 会话时区
   （Supabase 默认 UTC），东八区每天有 8 小时的「今天」会算错。而且朋友圈里
   有人在国外，所以 `profiles` 加了一列 `time_zone`：

   - `zone_today(tz)` —— 某个时区的日历日。视图用它按各人的时区判断
     `checked_in_today` 和 `state`
   - `user_today()` —— 当前登录用户自己时区里的今天。`entries` 的补卡窗口用它
   - 前端 `lib/date.ts` 的 `todayInZone()` 是同一个定义

   `time_zone` 为 null 表示还没确定过，首次登录时前端探测一次写进来，
   之后再也不动 —— 出差旅行不该把「今天」挪走，那会白断一期。
   首次登录正好在国外的话，改那一行就行：

   ```sql
   update profiles set time_zone = 'America/New_York' where display_name = '某某';
   ```

   时区本身不出 `public_status` 视图。

2. **`entries` 的策略从一条拆成四条** —— SELECT 不能有日期窗口（档位要数
   全部历史），INSERT / UPDATE 必须有（规则 4：补卡只能补前一天）。

3. **`0004` 是新增的** —— dev-spec 的 `profiles` 没有 INSERT 策略，
   而第 0 节又不做注册引导，所以建档必须自动化。

## Storage（Phase 3 / 4 才用）

`meal-photos` 和 `body-photos` 两个 bucket 都设为 private，
策略 `auth.uid()::text = (storage.foldername(name))[1]`，
读取一律走 60 秒的 signed URL。Phase 1 不建。
