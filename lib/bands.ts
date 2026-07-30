import type { SleepBand, WaterBand } from './logic'

/**
 * 打卡的三组分档 —— entries 表的 sleep_band / water_band / trained。
 * 文案与设计稿的分段控件逐字对应。
 *
 * 这三项是唯一影响小人的数据（dev-spec 规则 1）。
 */
export const SLEEP_BANDS: ReadonlyArray<{ band: SleepBand; label: string }> = [
  { band: 1, label: '<6h' },
  { band: 2, label: '6–7h' },
  { band: 3, label: '7–8h' },
  { band: 4, label: '8h+' },
]

export const WATER_BANDS: ReadonlyArray<{ band: WaterBand; label: string }> = [
  { band: 1, label: '少' },
  { band: 2, label: '一般' },
  { band: 3, label: '充足' },
]

export const TRAINED_OPTIONS: ReadonlyArray<{ value: boolean; label: string }> = [
  { value: true, label: '练了' },
  { value: false, label: '没练' },
]

export function sleepLabel(band: number): string {
  return SLEEP_BANDS.find((b) => b.band === band)?.label ?? '—'
}

export function waterLabel(band: number): string {
  return WATER_BANDS.find((b) => b.band === band)?.label ?? '—'
}
