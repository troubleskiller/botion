# 练报 · 开发规范与交接指南

给接手这个项目的 AI 编码助手看的。**动手前把「三条不能破的线」和「必须同步修改的地方」读完** —— 这两节里的东西一旦破掉，不会立刻报错，而是几天后以「朋友看到了不该看到的数据」或者「小人状态和别人看到的对不上」的形式暴露出来。

产品与数据规格以 [`dev-spec.md`](./dev-spec.md) 为准，视觉以 Claude Design 项目「练报设计原型」为准。本文只写**实现层面的约束**和**已经踩过的坑**。

---

## 0. 这是什么

二十个人的封闭朋友圈健身打卡 PWA。核心循环：每天回答三个问题（睡眠 / 饮水 / 练没练）→ 你的小人变成对应状态 → 朋友那一排能看到你今天的状态，但看不到任何原始数据。

一切设计决策服从一个目标：**让朋友们连续用满 10 天**。

线上：https://botion-troubleskillers-projects.vercel.app
技术栈：Next.js 16（App Router）· TypeScript 严格模式 · Tailwind v3 · Supabase · Vercel

---

## 1. 三条不能破的线

### 1.1 朋友只看得到派生状态

朋友横排的数据**只能**来自 `public_status` 视图，它只有 6 个字段：

```
user_id, display_name, avatar_key, stage, checked_in_today, state
```

原始打卡数据（睡了几小时、喝了多少水、练了什么）、卡路里、餐食、身材照片、训练计划 —— **一行都不出库**。边界写在 RLS 和视图里，不在 UI 里。前端就算写错也拿不到。

**违反的典型写法**：给某个页面加一句 `supabase.from('entries').select('*')` 然后指望 RLS 兜住。RLS 确实会兜住（只返回自己的行），但这说明你在往错的方向想 —— 需要别人的数据时，先问「这个字段该不该进视图」，而不是「怎么把它查出来」。

**横排里不出现任何数字。** 名字、状态、小人，就这三样。人数统计也去掉了（见 `components/FriendRow.tsx` 的注释）。

### 1.2 未打卡 ≠ 蔫

`state === null` 表示「今天还没出刊」，这**不是一种状态，是没有内容**。

| | 小人 | 标识 |
|---|---|---|
| 蔫 | `grayscale(.5) contrast(.97)` · opacity **0.9** · 下沉 5px | 实底灰小签 |
| 还没出刊 | `grayscale(1) brightness(0)` · opacity **0.13** = 剪影 | **虚线框 + 透明底** |

形状、颜色、语气三样都必须不同。改动 `components/Avatar.tsx` 或 `components/StateBadge.tsx` 时守住这条。

### 1.3 档位只涨不跌

`computeStage(累计训练次数)`，不用近期频率。停练一年也不会退档。阈值 `[0, 20, 60, 120]`。

任何「最近 N 天没练就降档」的想法都是错的 —— 这是产品的核心承诺，不是可调参数。

---

## 2. 必须同步修改的地方

这两处各有两份以上的实现。**改一份不改另一份不会报错**，会静默地让前端显示的和朋友看到的不一致。

### 2.1 今日状态的判定（三处）

| 位置 | 形式 |
|---|---|
| `lib/logic.ts` 的 `computeState()` | TypeScript 分支判定 |
| `lib/logic.test.ts` | 12 格全枚举表 |
| `supabase/migrations/0003_public_status.sql` | 同一段 SQL `case` |

12 格全枚举表就是为了锁住这件事。改判定规则时**三处一起改**，然后跑 `npm test` 和 `npm run verify:sql`（后者会在本地库里把同一张表再验一遍）。

### 2.2 「今天」是哪一天（三处）

时区**按人存**（`profiles.time_zone`），不是全局常量，也**不是** Postgres 的 `current_date`（那个走 UTC，会错一天）。

| 位置 | 函数 |
|---|---|
| `lib/date.ts` | `todayInZone(now, timeZone)` |
| `0001_tables.sql` | `zone_today(tz)` —— 视图用，按各人时区判今日 |
| `0001_tables.sql` | `user_today()` —— RLS 的补卡窗口用，查当前登录用户的时区 |

`time_zone` 为 `null` = 还没确定过。首次登录时 `components/TimeZoneSync.tsx` 探测浏览器时区写一次，**之后再也不动** —— 跟着浏览器变会让出差把「今天」整个挪走，白断一期。

---

## 3. 每次改完必须跑的检查

