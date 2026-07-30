/**
 * 日期工具。全部是纯函数：需要「现在」的地方一律由调用方把 Date 传进来，
 * 好让测试不依赖系统时钟。
 *
 * 时区说明（dev-spec 未覆盖，按确认过的假设实现）：
 * Postgres 的 current_date 走 DB 会话时区（通常 UTC），对 UTC+8 的用户
 * 每天有 8 小时的「今天」是错的，会直接影响 checked_in_today 和补卡窗口。
 * 所以库里建了 app_today() 返回 Asia/Shanghai 的日历日，前端用这里的
 * todayInAppZone() 保持同一个定义。两边必须一致，改一处就要改另一处。
 */
export const APP_TIME_ZONE = 'Asia/Shanghai'

/** YYYY-MM-DD 的日历日字符串。不带时间、不带时区。 */
export type IsoDate = string

/** 取 App 时区下的今天。与库里的 app_today() 同义。 */
export function todayInAppZone(now: Date): IsoDate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)

  const pick = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? ''

  return `${pick('year')}-${pick('month')}-${pick('day')}`
}

/** 日历日加减天数。把 YYYY-MM-DD 当作 UTC 零点处理，跨月跨年跨闰年都对。 */
export function shiftDate(date: IsoDate, days: number): IsoDate {
  const ms = Date.parse(`${date}T00:00:00Z`)
  if (Number.isNaN(ms)) throw new RangeError(`不是合法的 YYYY-MM-DD：${date}`)
  return new Date(ms + days * 86_400_000).toISOString().slice(0, 10)
}

/**
 * dev-spec 第 5 节规则 4：补卡只能补前一天，更早的日期拒绝写入。
 * 未来的日期同样拒绝。库里的 RLS 策略是同一个窗口，这里只是提前挡住 UI。
 */
export function isWritableDate(date: IsoDate, today: IsoDate): boolean {
  return date === today || date === shiftDate(today, -1)
}

const CN_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'] as const
const CN_WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const

/** 1–31 的中文数字：十一、二十、二十一、三十一 这种读法。 */
function toChineseNumber(n: number): string {
  if (n < 1 || n > 99 || !Number.isInteger(n)) throw new RangeError(`超出范围：${n}`)
  if (n < 10) return CN_DIGITS[n] ?? ''
  if (n === 10) return '十'
  const tens = Math.floor(n / 10)
  const ones = n % 10
  const head = tens === 1 ? '十' : `${CN_DIGITS[tens] ?? ''}十`
  return ones === 0 ? head : `${head}${CN_DIGITS[ones] ?? ''}`
}

function weekday(date: IsoDate): string {
  const ms = Date.parse(`${date}T00:00:00Z`)
  if (Number.isNaN(ms)) throw new RangeError(`不是合法的 YYYY-MM-DD：${date}`)
  return `星期${CN_WEEKDAYS[new Date(ms).getUTCDay()] ?? ''}`
}

function monthDay(date: IsoDate): { month: number; day: number } {
  const [, m, d] = date.split('-')
  return { month: Number(m), day: Number(d) }
}

/** 报头日期，中文数字：「七月三十日 星期四」 */
export function formatMastheadDate(date: IsoDate): string {
  const { month, day } = monthDay(date)
  return `${toChineseNumber(month)}月${toChineseNumber(day)}日 ${weekday(date)}`
}

/** 弹层里的日期，阿拉伯数字：「7 月 30 日 星期四」 */
export function formatSheetDate(date: IsoDate): string {
  const { month, day } = monthDay(date)
  return `${month} 月 ${day} 日 ${weekday(date)}`
}

/** 补卡按钮：「补 7 月 29 日」 */
export function formatShortDate(date: IsoDate): string {
  const { month, day } = monthDay(date)
  return `${month} 月 ${day} 日`
}
