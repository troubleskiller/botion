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

## 跑完之后

`npm run verify:rls` 会用 service role 建两个测试账号，
然后以普通用户身份逐条验证隐私边界（第 11 节验收第 1 条）。

## 与 dev-spec 的三处差异

1. **`app_today()`** —— dev-spec 用 `current_date`，走 DB 会话时区（UTC）。
   东八区每天有 8 小时的「今天」会算错。视图和 RLS 统一用 `Asia/Shanghai`
   的日历日，前端 `lib/date.ts` 的 `todayInAppZone()` 是同一个定义。

2. **`entries` 的策略从一条拆成四条** —— SELECT 不能有日期窗口（档位要数
   全部历史），INSERT / UPDATE 必须有（规则 4：补卡只能补前一天）。

3. **`0004` 是新增的** —— dev-spec 的 `profiles` 没有 INSERT 策略，
   而第 0 节又不做注册引导，所以建档必须自动化。

## Storage（Phase 3 / 4 才用）

`meal-photos` 和 `body-photos` 两个 bucket 都设为 private，
策略 `auth.uid()::text = (storage.foldername(name))[1]`，
读取一律走 60 秒的 signed URL。Phase 1 不建。
