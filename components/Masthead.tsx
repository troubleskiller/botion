import { formatMastheadDate, type IsoDate } from '@/lib/date'
import { ThickThinRule } from './Rule'

/**
 * 报头。设计稿的核心判断：连续打卡天数 = 期号。
 * 「第 47 期」印在报头 —— 数天数不像考核，像一份连续出刊的记录，
 * 断了也只是少了一期，不是失败。
 *
 * 设计稿右上角原本还有「19 位朋友」，去掉了：验收第 2 条要求朋友那部分
 * 不出现任何数字，一个纯统计的人数不值得为它留一个暧昧地带。
 * 期号留着 —— 那是自己的记录，不是别人的数据。
 */
export function Masthead({
  date,
  issue,
  bumpIssue = false,
}: {
  date: IsoDate
  /** 期号 = 连续出刊天数。0 表示还没出过刊。 */
  issue: number
  /** 出刊瞬间给期号一个翻页动画 */
  bumpIssue?: boolean
}) {
  return (
    <header className="flex-none px-[22px] pt-[6px]">
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-[9px]">
          <span className="font-heading text-ds-27 tracking-ds-display font-semibold">练报</span>
          <span className="text-ds-8.5 tracking-ds-kicker text-neutral-700 uppercase">
            Daily Rep
          </span>
        </div>
        <span className="text-ds-11.5 text-neutral-700">{formatMastheadDate(date)}</span>
      </div>

      <ThickThinRule />

      <div className="flex items-baseline justify-between pt-[6px]">
        {issue > 0 ? (
          <div className="text-ds-11.5 flex items-baseline gap-[4px] text-neutral-700">
            <span>第</span>
            <span
              className={`font-heading text-ds-15 text-ink inline-block font-semibold ${
                bumpIssue ? 'animate-tick' : ''
              }`}
            >
              {issue}
            </span>
            <span>期 · 连续出刊 {issue} 天</span>
          </div>
        ) : (
          <div className="text-ds-11.5 text-neutral-700">还没出过刊 · 今天可以是第一期</div>
        )}
      </div>
    </header>
  )
}