```bash
npm run typecheck     # 严格模式，不允许 any
npm test              # 117 项，纯函数逻辑
npm run build         # 构建能过
```

按改动范围追加：

| 改了什么 | 还要跑 |
|---|---|
| `supabase/migrations/` 里任何东西 | `npm run verify:sql`（本地 Postgres，62 项，不需要 Supabase） |
| RLS / 视图 / 隐私相关 | `npm run verify:rls`（打真库，46 项，跑完自动删探针账号） |
| `public/avatars/` 里的图 | `npm run avatars:thumbs` 然后 `npm run verify:avatars` |

**这些不是可选的。** `verify:sql` 已经抓到过两个会让迁移直接失败的问题；`verify:avatars` 抓到过一个肉眼完全看不出的 3px 错位。

---

## 4. 设计系统纪律

所有 token 已经提取进 `tailwind.config.ts` 的 `theme.extend`。

- **不要在组件里硬编码色值、字号、间距、圆角、阴影。** 用 `text-ds-13`、`px-ds-2`、`rounded-ds-md`、`bg-accent-100` 这些。
- **不用线、框、卡片做版面。** 分区靠留白。唯一允许的线是报头下面那对粗细双线（`components/Rule.tsx`）。`.card` 那种带底色的块只用于真正离散的条目。
- **青色（`accent`）是交互色。洋红（`accent2`）在整个 App 里只出现在一个地方**：首页「今天这期还没出刊」那个入口。别的地方要用第二色，先想清楚。
- **界面字体就是衬线**，不要为了「UI 感」引入无衬线。中文实际落在 `system-ui`（Source Serif 4 没有 CJK 字形），这是设计稿本来的行为，不是 bug。
- **尊重 `prefers-reduced-motion`**。`app/globals.css` 有全局兜底，但新写的 JS 驱动动画要自己判断（参考 `components/StageUpOverlay.tsx`）。

### 文案

- 主动语态，按钮说清会发生什么。
- **同一动作全流程用同一个词**：这个项目里动作统一叫「出刊」（不是「打卡」「提交」「保存记录」）。
- **空状态是行动邀请，不是留白。**
- **错误说清发生了什么和怎么修复，不道歉、不含糊，而且要区分原因。** 反面教材见第 6.4 节。
- **AI 调用要 10–30 秒**，凡是等模型的地方都必须写明「要半分钟左右，别关页面」。没有预期说明的 30 秒等于卡死。

---

## 5. 与 dev-spec 的偏离（**别"修"回去**）

这些都是刻意的，改回去会破坏正在工作的东西。

| dev-spec 怎么说 | 实际怎么做 | 为什么 |
|---|---|---|
| 第 1 节：Magic Link 登录 | **邮箱 + 密码** | 用户要求。连带：没有注册入口（`npm run users:add` 建号）、没有忘记密码（`npm run users:reset`），两件都留在命令行 |
| 第 1 节：Anthropic Messages API | **tokenfree 网关 + `gpt-5.6-terra`** | 用户指定。OpenAI 兼容协议，见 `lib/ai.ts` |
| 第 4.3 节：`current_date` | **`zone_today(tz)` / `user_today()`** | `current_date` 走 UTC，会错一天。而且朋友分布在不同时区 |
| 第 4.2 节：`entries` 一条 `for all` 策略 | **拆成四条** | SELECT 不能有日期窗口（档位要数全部历史），INSERT/UPDATE 必须有（规则 4） |
| 第 4.2 节：`profiles` 没有 INSERT 策略 | **加了 `0004` 建档触发器** | 原样的话用户永远建不出自己的档案。用 `security definer` 触发器而不是开 INSERT 策略，攻击面更小 |
| 第 9 节：训练计划是「占位卡片」 | **做成了真的**（AI 生成 + 对话调整） | 用户要求 |
| 第 4.4 节：饭菜照片存私有桶 | **暂时不存照片** | 需要先建 Storage bucket 和策略。分析结果都存了，`photo_path` 字段留着 |
| 第 9 节：Phase 1 完成后先用一周 | **一次做到 Phase 4** | 用户要求 |

---

## 6. 已知的坑

都是实际踩过的，重复踩会浪费时间。

### 6.1 删了路由之后 `tsc` 报找不到模块

`.next/` 里的生成类型还指向旧路由。`rm -rf .next` 再跑。不是代码问题。

### 6.2 `language sql` 的函数在创建时就检查依赖

