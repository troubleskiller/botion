import { z } from 'zod'

/**
 * 训练计划的结构。
 *
 * 这份 schema 是 AI 返回值的唯一合法形状 —— 模型吐什么都要过它，
 * 过不了就当没生成，不让半截数据进库（dev-spec 第 6.1 节对模型返回的
 * 要求，这里沿用同一套做法）。
 *
 * 刻意保持简单：一周七天，每天一个主题 + 几个动作。不做周期化、不做
 * 递增负荷计算 —— 那些需要持续的体能数据，而这个 App 只有打卡三项。
 */
export const ExerciseSchema = z.object({
  name: z.string().min(1).max(40),
  /** 组数。有氧类可以为 null */
  sets: z.number().int().min(1).max(20).nullable(),
  /** 次数或时长，写成字符串因为「8-12」「30 分钟」「力竭」都合法 */
  reps: z.string().min(1).max(30),
  /** 一句话提示，可以为空 */
  note: z.string().max(80).default(''),
})

export const PlanDaySchema = z.object({
  /** 1 = 周一 … 7 = 周日 */
  weekday: z.number().int().min(1).max(7),
  /** 「下肢」「推」「休息」这种。休息日就写休息，exercises 留空 */
  focus: z.string().min(1).max(20),
  exercises: z.array(ExerciseSchema).max(10),
})

export const PlanSchema = z.object({
  title: z.string().min(1).max(40),
  /** 一两句话说明这份计划为什么这么排 */
  note: z.string().max(200).default(''),
  days: z.array(PlanDaySchema).length(7),
})

export type Exercise = z.infer<typeof ExerciseSchema>
export type PlanDay = z.infer<typeof PlanDaySchema>
export type Plan = z.infer<typeof PlanSchema>

/** AI 调整计划时的返回：一句给人看的回话 + 改完的整份计划 */
export const PlanRevisionSchema = z.object({
  reply: z.string().min(1).max(300),
  plan: PlanSchema,
})
export type PlanRevision = z.infer<typeof PlanRevisionSchema>

export type ChatMessage = { role: 'user' | 'assistant'; content: string }

/**
 * 把 plan_messages 的一行收窄成 ChatMessage。
 * 注意不能靠 `r.role === 'user'` 收窄 —— unknown 用 === 比较 TS 不认，
 * 得显式挑出字面量再赋回去。
 */
export function asChatMessage(row: unknown): ChatMessage | null {
  if (typeof row !== 'object' || row === null) return null
  const r = row as Record<string, unknown>
  const role: 'user' | 'assistant' | null =
    r.role === 'user' ? 'user' : r.role === 'assistant' ? 'assistant' : null
  if (role === null || typeof r.content !== 'string') return null
  return { role, content: r.content }
}

export const WEEKDAY_NAMES = ['一', '二', '三', '四', '五', '六', '日'] as const

export function weekdayName(weekday: number): string {
  return `周${WEEKDAY_NAMES[weekday - 1] ?? '?'}`
}

/**
 * 把 YYYY-MM-DD 换成 1..7（周一=1）。
 * 用 UTC 解析，和 lib/date.ts 里其它日历运算保持同一套做法。
 */
export function weekdayOf(date: string): number {
  const ms = Date.parse(`${date}T00:00:00Z`)
  if (Number.isNaN(ms)) throw new RangeError(`不是合法的 YYYY-MM-DD：${date}`)
  const day = new Date(ms).getUTCDay() // 0 = 周日
  return day === 0 ? 7 : day
}

/** 取某一天该练什么。计划里没有这天就返回 null。 */
export function dayOfPlan(plan: Plan, date: string): PlanDay | null {
  const weekday = weekdayOf(date)
  return plan.days.find((d) => d.weekday === weekday) ?? null
}

/** 休息日的判定：没有动作就是休息，不管 focus 写了什么 */
export function isRestDay(day: PlanDay): boolean {
  return day.exercises.length === 0
}

/** 把计划压成一段紧凑文本，喂给模型当上下文用（比塞 JSON 省 token） */
export function planToText(plan: Plan): string {
  const lines = [`《${plan.title}》`]
  if (plan.note) lines.push(plan.note)
  for (const day of [...plan.days].sort((a, b) => a.weekday - b.weekday)) {
    if (isRestDay(day)) {
      lines.push(`${weekdayName(day.weekday)}：休息`)
      continue
    }
    const items = day.exercises
      .map((e) => `${e.name} ${e.sets === null ? '' : `${e.sets}×`}${e.reps}${e.note ? `（${e.note}）` : ''}`)
      .join('、')
    lines.push(`${weekdayName(day.weekday)}（${day.focus}）：${items}`)
  }
  return lines.join('\n')
}
