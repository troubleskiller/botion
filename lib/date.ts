/**
 * 日期工具。全部是纯函数：需要「现在」的地方一律由调用方把 Date 传进来，
 * 好让测试不依赖系统时钟。
 *
 * 时区说明（dev-spec 未覆盖）：
 * Postgres 的 current_date 走 DB 会话时区（Supabase 默认 UTC），对 UTC+8
 * 的用户每天有 8 小时的「今天」是错的 —— 晚上 8 点打卡会被记成前一天，
 * checked_in_today 和补卡窗口全错。
 *
 * 而且朋友圈里有人在国外，所以「今天」是按人算的：每个 profile 存自己的
 * time_zone，库里对应 zone_today(tz) 和 user_today()。这里的 todayInZone()
 * 必须和它们是同一个定义 —— 改一处就要改另一处。
 */
export const DEFAULT_TIME_ZONE = 'Asia/Shanghai'

/** YYYY-MM-DD 的日历日字符串。不带时间、不带时区。 */
export type IsoDate = string

/** 取某个时区下的今天。tz 为 null 时回落到默认时区。与库里的 zone_today() 同义。 */
export function todayInZone(now: Date, timeZone: string | null): IsoDate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone ?? DEFAULT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)

  const pick = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? ''

  return `${pick('year')}-${pick('month')}-${pick('day')}`
}

/**
 * 浏览器所在的 IANA 时区。只在首次登录（profiles.time_zone 还是 null）时
 * 探测一次并写进档案，之后再也不动 —— 出差旅行不该把「今天」挪走，
 * 那会白断一期。首次登录正好在国外的话，改库里那一行就行。
 */
export function detectTimeZone(): string {
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
  return detected === '' ? DEFAULT_TIME_ZONE : detected
}

/** 时区名是否被当前运行时认识。防止往库里写一个 Intl 不认的字符串。 */
export function isKnownTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date(0))
    return true
  } catch {
    return false
  }
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

/** 出刊时刻：「9:41」。入参是 timestamptz 字符串，按本人时区显示。 */
export function formatClock(timestamp: string, timeZone: string | null): string {
  const at = new Date(timestamp)
  if (Number.isNaN(at.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timeZone ?? DEFAULT_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  }).format(at)
}
