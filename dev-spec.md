# 健身社交 App — 开发文档

> 配合 Claude Design 产出的设计稿一起使用。设计稿定义外观，本文档定义结构、数据和规则。
> **两者冲突时，以本文档的数据规则和隐私约束为准，视觉以设计稿为准。**

---

## 0. 项目背景与约束

- **用户规模**：约 20 人的封闭朋友圈，全部 iPhone 用户
- **分发方式**：PWA（Web + 添加到主屏幕），无需 Apple 开发者账号
- **数据录入**：全手动打卡（第一版不接 HealthKit）
- **首要目标**：让朋友们连续用满 10 天。一切设计决策服从这一点

**不要做的事**（这些是刻意砍掉的，不是遗漏）：

- 不做注册引导流程、账号找回、设置页
- 不做后台自动同步、HealthKit 集成
- 不做陌生人社交、公开排行榜、好友申请流程
- 不做训练计划推荐的实际逻辑（只做占位卡片）

---

## 1. 技术栈

| 层 | 选型 | 理由 |
|---|---|---|
| 框架 | Next.js（App Router）+ TypeScript | 需要 API Route 接收数据、调用视觉模型 |
| 样式 | Tailwind CSS | 与设计稿交付格式一致 |
| 数据库 / 认证 / 存储 | Supabase | 免费额度足够，RLS 能在数据库层强制隐私边界 |
| 部署 | Vercel | 免费额度足够，push 即更新 |
| 推送 | Web Push（`web-push` + 自定义 Service Worker） | iOS 16.4+ 支持，需加到主屏后才能授权 |
| 视觉模型 | Anthropic Messages API（服务端调用） | 用于食物照片的热量估算 |

**认证**：Supabase Auth 的 Magic Link（邮箱免密登录）。20 个朋友，不需要密码、不需要 OAuth。

---

## 2. 项目结构

```
app/
  layout.tsx
  page.tsx                    # 首页
  checkin/page.tsx            # 每日快速打卡
  meals/page.tsx              # 饮食记录
  workouts/page.tsx           # 运动记录
  progress-photos/page.tsx    # 身材记录（私密）
  progress/page.tsx           # 我的进展
  api/
    analyze-meal/route.ts     # 食物照片 → 结构化营养数据
    push/subscribe/route.ts   # 保存推送订阅
    push/send/route.ts        # 发送推送（供 Cron 调用）
    cron/daily-reminder/route.ts
components/
  Avatar.tsx                  # 小人展示（体型档 + 状态）
  StateBadge.tsx              # 精神/普通/蔫 标识
  StageProgress.tsx           # 档位进度条
  FriendRow.tsx               # 朋友横向滚动排
  CheckinSheet.tsx            # 打卡底部弹层
lib/
  supabase/client.ts
  supabase/server.ts
  logic.ts                    # 纯函数业务逻辑（见第 5 节）
  types.ts
public/
  avatars/{user}_1.png ... _4.png
  manifest.json
  sw.js                       # Service Worker（推送）
```

---

## 3. 环境变量

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # 仅服务端，绝不暴露给客户端
ANTHROPIC_API_KEY=                # 仅服务端
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
CRON_SECRET=                      # 保护 cron 端点
```

---

## 4. 数据库

### 4.1 表结构

```sql
-- 用户档案
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_key text not null,              -- 对应 public/avatars/{key}_N.png
  sex text check (sex in ('male','female')),
  birth_year int,
  height_cm numeric,
  activity_factor numeric default 1.375,
  created_at timestamptz default now()
);

-- 每日核心打卡（唯一影响小人状态的数据）
create table entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  date date not null,
  sleep_band int not null check (sleep_band between 1 and 4),
  water_band int not null check (water_band between 1 and 3),
  trained boolean not null,
  source text not null default 'manual' check (source in ('manual','auto')),
  created_at timestamptz default now(),
  unique (user_id, date)
);

