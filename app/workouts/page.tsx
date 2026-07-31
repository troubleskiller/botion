import { redirect } from 'next/navigation'
import type { StrengthExercise, WorkoutDetail, WorkoutKind } from '@/app/actions/workouts'
import { WorkoutScreen, type RecentWorkout } from '@/components/WorkoutScreen'
import { todayInZone } from '@/lib/date'
import { PlanSchema } from '@/lib/plan'
import { createClient } from '@/lib/supabase/server'

const KINDS = ['strength', 'run', 'sport', 'other'] as const

function asKind(value: unknown): WorkoutKind | null {
  return KINDS.find((k) => k === value) ?? null
}

function asDetail(value: unknown): WorkoutDetail {
  if (typeof value !== 'object' || value === null) return { kind: 'plain' }
  const d = value as Record<string, unknown>
  if (d.kind === 'strength' && Array.isArray(d.exercises)) {
    return { kind: 'strength', exercises: d.exercises as StrengthExercise[] }
  }
  if (d.kind === 'cardio') {
    return {
      kind: 'cardio',
      minutes: typeof d.minutes === 'number' ? d.minutes : 0,
      distanceKm: typeof d.distanceKm === 'number' ? d.distanceKm : null,
    }
  }
  return { kind: 'plain' }
}

/** 运动记录。这些数据一律不影响小人 —— dev-spec 第 5 节规则 1。 */
export default async function WorkoutsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user === null) redirect('/login')

  const [profileResult, planResult, workoutsResult] = await Promise.all([
    supabase.from('profiles').select('time_zone').eq('id', user.id).maybeSingle(),
    supabase.from('training_plans').select('plan').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('workouts')
      .select('id, date, kind, detail')
      .order('date', { ascending: false })
      .limit(8),
  ])

  const rawTz: unknown = profileResult.data?.time_zone
  const timeZone = typeof rawTz === 'string' && rawTz !== '' ? rawTz : null
  const today = todayInZone(new Date(), timeZone)

  const parsedPlan = PlanSchema.safeParse(planResult.data?.plan)

  const rawWorkouts: unknown[] = workoutsResult.data ?? []
  const recent: RecentWorkout[] = rawWorkouts
    .map((row) => {
      if (typeof row !== 'object' || row === null) return null
      const r = row as Record<string, unknown>
      const kind = asKind(r.kind)
      if (typeof r.id !== 'string' || typeof r.date !== 'string' || kind === null) return null
      return { id: r.id, date: r.date, kind, detail: asDetail(r.detail) }
    })
    .filter((w) => w !== null)

  const lastStrengthEntry = recent.find((w) => w.detail.kind === 'strength')
  const lastStrength =
    lastStrengthEntry !== undefined && lastStrengthEntry.detail.kind === 'strength'
      ? lastStrengthEntry.detail.exercises
      : null

  return (
    <WorkoutScreen
      today={today}
      plan={parsedPlan.success ? parsedPlan.data : null}
      recent={recent}
      lastStrength={lastStrength === null || lastStrength.length === 0 ? null : lastStrength}
    />
  )
}
