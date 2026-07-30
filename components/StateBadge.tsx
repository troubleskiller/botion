import { stateName, type DailyState } from '@/lib/logic'

/**
 * 精神 / 普通 / 蔫 / 还没出刊 的标识。
 *
 * 两种形态：
 *   stamp —— 自己的今日状态。歪 3.5° 的印章，1.5px 描边，23px 衬线。
 *   tag   —— 朋友横排的小签。10px，扁平。
 *
 * 「还没出刊」在两种形态里都是虚线框 + 透明底 —— 设计稿的判断：
 * 蔫是「有内容的状态」（实底小签），还没出刊是「没有内容」（虚线框）。
 * 形状、颜色、语气三样都不同，这是 dev-spec 规则 3 的硬要求。
 *
 * 颜色纪律：朋友的「蔫」用中性墨色，不用红。App 不惩罚谁。
 */
const STAMP_TONE: Record<'energetic' | 'neutral' | 'tired' | 'none', string> = {
  energetic: 'text-accent-700 bg-accent-100 border-solid',
  neutral: 'text-ink bg-transparent border-solid',
  tired: 'text-neutral-700 bg-neutral-200 border-solid',
  none: 'text-neutral-800 bg-transparent border-dashed',
}

const TAG_TONE: Record<'energetic' | 'neutral' | 'tired' | 'none', string> = {
  energetic: 'bg-accent-100 text-accent-800 border-transparent border-solid',
  neutral: 'bg-neutral-200 text-neutral-800 border-transparent border-solid',
  tired: 'bg-neutral-200 text-neutral-700 border-transparent border-solid',
  none: 'bg-transparent text-neutral-800 border-neutral-500 border-dashed',
}

export function StateStamp({ state }: { state: DailyState }) {
  return (
    <div
      className={`font-heading text-ds-23 tracking-ds-stamp rounded-ds-md inline-flex items-center whitespace-nowrap border-[1.5px] border-current pb-[8px] pl-[13px] pr-[13px] pt-[7px] font-semibold ${STAMP_TONE[state ?? 'none']}`}
      style={{ transform: 'rotate(-3.5deg)' }}
    >
      {stateName(state)}
    </div>
  )
}

export function StateTag({ state }: { state: DailyState }) {
  return (
    <span
      className={`text-ds-10 rounded-ds-md whitespace-nowrap border px-[7px] py-[4px] ${TAG_TONE[state ?? 'none']}`}
    >
      {stateName(state)}
    </span>
  )
}