`user_today()` 要读 `profiles`，所以**必须建在 `profiles` 之后**，否则 `0001` 直接报 `relation "public.profiles" does not exist`。新增读表的 SQL 函数时注意顺序。

### 6.3 Supabase 会给新建的表和视图自动授权

它配了 `alter default privileges in schema public grant all on tables to anon, authenticated`。所以**新建视图之后必须显式 `revoke`**，否则 `anon` 能直接读，`authenticated` 还会拿到多余的写权限。参考 `0003_public_status.sql` 结尾那三行。

### 6.4 别让 catch 把真正的错误盖掉

`lib/ai.ts` 里 `apiKey()` 抛的「缺 AI_API_KEY」曾经被 fetch 的 `catch` 改写成「模型连不上」，直接把排查引到了错误方向。**取配置、校验参数这些要放在 try 外面。**

同理，登录失败态原本把「链接校验失败」显示成「没发出去」—— 两种情况的修复办法完全不同。错误分类要和用户能采取的行动对齐。

### 6.5 Supabase SQL Editor 的破坏性操作确认

含 `drop policy if exists` 的迁移会弹「Potential issue detected」，要点 **Run query** 才真的执行。粘完按 `cmd+Enter` 没反应就是它挡着。

### 6.6 用 Node 直接跑 `lib/` 里的 TS 会失败

源码里的 import 是无后缀的（Next 能解析，Node 的 ESM 解析器不能）。要单测 AI 提示词之类的东西，写独立的 `.mjs` 脚本，别去改源码的 import。

### 6.7 环境变量

- `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL` **没有 `NEXT_PUBLIC_` 前缀**，所以打不进客户端包。只能在 Server Action / Route Handler 里用。
- **`SUPABASE_SERVICE_ROLE_KEY` 不在 App 的代码路径里**，只有 `scripts/verify-rls.mjs` 和 `scripts/manage-users.mjs` 用。**别把它加到 Vercel** —— 不需要的地方放密钥是白白扩大攻击面。
- 新增服务端用的环境变量，记得同时加到 Vercel 的 production / preview / development 三个环境，否则本地好好的线上会挂。

---

## 7. 代码地图

```
lib/
  logic.ts        产品的心脏。纯函数：状态、档位、连续天数、TDEE。改这里先看第 2.1 节
  date.ts         日历运算 + 时区 + 中文日期文案。纯函数
  plan.ts         训练计划的 zod schema + 纯函数工具
  meal.ts         饮食分析的 zod schema + 份量缩放
  ai.ts           模型调用。剥围栏、zod 校验、限流、可读错误。仅服务端
  plan-ai.ts      训练计划的提示词。改它等于改产品口气
  types.ts        DB 行类型 + 运行时收窄函数（supabase-js 没生成类型，data 是 any）
  avatars.ts      小人素材路径
  bands.ts        三组分档的文案
  env.ts          环境变量，缺了在启动时炸掉

app/
  page.tsx        首页
  login/          登录（邮箱 + 密码）
  plan/           训练计划 + AI 对话
  workouts/       运动记录
  meals/          饮食记录
  progress/       我的进展
  api/analyze-meal/  食物照片 → 结构化营养数据
  actions/        Server Actions：checkin / plan / workouts / meals / profile

components/       全部是展示层。设计系统纪律见第 4 节
supabase/
  migrations/     0001..0005，按序执行，全部可重复跑
  verify/         本地校验用的 Supabase 环境仿制 + 断言
scripts/          见下
```

### 命令

| | |
|---|---|
| `npm run dev` / `build` / `start` | 开发 / 构建 / 生产 |
| `npm run typecheck` / `test` | 严格模式检查 / 117 项单测 |
| `npm run verify:sql` | **不需要 Supabase**，本地 Postgres 临时库跑迁移 + 撞边界，62 项 |
| `npm run verify:rls` | 打真库验隐私边界，46 项，跑完删探针 |
| `npm run verify:avatars` | 素材几何：画布 / 高度 / 基线 / 四档对齐 / 缩略图等比 |
| `npm run avatars:thumbs` | 重新生成朋友排缩略图（**改了原图必跑**） |
| `npm run users:list / add / reset / avatar / remove` | 账号管理，没有注册入口 |

---

## 8. 小人素材的规格

`public/avatars/{avatar_key}_{1..4}.png`

