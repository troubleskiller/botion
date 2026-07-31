# 练报 · The Daily Rep

二十个人的一份小报，每天出一期。你出刊，这期才出得来。

一个封闭朋友圈的健身打卡 PWA。设计上只服务一件事：**让朋友们连续用满 10 天**。

- 产品与数据规则：[`dev-spec.md`](./dev-spec.md)
- 视觉规格：Claude Design 项目「练报设计原型」（设计 token 已提取进 `tailwind.config.ts`）

## 现在做到哪了

**Phase 1 完成**（dev-spec 第 9 节）：建表 + RLS + 视图、Magic Link 登录、首页、打卡弹层、`lib/logic.ts` + 单元测试。

Phase 2/3/4 一律没有提前实现。底部导航的「饮食 / 运动 / 我的」是禁用占位。

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
| `npm run verify:avatars` | 量小人素材的几何：画布 / 角色高度 / 基线 / 四档是否对齐 |

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
