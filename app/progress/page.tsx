import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BottomNav } from '@/components/BottomNav'
import { ThickThinRule } from '@/components/Rule'
import { StageProgress } from '@/components/StageProgress'
import { shiftDate, todayInZone, type IsoDate } from '@/lib/date'
import { computeStage, computeStreak, stageName, toNextStage } from '@/lib/logic'
import { createClient } from '@/lib/supabase/server'

/**
 * 我的进展 —— dev-spec 第 9 节 Phase 4 第 15 项。
 *
 * 建议只从训练记录来（「你连续三周没练腿了」这类），不看照片、不评价外貌 ——
 * 这是设计稿写死的一条。
 *
 * 身材记录（第 14 项）还没做，入口做成禁用占位。
 */
export default async function ProgressPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user === null) redirect('/login')

  const [profileResult, entriesResult, workoutsResult] = await Promise.all([
    supabase.from('profiles').select('time_zone, display_name').eq('id', user.id).maybeSingle(),
    supabase.from('entries').select('date, trained').order('date', { ascending: false }),
    supabase.from('workouts').select('date, kind, detail').order('date', { ascending: false }).limit(40),
  ])

  const rawTz: unknown = profileResult.data?.time_zone
  const timeZone = typeof rawTz === 'string' && rawTz !== '' ? rawTz : null
  const today = todayInZone(new Date(), timeZone)

  const rawEntries: Array<{ date?: unknown; trained?: unknown }> = entriesResult.data ?? []
  const dates = rawEntries
    .map((e) => (typeof e.date === 'string' ? e.date : null))
    .filter((d) => d !== null)
  const totalTrained = rawEntries.filter((e) => e.trained === true).length

  const stage = computeStage(totalTrained)
  const remaining = toNextStage(totalTrained)
  const streak = computeStreak(dates, today)

  // 近十二周的出刊记录（84 天）
  const published = new Set(dates)
  const weeks: IsoDate[][] = []
  for (let w = 11; w >= 0; w -= 1) {
    const days: IsoDate[] = []
    for (let d = 6; d >= 0; d -= 1) days.push(shiftDate(today, -(w * 7 + d)))
    weeks.push(days)
  }

  // 建议：只看训练记录，不看照片、不评价外貌
  const rawWorkouts: Array<{ date?: unknown; detail?: unknown }> = workoutsResult.data ?? []
  const fourWeeksAgo = shiftDate(today, -28)
  const recentNames = rawWorkouts
    .filter((w) => typeof w.date === 'string' && w.date >= fourWeeksAgo)
    .flatMap((w) => {
      const d = w.detail
      if (typeof d !== 'object' || d === null) return []
      const detail = d as Record<string, unknown>
      if (detail.kind !== 'strength' || !Array.isArray(detail.exercises)) return []
      return (detail.exercises as Array<{ name?: unknown }>)
        .map((e) => (typeof e.name === 'string' ? e.name : ''))
        .filter((n) => n !== '')
    })

  const LEG_WORDS = ['深蹲', '腿', '硬拉', '弓步', '臀', '提踵', '蹬']
  const hasLegs = recentNames.some((n) => LEG_WORDS.some((w) => n.includes(w)))
  const advice =
    rawWorkouts.length === 0
      ? '还没有训练记录。记几次之后这里会根据你练了什么给建议。'
      : hasLegs
        ? `最近四周记了 ${recentNames.length} 个动作，下肢有练到。保持。`
        : '最近四周的记录里没有下肢动作。下次把深蹲或硬拉排在第一个。'

  return (
    <div className="bg-paper flex h-dvh flex-col overflow-hidden">
      <div className="pt-safe flex-none" />

      <header className="flex-none px-[22px] pt-[6px]">
        <div className="flex items-baseline gap-[9px]">
          <h1 className="font-heading text-ds-24 font-semibold leading-none">我的进展</h1>
          <span className="text-ds-8.5 tracking-ds-wide text-neutral-700 uppercase">Progress</span>
        </div>
        <ThickThinRule />
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-[22px] pb-[20px]">
        <section className="pt-[18px]">
          <div className="text-ds-9.5 tracking-ds-label text-neutral-700 uppercase">体型档位</div>
          <div className="mt-[8px] flex items-baseline gap-[8px]">
            <span className="font-heading text-ds-26 font-semibold">{stage} 档</span>
            <span className="text-ds-14 text-neutral-800">{stageName(stage)}</span>
          </div>
          <div className="mt-[12px]">
            <StageProgress totalTrainedDays={totalTrained} segmentHeight={12} gap={4} />
          </div>
          <div className="text-ds-12 mt-[9px] text-neutral-800">
            {remaining === null
              ? `已是最高档 · 累计 ${totalTrained} 次`
              : `再练 ${remaining} 次进 ${stage + 1} 档 · 只涨不跌`}
          </div>
        </section>

        <section className="pt-[26px]">
          <div className="text-ds-9.5 tracking-ds-label text-neutral-700 uppercase">
            出刊记录 · 近十二周
          </div>
          <div className="mt-[8px] flex items-baseline gap-[8px]">
            <span className="font-heading text-ds-26 font-semibold">第 {streak} 期</span>
            <span className="text-ds-13 text-neutral-800">连续 {streak} 天</span>
          </div>
          <div className="mt-[12px] flex gap-[3px]" aria-hidden="true">
            {weeks.map((days, w) => (
              <div key={w} className="flex flex-1 flex-col gap-[3px]">
                {days.map((d) => (
                  <div
                    key={d}
                    className={`h-[7px] rounded-[1px] ${
                      d === today && published.has(d)
                        ? 'bg-accent'
                        : published.has(d)
                          ? 'bg-neutral-800'
                          : 'bg-neutral-300'
                    }`}
                  />
                ))}
              </div>
            ))}
          </div>
        </section>

        <section className="pt-[26px]">
          <div className="bg-surface rounded-ds-md flex flex-col gap-ds-2 p-ds-3">
            <div className="text-ds-10 tracking-ds-h6 text-accent uppercase">训练建议</div>
            <div className="font-heading text-ds-17 font-semibold leading-tight">{advice}</div>
            <div className="text-ds-11 text-ink/50">依据：训练记录 · 不看照片、不评价外貌</div>
          </div>

          <Link
            href="/plan"
            className="bg-surface rounded-ds-md mt-[14px] flex flex-col gap-ds-2 p-ds-3"
          >
            <div className="text-ds-10 tracking-ds-h6 text-accent uppercase">训练计划</div>
            <div className="font-heading text-ds-17 font-semibold leading-tight">
              按你的记录排的一周计划
            </div>
            <div className="text-ds-11 text-ink/50">想改直接跟它说 →</div>
          </Link>
        </section>

        <button
          type="button"
          disabled
          aria-label="身材记录（即将上线）"
          className="border-divider mt-[22px] flex min-h-[52px] w-full cursor-not-allowed items-center justify-between gap-[12px] border-t py-[14px] opacity-45"
        >
          <span className="flex flex-col gap-[3px] text-left">
            <span className="text-ds-15 leading-none">身材记录</span>
            <span className="text-ds-11 text-neutral-800">私密 · 每周一次 · 朋友看不到</span>
          </span>
          <span className="text-ds-17 text-neutral-700">→</span>
        </button>
      </div>

      <BottomNav current="progress" />
      <div className="pb-safe bg-paper flex-none" />
    </div>
  )
}
