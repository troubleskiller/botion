import { redirect } from 'next/navigation'
import { MealScreen, type MealRow } from '@/components/MealScreen'
import { shiftDate, todayInZone, type IsoDate } from '@/lib/date'
import { guessSlot } from '@/lib/meal'
import { createClient } from '@/lib/supabase/server'

/**
 * 饮食记录。整张表只有本人读得到（RLS）——
 * 卡路里、餐食、口述份量一律不进朋友视图。
 *
 * 主指标是七日均值（dev-spec 第 9 节第 13 项）。
 */
export default async function MealsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user === null) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('time_zone')
    .eq('id', user.id)
    .maybeSingle()

  const rawTz: unknown = profile?.time_zone
  const timeZone = typeof rawTz === 'string' && rawTz !== '' ? rawTz : null
  const today = todayInZone(new Date(), timeZone)
  const weekStart = shiftDate(today, -6)

  const { data } = await supabase
    .from('meals')
    .select('id, date, slot, kcal, items')
    .gte('date', weekStart)
    .order('date', { ascending: false })

  const raw: unknown[] = data ?? []
  const meals: MealRow[] = raw
    .map((row) => {
      if (typeof row !== 'object' || row === null) return null
      const r = row as Record<string, unknown>
      if (typeof r.id !== 'string' || typeof r.date !== 'string') return null
      return {
        id: r.id,
        date: r.date,
        slot: typeof r.slot === 'string' ? r.slot : 'snack',
        kcal: typeof r.kcal === 'number' ? r.kcal : null,
        items: r.items,
      }
    })
    .filter((m) => m !== null)

  const weekDays: Array<{ date: IsoDate; kcal: number }> = []
  for (let i = 6; i >= 0; i -= 1) {
    const date = shiftDate(today, -i)
    const kcal = meals
      .filter((m) => m.date === date)
      .reduce((sum, m) => sum + (m.kcal ?? 0), 0)
    weekDays.push({ date, kcal })
  }

  // 均值只算「记过东西的那些天」—— 把没记的天当 0 会把均值压得没意义
  const loggedDays = weekDays.filter((d) => d.kcal > 0)
  const weekAverage =
    loggedDays.length === 0
      ? 0
      : Math.round(loggedDays.reduce((a, d) => a + d.kcal, 0) / loggedDays.length)

  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: timeZone ?? 'Asia/Shanghai',
      hour: '2-digit',
      hour12: false,
    }).format(new Date()),
  )

  return (
    <MealScreen
      today={today}
      defaultSlot={guessSlot(hour)}
      todayMeals={meals.filter((m) => m.date === today)}
      todayKcal={weekDays[weekDays.length - 1]?.kcal ?? 0}
      weekAverage={weekAverage}
      weekDays={weekDays}
    />
  )
}