-- 运动明细（可选，不影响小人）
create table workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  date date not null,
  kind text not null check (kind in ('run','strength','sport','other')),
  detail jsonb not null default '{}',    -- 力量: {exercises:[{name,sets,reps,weight_kg}]}
                                         -- 有氧: {minutes, distance_km}
  created_at timestamptz default now()
);

-- 饮食记录（私密）
create table meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
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

-- 常吃模板（长期准确度的主要来源）
create table meal_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  items jsonb not null,
  kcal int, protein_g int, carbs_g int, fat_g int,
  use_count int default 0,
  created_at timestamptz default now()
);

-- 身材照片（最高敏感度，每周一次）
create table body_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  taken_on date not null,
  photo_path text not null,              -- storage: body-photos/{user_id}/...
  created_at timestamptz default now()
);

-- 推送订阅
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz default now()
);

create index on entries (user_id, date desc);
create index on workouts (user_id, date desc);
create index on meals (user_id, date desc);
create index on body_photos (user_id, taken_on desc);
```

### 4.2 隐私边界用 RLS 强制，不靠 UI

**这是本文档最重要的一条。** 朋友能看到的只有派生状态，不是原始数据。
边界写在数据库里，即使前端写错也泄露不了。

```sql
alter table profiles           enable row level security;
alter table entries            enable row level security;
alter table workouts           enable row level security;
alter table meals              enable row level security;
alter table meal_templates     enable row level security;
alter table body_photos        enable row level security;
alter table push_subscriptions enable row level security;

-- profiles: 所有登录用户可读（需要显示名字和头像），只能改自己的
create policy "profiles readable" on profiles
  for select to authenticated using (true);
create policy "own profile writable" on profiles
  for update to authenticated using (auth.uid() = id);

-- 其余所有表：仅本人可读写。朋友读不到任何一行原始数据
create policy "own entries"   on entries   for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own workouts"  on workouts  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own meals"     on meals     for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own templates" on meal_templates for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own photos"    on body_photos for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own push"      on push_subscriptions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

### 4.3 朋友视图：只暴露派生状态

```sql
create or replace view public_status
with (security_invoker = off) as
select
  p.id            as user_id,
  p.display_name,
  p.avatar_key,
  -- 体型档位：累计训练次数，只涨不跌
  (select case
     when count(*) >= 120 then 4
     when count(*) >= 60  then 3
     when count(*) >= 20  then 2
     else 1 end
   from entries e where e.user_id = p.id and e.trained) as stage,
  -- 今日是否打卡
  exists (select 1 from entries e
          where e.user_id = p.id and e.date = current_date) as checked_in_today,
  -- 今日状态：未打卡时为 null，前端渲染成灰色剪影
  (select case
     when e.sleep_band >= 3 and e.water_band >= 2 then 'energetic'
     when e.sleep_band <= 1 then 'tired'
     when e.sleep_band = 2 and e.water_band = 1 then 'tired'
     else 'neutral' end
   from entries e
   where e.user_id = p.id and e.date = current_date) as state
from profiles p;

grant select on public_status to authenticated;
```

> `security_invoker = off` 让视图以创建者权限执行，绕过 `entries` 的 RLS，
> 但只输出聚合后的档位和状态——原始的睡眠时长、饮水、训练明细一律不出库。

### 4.4 Storage

```
meal-photos/{user_id}/{meal_id}.jpg    # 私有 bucket
body-photos/{user_id}/{photo_id}.jpg   # 私有 bucket
```

两个 bucket 都设为 **private**，读取一律走短时效 signed URL（建议 60 秒）。
Storage 策略同样限制为 `auth.uid()::text = (storage.foldername(name))[1]`。

---

## 5. 核心业务逻辑（`lib/logic.ts`）

**全部写成纯函数并配单元测试。** 这些规则是产品的心脏，不要散落在组件里。

