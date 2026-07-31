# 练报 · The Daily Rep

二十个人的一份小报，每天出一期。你出刊，这期才出得来。

一个封闭朋友圈的健身打卡 PWA。设计上只服务一件事：**让朋友们连续用满 10 天**。

- **接手开发先读 [`AGENTS.md`](./AGENTS.md)** —— 约束、必须同步改的地方、已知的坑
- 产品与数据规则：[`dev-spec.md`](./dev-spec.md)
- 视觉规格：Claude Design 项目「练报设计原型」（设计 token 已提取进 `tailwind.config.ts`）

## 现在做到哪了

已部署：https://botion-troubleskillers-projects.vercel.app

| | |
|---|---|
| 首页 | 小人 + 档位进度 + 朋友横排 + 出刊入口，跨档时全屏交叉淡入 + 震动 |
| 出刊 | 三组分档写入 `entries`，可补前一天 |
| 训练计划 `/plan` | AI 按档位和最近频率排一周，可在页内跟 AI 对话反复调整 |
| 运动 `/workouts` | 今天该练什么（来自计划）+ 复制上次 + 力量 / 有氧记录 |
| 饮食 `/meals` | 拍照 → 说份量 → AI 估算 → 可修正结果卡。七日均值为主指标 |
| 我的进展 `/progress` | 档位、近十二周出刊记录、基于训练记录的建议 |

**还没做**：身材记录、饭菜照片入库（都卡 Storage 桶）、PWA 推送 + 每日提醒、常吃模板。
每件的前置条件见 [`AGENTS.md`](./AGENTS.md) 第 9 节。

## 账号

**没有注册入口。** 这是 20 个人的封闭圈，账号一律在命令行里建，密码发给本人：

```bash
npm run users:add 朋友的邮箱 显示名     # 建号，打印一个随机密码
npm run users:list                     # 看现在有谁、谁最近登录过
npm run users:reset 朋友的邮箱          # 忘密码了走这里
npm run users:remove 朋友的邮箱         # 删号（连同他的全部记录）
```

> 与 dev-spec 的偏离：第 1 节写的是 Magic Link，实际改成了邮箱 + 密码。
> 连带影响是第 0 节说「不做」的两件事必须处理其一 —— 选择是
> **不做注册引导**（后台建号）和 **不做账号找回**（后台重设），
> 两件都留在命令行，界面上一个入口都没有。

## 跑起来

```bash
npm install
cp .env.local.example .env.local     # 填 Supabase 的三个值
npm run avatars:placeholder          # 只在真素材缺失时需要
npm run dev
```

数据库迁移见 [`supabase/README.md`](./supabase/README.md)。

## 命令

| | |
|---|---|
| `npm run dev` / `build` / `start` | 开发 / 构建 / 生产 |
| `npm test` | 单元测试（117 项） |
| `npm run typecheck` | TypeScript 严格模式检查 |
| `npm run verify:sql` | **不需要 Supabase** —— 在本机 Postgres 的临时库里跑一遍迁移并撞每一条隐私边界（62 项） |
| `npm run verify:rls` | 打真库：用 service role 建两个探针账号验隐私边界（46 项），跑完删掉 |
| `npm run verify:avatars` | 量小人素材的几何：画布 / 角色高度 / 基线 / 四档是否对齐，以及朋友排缩略图是否等比 |
| `npm run avatars:thumbs` | 重新生成朋友排的缩略图（改了原图之后要跑） |
| `npm run users:*` | 账号管理，见上 |

## 三条不能破的线

这三条是产品的地基，改任何相关代码前先读 dev-spec 第 5 节和第 11 节。

1. **朋友只看得到派生状态。** 原始打卡数据（睡了几小时、喝了多少水、练了什么）永远不出库 —— 边界写在 `public_status` 视图和 RLS 里，前端就算写错也拿不到。朋友横排里没有一个数字。
2. **未打卡 ≠ 蔫。** `state` 为 `null` 渲染成灰色剪影 +「还没出刊」，和「蔫」在形状、颜色、语气上都不同。蔫是有内容的状态，还没出刊是没有内容。
3. **档位只涨不跌。** 用累计训练次数，不用近期频率。停练不会让小人退化。

## 两处需要同步改的地方

改一边就必须改另一边，否则会悄悄坏很久：

- **状态判定** —— `lib/logic.ts` 的 `computeState`、`lib/logic.test.ts` 的 12 格全枚举表、`supabase/migrations/0003` 视图里的同一段 `case`。三处锁在同一张表上。
- **「今天」** —— `lib/date.ts` 的 `todayInZone()` 和库里的 `zone_today()` / `user_today()`。时区按人存（`profiles.time_zone`），首次登录探测一次，之后不再变动。

## 技术栈

Next.js 16（App Router）· TypeScript 严格模式 · Tailwind v3 · Supabase（Postgres + Auth + RLS）· Vercel
