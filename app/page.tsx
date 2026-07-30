import { redirect } from 'next/navigation'
import type { BandValues } from '@/components/CheckinSheet'
import { HomeScreen } from '@/components/HomeScreen'
import { TimeZoneSync } from '@/components/TimeZoneSync'
import { formatClock, shiftDate, todayInZone, type IsoDate } from '@/lib/date'
import { computeStage, computeState, computeStreak } from '@/lib/logic'
import { createClient } from '@/lib/supabase/server'
import { asEntryLite, asPublicStatusRow } from '@/lib/types'

/**
 * 首页 —— Phase 1 第 3 项：我的小人 + 档位进度 + 朋友横排。
 *
 * 三次查询，三条不同的权限路径：
 *   profiles（自己那行） —— 拿自己的时区，决定「今天」是哪一天
 *   entries              —— 只读得到自己的（RLS）。原始分档值只有本人看得见
 *   public_status        —— 读得到所有人的派生状态，但视图里没有任何原始数据
 * 朋友横排的每一个字都只能来自第三条 —— 这是隐私边界的实现方式。
 *
 * 朋友的「今日」由视图按各人自己的 time_zone 判断，前端拿不到也不需要
 * 知道别人的时区。
 */
export default async function HomePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user === null) redirect('/login')

  const [profileResult, statusResult] = await Promise.all([
    supabase.from('profiles').select('time_zone').eq('id', user.id).maybeSingle(),
    supabase
      .from('public_status')
      .select('user_id, display_name, avatar_key, stage, checked_in_today, state'),
  ])

  if (profileResult.error !== null) throw new Error(profileResult.error.message)
  if (statusResult.error !== null) throw new Error(statusResult.error.message)

  const rawTimeZone: unknown = profileResult.data?.time_zone
  const timeZone = typeof rawTimeZone === 'string' && rawTimeZone !== '' ? rawTimeZone : null

  const today = todayInZone(new Date(), timeZone)
  const yesterday = shiftDate(today, -1)

  const entriesResult = await supabase
    .from('entries')
    .select('date, sleep_band, water_band, trained, created_at')
    .order('date', { ascending: false })

  // 失败就抛给 app/error.tsx，那里有可重试的失败态（dev-spec 第 10 节）
  if (entriesResult.error !== null) throw new Error(entriesResult.error.message)

  const rawEntries: unknown[] = entriesResult.data ?? []
  const entries = rawEntries.map(asEntryLite).filter((e) => e !== null)

  const rawStatus: unknown[] = statusResult.data ?? []
  const friends = rawStatus
    .map(asPublicStatusRow)
    .filter((r) => r !== null)
    .filter((r) => r.user_id !== user.id)
    .sort((a, b) => {
      // 今天出刊的排前面，其余按名字。让「有人在动」先被看到
      if (a.checked_in_today !== b.checked_in_today) return a.checked_in_today ? -1 : 1
      return a.display_name.localeCompare(b.display_name, 'zh-Hans-CN')
    })

  const totalTrainedDays = entries.filter((e) => e.trained).length
  const stage = computeStage(totalTrainedDays)
  const issue = computeStreak(
    entries.map((e) => e.date),
    today,
  )

  const todayEntry = entries.find((e) => e.date === today)
  const yesterdayEntry = entries.find((e) => e.date === yesterday)

  const existing: Partial<Record<IsoDate, BandValues>> = {}
  for (const entry of [todayEntry, yesterdayEntry]) {
    if (entry === undefined) continue
    existing[entry.date] = {
      sleepBand: entry.sleepBand,
      waterBand: entry.waterBand,
      trained: entry.trained,
    }
  }

  return (
    <>
      <TimeZoneSync needsDetection={timeZone === null} />
      <HomeScreen
        today={today}
        yesterday={yesterday}
        issue={issue}
        stage={stage}
        totalTrainedDays={totalTrainedDays}
        state={
          todayEntry === undefined
            ? null
            : computeState(todayEntry.sleepBand, todayEntry.waterBand)
        }
        publishedAt={
          todayEntry?.createdAt === undefined || todayEntry.createdAt === null
            ? null
            : formatClock(todayEntry.createdAt, timeZone)
        }
        existing={existing}
        friends={friends}
      />
    </>
  )
}