```ts
export type State = 'energetic' | 'neutral' | 'tired'
export type Stage = 1 | 2 | 3 | 4

/** 今日状态：只由睡眠和饮水决定 */
export function computeState(sleepBand: number, waterBand: number): State {
  if (sleepBand >= 3 && waterBand >= 2) return 'energetic'
  if (sleepBand <= 1) return 'tired'
  if (sleepBand === 2 && waterBand === 1) return 'tired'
  return 'neutral'
}

/** 体型档位：累计训练次数，只涨不跌 */
export function computeStage(totalTrainedDays: number): Stage {
  if (totalTrainedDays >= 120) return 4
  if (totalTrainedDays >= 60) return 3
  if (totalTrainedDays >= 20) return 2
  return 1
}

export const STAGE_THRESHOLDS = [0, 20, 60, 120] as const

/** 距离下一档还差几次；已满档返回 null */
export function toNextStage(total: number): number | null {
  const next = STAGE_THRESHOLDS.find(t => t > total)
  return next === undefined ? null : next - total
}

/** 连续打卡天数：从今天或昨天往前数 */
export function computeStreak(dates: string[] /* 降序 YYYY-MM-DD */): number { /* ... */ }

/** 目标热量 Mifflin-St Jeor */
export function computeTDEE(p: {
  sex: 'male' | 'female'; weightKg: number; heightCm: number
  age: number; activityFactor: number
}): number {
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age
             + (p.sex === 'male' ? 5 : -161)
  return Math.round(bmr * p.activityFactor)
}

/** 安全下限：低于阈值不显示目标数字，改为提示咨询专业人士 */
export const KCAL_FLOOR = { male: 1500, female: 1200 } as const
export function isTargetSafe(kcal: number, sex: 'male'|'female'): boolean {
  return kcal >= KCAL_FLOOR[sex]
}
```

### 必须遵守的规则

1. **只有 `entries` 里的三项影响小人。** `workouts` / `meals` / `body_photos` 一律不参与状态和档位计算。用户漏记这些不会影响打卡链。
2. **档位只涨不跌。** 用累计次数，不用近期频率。停练不会让小人退化。
3. **未打卡 ≠ 蔫。** `state === null` 渲染为灰色剪影 +「还没打卡」。这两种状态的视觉必须明确区分。
4. **补卡只能补前一天。** 更早的日期拒绝写入。
5. **热量不影响小人。** 吃多了不会让小人变蔫。

---

## 6. API Routes

### 6.1 `POST /api/analyze-meal`

**输入**：`{ imageBase64: string, mediaType: string, transcript: string }`
**输出**：结构化营养数据（见下）

服务端调用 Anthropic Messages API，system prompt 固定为：

```
You are a nutrition estimation assistant. Analyze the food photo and the
user's spoken description of portion size.

Return ONLY valid JSON, no markdown fences, no preamble:
{
  "items": [{
    "name": "steamed white rice",
    "portion_estimate": "1.5 cups cooked",
    "grams": 240,
    "confidence": "high" | "medium" | "low",
    "kcal": 312, "protein_g": 6, "carbs_g": 68, "fat_g": 1
  }],
  "total": { "kcal": 680, "protein_g": 42, "carbs_g": 78, "fat_g": 22 },
  "range": { "kcal_low": 560, "kcal_high": 820 },
  "scale_reference": "hand visible, used for scale" | "none detected",
  "notes": "brief note on what was uncertain"
}

Rules:
- The user's spoken portion description OVERRIDES your visual estimate.
- If no scale reference is visible and the user gave no portion info,
  mark confidence "low" and widen the range accordingly.
- Do NOT comment on whether the meal is healthy, or on the user's body.
- Never invent items you cannot see.
```

