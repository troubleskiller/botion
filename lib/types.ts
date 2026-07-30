/**
 * 数据库行类型。表定义见 supabase/migrations/。
 *
 * Supabase 的查询结果在运行时就是任意 JSON，所以凡是要进业务逻辑的字段
 * 都在这里过一道收窄函数 —— 不用 as 硬断言，也不用 any。
 * （dev-spec 第 6.1 节提到的 zod 是 Phase 3 才引入的依赖，这里不提前装。）
 */
import type { IsoDate } from './date'
import type { DailyState, SleepBand, Stage, State, WaterBand } from './logic'

/** profiles 表的一行 */
export interface ProfileRow {
  id: string
  display_name: string
  avatar_key: string
  sex: 'male' | 'female' | null
  birth_year: number | null
  height_cm: number | null
  activity_factor: number | null
  created_at: string | null
}

/** entries 表的一行 —— 唯一影响小人的数据 */
export interface EntryRow {
  id: string
  user_id: string
  date: IsoDate
  sleep_band: SleepBand
  water_band: WaterBand
  trained: boolean
  source: 'manual' | 'auto'
  created_at: string | null
}

/**
 * public_status 视图的一行 —— 朋友能看到的全部内容。
 * 这里没有的字段，前端就拿不到。
 */
export interface PublicStatusRow {
  user_id: string
  display_name: string
  avatar_key: string
  stage: Stage
  checked_in_today: boolean
  state: DailyState
}

// ─────────────────────────── 运行时收窄 ───────────────────────────

const STATES: readonly State[] = ['energetic', 'neutral', 'tired']

/** 视图返回的 state 是 text，可能是 null（未打卡）。不认识的值一律当未打卡。 */
export function asDailyState(value: unknown): DailyState {
  return STATES.find((s) => s === value) ?? null
}

/** 视图返回的 stage 是 int。越界或缺失回落到 1 档，不让页面崩。 */
export function asStage(value: unknown): Stage {
  if (value === 1 || value === 2 || value === 3 || value === 4) return value
  return 1
}

export function asSleepBand(value: unknown): SleepBand {
  if (value === 1 || value === 2 || value === 3 || value === 4) return value
  throw new RangeError(`sleep_band 越界：${String(value)}`)
}

export function asWaterBand(value: unknown): WaterBand {
  if (value === 1 || value === 2 || value === 3) return value
  throw new RangeError(`water_band 越界：${String(value)}`)
}

/** 首页需要的 entries 字段。原始的分档值只有本人读得到。 */
export interface EntryLite {
  date: IsoDate
  sleepBand: SleepBand
  waterBand: WaterBand
  trained: boolean
  createdAt: string | null
}

/** 把 entries 的原始行收窄。分档越界说明库的 check 约束坏了，直接丢掉这行。 */
export function asEntryLite(row: unknown): EntryLite | null {
  if (typeof row !== 'object' || row === null) return null
  const r = row as Record<string, unknown>
  if (typeof r.date !== 'string') return null
  try {
    return {
      date: r.date,
      sleepBand: asSleepBand(r.sleep_band),
      waterBand: asWaterBand(r.water_band),
      trained: r.trained === true,
      createdAt: typeof r.created_at === 'string' ? r.created_at : null,
    }
  } catch {
    return null
  }
}

/** 把视图的原始行收窄成 PublicStatusRow。字段缺失就返回 null，调用方过滤掉。 */
export function asPublicStatusRow(row: unknown): PublicStatusRow | null {
  if (typeof row !== 'object' || row === null) return null
  const r = row as Record<string, unknown>
  if (typeof r.user_id !== 'string') return null
  if (typeof r.display_name !== 'string') return null
  if (typeof r.avatar_key !== 'string') return null
  return {
    user_id: r.user_id,
    display_name: r.display_name,
    avatar_key: r.avatar_key,
    stage: asStage(r.stage),
    checked_in_today: r.checked_in_today === true,
    state: asDailyState(r.state),
  }
}
