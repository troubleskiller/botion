import { describe, expect, it } from 'vitest'
import {
  APP_TIME_ZONE,
  formatMastheadDate,
  formatSheetDate,
  formatShortDate,
  isWritableDate,
  shiftDate,
  todayInAppZone,
} from './date'

describe('todayInAppZone', () => {
  it('时区是 Asia/Shanghai', () => {
    expect(APP_TIME_ZONE).toBe('Asia/Shanghai')
  })

  it('UTC 当天的 16:00 之后已经是东八区的第二天', () => {
    // 这就是不能用 current_date（UTC）的原因：晚上 8 点打卡，
    // 按 UTC 算会记成前一天，checked_in_today 和补卡窗口全错。
    expect(todayInAppZone(new Date('2026-07-30T15:59:59Z'))).toBe('2026-07-30')
    expect(todayInAppZone(new Date('2026-07-30T16:00:00Z'))).toBe('2026-07-31')
  })

  it('东八区的一天从 UTC 前一天的 16:00 开始', () => {
    expect(todayInAppZone(new Date('2026-07-29T16:00:00Z'))).toBe('2026-07-30')
    expect(todayInAppZone(new Date('2026-07-30T15:00:00Z'))).toBe('2026-07-30')
  })

  it('输出补零的 YYYY-MM-DD', () => {
    expect(todayInAppZone(new Date('2026-01-05T03:00:00Z'))).toBe('2026-01-05')
    expect(todayInAppZone(new Date('2026-12-31T20:00:00Z'))).toBe('2027-01-01')
  })
})

describe('shiftDate', () => {
  it.each([
    ['2026-07-30', -1, '2026-07-29'],
    ['2026-07-30', 1, '2026-07-31'],
    ['2026-07-30', 0, '2026-07-30'],
    ['2026-03-01', -1, '2026-02-28'],
    ['2028-03-01', -1, '2028-02-29'],
    ['2026-01-01', -1, '2025-12-31'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2026-07-30', -30, '2026-06-30'],
  ])('%s %+d 天 → %s', (date, days, expected) => {
    expect(shiftDate(date, days)).toBe(expected)
  })

  it('非闰年的 2 月没有 29 日', () => {
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftDate('2027-03-01', -1)).toBe('2027-02-28')
  })

  it('不合法的输入抛错，不静默返回 Invalid Date', () => {
    expect(() => shiftDate('2026-13-01', -1)).toThrow(RangeError)
    expect(() => shiftDate('不是日期', -1)).toThrow(RangeError)
  })
})

describe('isWritableDate —— 补卡只能补前一天（规则 4）', () => {
  const TODAY = '2026-07-30'

  it('今天可以写', () => {
    expect(isWritableDate('2026-07-30', TODAY)).toBe(true)
  })

  it('昨天可以写', () => {
    expect(isWritableDate('2026-07-29', TODAY)).toBe(true)
  })

  it('前天拒绝', () => {
    expect(isWritableDate('2026-07-28', TODAY)).toBe(false)
  })

  it('更早的一律拒绝', () => {
    expect(isWritableDate('2026-07-01', TODAY)).toBe(false)
    expect(isWritableDate('2025-07-30', TODAY)).toBe(false)
  })

  it('明天也拒绝', () => {
    expect(isWritableDate('2026-07-31', TODAY)).toBe(false)
  })

  it('跨月的昨天照样可以写', () => {
    expect(isWritableDate('2026-07-31', '2026-08-01')).toBe(true)
    expect(isWritableDate('2026-07-30', '2026-08-01')).toBe(false)
  })
})

describe('日期文案', () => {
  it('报头用中文数字（设计稿：七月三十日 星期四）', () => {
    expect(formatMastheadDate('2026-07-30')).toBe('七月三十日 星期四')
  })

  it('弹层用阿拉伯数字（设计稿：7 月 30 日 星期四）', () => {
    expect(formatSheetDate('2026-07-30')).toBe('7 月 30 日 星期四')
  })

  it('补卡按钮的短日期', () => {
    expect(formatShortDate('2026-07-29')).toBe('7 月 29 日')
  })

  it.each([
    ['2026-07-01', '七月一日'],
    ['2026-07-10', '七月十日'],
    ['2026-07-11', '七月十一日'],
    ['2026-07-19', '七月十九日'],
    ['2026-07-20', '七月二十日'],
    ['2026-07-21', '七月二十一日'],
    ['2026-07-31', '七月三十一日'],
    ['2026-10-11', '十月十一日'],
    ['2026-11-01', '十一月一日'],
    ['2026-12-25', '十二月二十五日'],
  ])('%s 的中文数字读法是 %s', (date, expected) => {
    expect(formatMastheadDate(date).startsWith(expected)).toBe(true)
  })

  it('星期计算正确', () => {
    expect(formatMastheadDate('2026-07-30').endsWith('星期四')).toBe(true)
    expect(formatMastheadDate('2026-07-01').endsWith('星期三')).toBe(true)
    expect(formatMastheadDate('2026-10-11').endsWith('星期日')).toBe(true)
    expect(formatMastheadDate('2028-02-29').endsWith('星期二')).toBe(true)
  })
})
