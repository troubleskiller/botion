import { redirect } from 'next/navigation'
import { PlanScreen } from '@/components/PlanScreen'
import { todayInZone } from '@/lib/date'
import { asChatMessage, PlanSchema } from '@/lib/plan'
import { createClient } from '@/lib/supabase/server'

/**
 * 训练计划页。
 *
 * 计划和对话都只有本人读得到（0005 迁移的 RLS），一个字都不进
 * public_status —— 计划里可能带伤病、训练偏好这类信息。
 */
export default async function PlanPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user === null) redirect('/login')

  const [profileResult, planResult, messagesResult] = await Promise.all([
    supabase.from('profiles').select('time_zone').eq('id', user.id).maybeSingle(),
    supabase.from('training_plans').select('plan').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('plan_messages')
      .select('role, content')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(40),
  ])

  const rawTz: unknown = profileResult.data?.time_zone
  const timeZone = typeof rawTz === 'string' && rawTz !== '' ? rawTz : null
  const today = todayInZone(new Date(), timeZone)

  const parsed = PlanSchema.safeParse(planResult.data?.plan)
  const rawMessages: unknown[] = messagesResult.data ?? []

  return (
    <PlanScreen
      today={today}
      initialPlan={parsed.success ? parsed.data : null}
      initialMessages={rawMessages.map(asChatMessage).filter((m) => m !== null)}
    />
  )
}
