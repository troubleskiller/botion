/**
 * 核心业务逻辑 —— dev-spec 第 5 节。
 *
 * 这些规则是产品的心脏，全部是纯函数，不要散落到组件里，也不要在组件里
 * 重新实现一遍。库里的 public_status 视图（0003 迁移）用 SQL 重复了
 * computeState 和 computeStage 的判定，两边必须永远一致 ——
 * logic.test.ts 里有一张 12 格全枚举表锁住这件事，改动任何一边都要同步。
 *
 * 必须遵守的规则（dev-spec 第 5 节）：
 *   1. 只有 entries 里的三项影响小人。workouts / meals / body_photos 一律不参与。
 *   2. 档位只涨不跌 —— 用累计次数，不用近期频率。
 *   3. 未打卡 ≠ 蔫。state 为 null 时渲染灰色剪影 +「还没出刊」。
 *   4. 补卡只能补前一天（见 lib/date.ts 的 isWritableDate 和 0002 迁移的 RLS）。
 *   5. 热量不影响小人。
 */
import { shiftDate, type IsoDate } from './date'

// ─────────────────────────────── 今日状态 ───────────────────────────────

export type State = 'energetic' | 'neutral' | 'tired'

/** entries.sleep_band，1 = <6h，2 = 6–7h，3 = 7–8h，4 = 8h+ */
export type SleepBand = 1 | 2 | 3 | 4
/** entries.water_band，1 = 少，2 = 一般，3 = 充足 */
export type WaterBand = 1 | 2 | 3

/**
 * 今日状态：只由睡眠和饮水决定。训练不参与（规则 1）。
 *
 * 入参保持 number 而非窄类型，是为了能直接吃 DB 行的值；
 * 取值范围由 entries 表的 check 约束保证。
 */
export function computeState(sleepBand: number, waterBand: number): State {
  if (sleepBand >= 3 && waterBand >= 2) return 'energetic'
  if (sleepBand <= 1) return 'tired'
  if (sleepBand === 2 && waterBand === 1) return 'tired'
  return 'neutral'
}

/** 未打卡时 state 为 null —— 这不是一种状态，是「没有内容」（规则 3）。 */
export type DailyState = State | null

export const STATE_NAMES: Record<State, string> = {
  energetic: '精神',
  neutral: '普通',
  tired: '蔫',
}

/** 未打卡的文案。刻意和「蔫」用完全不同的措辞和形状（规则 3）。 */
export const NOT_PUBLISHED_LABEL = '还没出刊'

export function stateName(state: DailyState): string {
  return state === null ? NOT_PUBLISHED_LABEL : STATE_NAMES[state]
}

// ─────────────────────────────── 体型档位 ───────────────────────────────

export type Stage = 1 | 2 | 3 | 4

export const STAGE_THRESHOLDS = [0, 20, 60, 120] as const

/** 档位名称，来自设计稿 */
export const STAGE_NAMES: Record<Stage, string> = {
  1: '瘦削',
  2: '匀称',
  3: '结实',
  4: '壮实',
}

/** 体型档位：累计训练次数，只涨不跌（规则 2）。停练不会让小人退化。 */
export function computeStage(totalTrainedDays: number): Stage {
  if (totalTrainedDays >= 120) return 4
  if (totalTrainedDays >= 60) return 3
  if (totalTrainedDays >= 20) return 2
  return 1
}

export function stageName(stage: Stage): string {
  return STAGE_NAMES[stage]
}

/** 距离下一档还差几次；已满档返回 null。 */
export function toNextStage(total: number): number | null {
  const next = STAGE_THRESHOLDS.find((t) => t > total)
  return next === undefined ? null : next - total
}

/**
 * 当前档位内部的完成比例，0..1 —— 给档位进度条的第 N 段做局部填充。
 * 满档恒为 1。
 */
export function stageFillRatio(total: number): number {
  const stage = computeStage(total)
  if (stage === 4) return 1
  const floor = STAGE_THRESHOLDS[stage - 1] ?? 0
  const ceiling = STAGE_THRESHOLDS[stage] ?? floor + 1
  const span = ceiling - floor
  if (span <= 0) return 1
  return Math.min(1, Math.max(0, (total - floor) / span))
}

// ────────────────────────────── 连续出刊天数 ─────────────────────────────

/**
 * 连续打卡天数：从今天或昨天往前数（dev-spec 第 5 节）。
 * 也就是设计稿里的期号 ——「第 47 期 · 连续打卡 47 天」。
 *
 * dev-spec 的签名只有 dates 一个参数，但「今天」必须由调用方传入，
 * 否则函数要读系统时钟就不是纯函数了（第 5 节明确要求纯函数 + 单测）。
 * today 用 lib/date.ts 的 todayInZone(now, 本人时区) 取，和库里的
 * zone_today() / user_today() 同源 —— 朋友圈里有人在国外，「今天」按人算。
 *
 * 「从今天或昨天往前数」的意思：今天还没出刊不算断链 —— 昨天出过就从昨天数。
 * 前天才断。
 *
 * dates 期望降序，但这里会自行去重排序，免得调用方顺序变了就悄悄算错。
 */
export function computeStreak(dates: readonly IsoDate[], today: IsoDate): number {
  const seen = new Set(dates)

  let cursor: IsoDate
  if (seen.has(today)) {
    cursor = today
  } else {
    const yesterday = shiftDate(today, -1)
    if (!seen.has(yesterday)) return 0
    cursor = yesterday
  }

  let streak = 0
  while (seen.has(cursor)) {
    streak += 1
    cursor = shiftDate(cursor, -1)
  }
  return streak
}

// ──────────────────────────── 目标热量（Phase 3）───────────────────────────

/**
 * 目标热量 Mifflin-St Jeor。
 *
 * 注意：profiles 表没有体重字段（dev-spec 第 4.1 节只有 sex / birth_year /
 * height_cm / activity_factor），所以 weightKg 目前没有数据来源。
 * 这个函数按第 5 节先写好并测好，等 Phase 3 做饮食时再决定体重从哪来。
 */
export function computeTDEE(p: {
  sex: 'male' | 'female'
  weightKg: number
  heightCm: number
  age: number
  activityFactor: number
}): number {
  const bmr =
    10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161)
  return Math.round(bmr * p.activityFactor)
}

/** 安全下限：低于阈值不显示目标数字，改为提示咨询专业人士。 */
export const KCAL_FLOOR = { male: 1500, female: 1200 } as const

export function isTargetSafe(kcal: number, sex: 'male' | 'female'): boolean {
  return kcal >= KCAL_FLOOR[sex]
}