**实现要点**：
- 解析前剥掉可能出现的 ``` 围栏；解析失败返回可读错误，不要抛裸异常
- 用 zod 校验返回结构，字段缺失时降级为「无法识别，请手动输入」
- 图片先在客户端压到长边 ≤1568px 再上传，省流量也省 token
- 速率限制：每用户每分钟 10 次

**语音输入**：不要自建录音+转写。iOS 键盘自带听写，用一个普通 `<textarea>` + 提示「点键盘上的麦克风说份量」即可，零代码零成本。

### 6.2 推送

- `POST /api/push/subscribe` — 保存订阅
- `GET /api/cron/daily-reminder` — Vercel Cron 每天 22:30 触发，需校验 `CRON_SECRET`

推送文案要带社交信息，不要写成待办提醒：

- ✅「今天 4/6 人打卡了」
- ❌「该记录今天的数据了」

**iOS 限制**：必须先「添加到主屏幕」，再在独立窗口内由用户手势触发授权。
首次引导要说清楚这一步，否则用户会以为推送坏了。

---

## 7. PWA 配置

`public/manifest.json`：

```json
{
  "name": "...", "short_name": "...",
  "start_url": "/", "display": "standalone",
  "background_color": "#ffffff", "theme_color": "#ffffff",
  "icons": [
    { "src": "/icons/192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

`public/sw.js` 需处理 `push` 和 `notificationclick` 事件。
在 `app/layout.tsx` 里注册 Service Worker 并链接 manifest。

---

## 8. 小人素材

- 路径：`public/avatars/{avatar_key}_{stage}.png`，stage ∈ 1..4
- 规格：512×1024 透明背景，角色高度固定 921px，基线 y=973，四档已对齐
- **切换档位时角色不会跳动**，因此可以直接对 `<img>` 做 opacity 交叉淡入
- 未打卡状态：同一张图套 CSS filter（灰度 + 降低透明度），不要另外准备素材

**升档动画**：这是产品里唯一该「炸一下」的地方。
建议全屏遮罩 + 新旧形象交叉淡入 + 轻微弹跳 + `navigator.vibrate()`。
必须尊重 `prefers-reduced-motion`。

---

## 9. 实施阶段

**Phase 1 — 骨架（先做这个，做完就能自己用）**
1. Supabase 建表 + RLS + `public_status` 视图
2. Magic Link 登录
3. 首页：我的小人 + 档位进度 + 朋友横排（读 `public_status`）
4. 打卡弹层：三个分档按钮，写入 `entries`
5. `lib/logic.ts` + 单元测试

> Phase 1 完成后，先自己连用一周，再往下做。

**Phase 2 — 留存**
6. PWA manifest + Service Worker + Web Push
7. Vercel Cron 每日提醒
8. 升档动画
9. 连续打卡天数

**Phase 3 — 记录**
10. 运动记录（含「复制上次」）
11. 饮食记录：拍照 → 语音份量 → `analyze-meal` → 可修正结果卡片
12. 常吃模板
13. 日/周热量视图（**周均值为主指标**）

**Phase 4 — 长期**
14. 身材记录（私密，每周一次，对位轮廓，本周 vs 4 周前）
15. 我的进展 + 基于训练记录的建议
16. 训练计划推荐（占位卡片）

---

## 10. 文案与质量底线

**文案**（设计稿常常不覆盖这些，需要补齐）：
- 主动语态，按钮说清会发生什么：「记录今天」不是「提交」
- 同一动作在全流程中用同一个词：按钮写「打卡」，toast 就写「已打卡」
- 空状态是行动邀请，不是留白：「还没有人打卡，你可以是第一个」
- 错误说清发生了什么和怎么修复，不道歉、不含糊

**质量底线**：
- 移动端优先，响应式
- 键盘焦点可见
- 尊重 `prefers-reduced-motion`
- 所有网络请求有加载态和失败态，失败可重试

---

## 11. 验收清单

Phase 1 完成时逐条确认：

- [ ] 用另一个账号登录，**无法**读到第一个账号的 `entries` / `meals` / `body_photos` 任何一行
- [ ] 朋友横排只显示小人、名字、状态，**没有任何数字**
- [ ] 未打卡的朋友显示为灰色剪影 +「还没打卡」，与「蔫」视觉明确不同
- [ ] 同一天重复打卡是更新而非新增（`unique(user_id, date)` 生效）
- [ ] 补卡只能补前一天，更早的日期被拒绝
- [ ] 累计训练次数跨过 20 时，档位从 1 跳到 2，且不会因停练回落
- [ ] 四档切换时小人的头顶和脚底位置不发生跳动
- [ ] 在 iPhone 上添加到主屏后可以正常打开并保持登录
```
