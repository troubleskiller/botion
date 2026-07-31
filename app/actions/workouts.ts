'use server'

import { revalidatePath } from 'next/cache'
import { todayInZone, type IsoDate } from '@/lib/date'
import { createClient } from '@/lib/supabase/server'

/**
 * 运动记录 —— dev-spec 第 9 节 Phase 3 第 10 项。
 *
 * 关键的一条：这些一律不影响小人（第 5 节规则 1）。漏记不会断出刊链，
 * 页头也明说了。所以这里不需要日期窗口 —— 补记上个月的训练完全合理，
 * 它不参与档位计算。
 */
export type WorkoutKind = 'strength' | 'run' | 'sport' | 'other'

export type StrengthExercise = { name: string; sets: number; reps: number; weightKg: number | null }
export type WorkoutDetail =
  | { kind: 'strength'; exercises: StrengthExercise[] }
  | { kind: 'cardio'; minutes: number; distanceKm: number | null }
  | { kind: 'plain' }

export type SaveWorkoutInput = {
  date: IsoDate
  kind: WorkoutKind
  detail: WorkoutDetail
}

export type WorkoutResult = { ok: true } | { ok: false; message: string }

export async function saveWorkout(input: SaveWorkoutInput): Promise<WorkoutResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user === null) return { ok: false, message: '登录过期了，重新登录一下' }

  if (!['strength', 'run', 'sport', 'other'].includes(input.kind)) {
    return { ok: false, message: '类型不对' }
  }

  const { error } = await supabase.from('workouts').insert({
    user_id: user.id,
    date: input.date,
    kind: input.kind,
    detail: input.detail,
  })

  if (error !== null) return { ok: false, message: `没存上：${error.message}` }

  revalidatePath('/workouts')
  return { ok: true }
}

export async function deleteWorkout(id: string): Promise<WorkoutResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('workouts').delete().eq('id', id)
  if (error !== null) return { ok: false, message: `没删掉：${error.message}` }
  revalidatePath('/workouts')
  return { ok: true }
}

/** 「复制上次」用：拿最近一次同类型的记录 */
export async function lastWorkoutOf(kind: WorkoutKind): Promise<WorkoutDetail | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('workouts')
    .select('detail')
    .eq('kind', kind)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const detail: unknown = data?.detail
  if (typeof detail !== 'object' || detail === null) return null
  return detail as WorkoutDetail
}

export async function todayFor(timeZone: string | null): Promise<IsoDate> {
  return todayInZone(new Date(), timeZone)
}
