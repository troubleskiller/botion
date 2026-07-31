'use server'

import { revalidatePath } from 'next/cache'
import { AiError, AI_MODEL_NAME, checkRateLimit } from '@/lib/ai'
import { shiftDate, todayInZone } from '@/lib/date'
import { computeStage } from '@/lib/logic'
import { asChatMessage, PlanSchema, type Plan } from '@/lib/plan'
import { generatePlan, revisePlan, type PlanContext } from '@/lib/plan-ai'
import { createClient } from '@/lib/supabase/server'

export type PlanResult =
  | { ok: true; plan: Plan; reply?: string }
  | { ok: false; message: string }

/** 把这个人的情况拼出来喂给模型。全部读自己的行，RLS 保证拿不到别人的。 */
async function buildContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  request?: string,
): Promise<PlanContext> {
  const [profileResult, entriesResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name, sex, birth_year, height_cm, time_zone')
      .eq('id', userId)
      .maybeSingle(),
    supabase.from('entries').select('date, trained').eq('trained', true),
  ])

  const profile = profileResult.data
  const rawTz: unknown = profile?.time_zone
  const timeZone = typeof rawTz === 'string' && rawTz !== '' ? rawTz : null
  const today = todayInZone(new Date(), timeZone)
  const fourWeeksAgo = shiftDate(today, -28)

  const rows: Array<{ date?: unknown }> = entriesResult.data ?? []
  const dates = rows
    .map((r) => (typeof r.date === 'string' ? r.date : null))
    .filter((d) => d !== null)

  const totalTrained = dates.length
  const recentTrained = dates.filter((d) => d >= fourWeeksAgo).length

  const sex: unknown = profile?.sex
  const birthYear: unknown = profile?.birth_year
  const heightCm: unknown = profile?.height_cm

  return {
    displayName: typeof profile?.display_name === 'string' ? profile.display_name : '朋友',
    sex: sex === 'male' || sex === 'female' ? sex : null,
    age: typeof birthYear === 'number' ? Number(today.slice(0, 4)) - birthYear : null,
    heightCm: typeof heightCm === 'number' ? heightCm : null,
    stage: computeStage(totalTrained),
    totalTrained,
    recentTrained,
    ...(request === undefined ? {} : { request }),
  }
}

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user === null) return null
  return { supabase, user }
}

/** 生成（或重新生成）一份计划。会覆盖现有的。 */
export async function createPlan(request?: string): Promise<PlanResult> {
  const session = await requireUser()
  if (session === null) return { ok: false, message: '登录过期了，重新登录一下' }
  const { supabase, user } = session

  try {
    checkRateLimit(user.id)
    const context = await buildContext(supabase, user.id, request)
    const plan = await generatePlan(context)

    const { error } = await supabase.from('training_plans').upsert(
      { user_id: user.id, plan, model: AI_MODEL_NAME, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
    if (error !== null) return { ok: false, message: `没存上：${error.message}` }

    revalidatePath('/plan')
    return { ok: true, plan }
  } catch (err) {
    if (err instanceof AiError) return { ok: false, message: err.message }
    return { ok: false, message: '排计划的时候出错了，再试一次' }
  }
}

/** 跟 AI 对话调整计划。返回改完的计划和一句回话，同时把这轮对话存下来。 */
export async function chatAboutPlan(message: string): Promise<PlanResult> {
  const text = message.trim()
  if (text === '') return { ok: false, message: '说点什么再发' }
  if (text.length > 500) return { ok: false, message: '一次说短一点，500 字以内' }

  const session = await requireUser()
  if (session === null) return { ok: false, message: '登录过期了，重新登录一下' }
  const { supabase, user } = session

  const { data: row } = await supabase
    .from('training_plans')
    .select('plan')
    .eq('user_id', user.id)
    .maybeSingle()

  const parsed = PlanSchema.safeParse(row?.plan)
  if (!parsed.success) {
    return { ok: false, message: '还没有计划可以改。先让它生成一份' }
  }

  try {
    checkRateLimit(user.id)

    const { data: historyRows } = await supabase
      .from('plan_messages')
      .select('role, content')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(20)

    const rawHistory: unknown[] = historyRows ?? []
    const history = rawHistory.map(asChatMessage).filter((m) => m !== null)

    const revision = await revisePlan(parsed.data, history, text)

    const { error } = await supabase.from('training_plans').upsert(
      {
        user_id: user.id,
        plan: revision.plan,
        model: AI_MODEL_NAME,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    if (error !== null) return { ok: false, message: `改是改好了，但没存上：${error.message}` }

    await supabase.from('plan_messages').insert([
      { user_id: user.id, role: 'user', content: text },
      { user_id: user.id, role: 'assistant', content: revision.reply },
    ])

    revalidatePath('/plan')
    return { ok: true, plan: revision.plan, reply: revision.reply }
  } catch (err) {
    if (err instanceof AiError) return { ok: false, message: err.message }
    return { ok: false, message: '改计划的时候出错了，再试一次' }
  }
}

/** 清掉对话记录。计划本身不动。 */
export async function clearPlanChat(): Promise<{ ok: boolean }> {
  const session = await requireUser()
  if (session === null) return { ok: false }
  await session.supabase.from('plan_messages').delete().eq('user_id', session.user.id)
  revalidatePath('/plan')
  return { ok: true }
}