- 512 × 1024，PNG，透明背景
- 角色高度 **921px**，基线（脚底）**y = 973**
- **四档之间头顶 y 和脚底 y 必须像素级一致** —— 升档动画是两张图交叉淡入，不对齐的话人会在换档瞬间跳一下

加新套系：图丢进目录 → `npm run avatars:thumbs` → `npm run verify:avatars` → `npm run users:avatar 邮箱 套系名`。脚本会自动发现目录里的所有套系，不需要改代码。

朋友排用的是 `public/avatars/thumb/` 下 192×384 的 WebP（约 16 KB，比原图省 94%）。**改了原图一定要重新生成缩略图**，否则朋友排还是旧的。

---

## 9. 还没做的事

按建议顺序，每件都标了前置条件。

### 9.1 身材记录（Phase 4 第 14 项）
**前置**：Supabase Storage 建 `body-photos` 私有桶 + `auth.uid()::text = (storage.foldername(name))[1]` 策略。
每周一次，本周 vs 4 周前，并排 / 叠加两种对比。这一页走 `surface` 灰底 + 锁标识，和其它页一眼分得开。**不提供「昨天 vs 今天」** —— 噪音大于信号。

### 9.2 饭菜照片入库
**前置**：同上，`meal-photos` 桶。
现在只存分析结果，`photo_path` 字段留着。注意 Supabase 免费版只有 1 GB 文件存储，二十个人记饭菜照片两个月就爆，上之前先想清楚容量。

### 9.3 PWA 推送 + 每日提醒（Phase 2 第 6、7 项）
**前置**：VAPID 密钥、`public/sw.js`、Vercel Cron、`CRON_SECRET`。
**这块工作量最大，而且做半个比不做更糟。** iOS 必须先「添加到主屏幕」，再在独立窗口里由用户手势触发授权 —— 引导流程要单独设计，说不清楚的话用户会以为推送坏了。
推送文案要带社交信息（「今天 4/6 人打卡了」），不要写成待办提醒。

### 9.4 常吃模板（Phase 3 第 12 项）
`meal_templates` 表已经建好了，没有 UI。长期准确度主要靠这个，不靠每次调滑块。

### 9.5 Supabase 区域
项目建在 `ca-central-1`（加拿大），用户都在湾区，RTT 约 70–90ms。换到 `us-west-1` 能到 10–20ms。免费版不能改区域，只能新建项目重跑迁移。**优先级低** —— 几十毫秒的事。

---

## 10. 怎么给我派任务

这个项目里最容易出错的不是「写不出代码」，是「改了 A 没改跟 A 绑定的 B」。所以派任务时请：

**1. 一次一件事，说清楚验收标准。**

不好：「优化一下饮食页」
好：「饮食页的七日均值柱状图在只有一天数据时高度算错了，修掉。改完跑 `npm test` 和 `npm run build`」

**2. 涉及下面这些的任务，在任务描述里直接把约束贴上：**

- 改状态判定 → 「同时改 `lib/logic.ts`、`lib/logic.test.ts` 的 12 格表、`0003` 视图里的 SQL，然后跑 `npm run verify:sql`」
- 改数据库 → 「跑 `npm run verify:sql` 确认 62 项全过」
- 改朋友横排 / 视图 / RLS → 「跑 `npm run verify:rls` 确认 46 项全过，并确认横排里没有数字」
- 换素材 → 「跑 `npm run avatars:thumbs` 和 `npm run verify:avatars`」

**3. 明确说「不要动什么」。**

第 5 节那张偏离表里的每一条，都是便宜模型看到会想「修正」的东西。派任务时如果任务附近有这些，直接写「登录用密码不用 Magic Link，别改」。

**4. 新功能先问一句：这个数据该不该让朋友看到。**

如果答案是「不该」，那它就不进 `public_status`，并且新表要 `enable row level security` + `own xxx` 策略（照抄 `0005_training_plans.sql` 的写法）。

### 任务模板

```
任务：<一句话说清做什么>
文件：<大概会碰哪些文件>
约束：<从第 1、2、5 节里挑相关的贴过来>
验收：npm run typecheck && npm test && npm run build
      <加上第 3 节里对应的额外检查>
不要动：<第 5 节里相关的偏离项>
```

---

## 11. 最后

这个产品的成败不在功能多少，在于**朋友们会不会连着用满十天**。

加功能之前先问：这个东西是让人更愿意明天再打开一次，还是只是让功能列表更长？dev-spec 第 0 节那份「不要做的事」清单是刻意砍掉的，不是遗漏。
