'use server'

import { revalidatePath } from 'next/cache'
import { isWritableDate, todayInZone, type IsoDate } from '@/lib/date'
import { createClient } from '@/lib/supabase/server'

export type PublishResult =
  | { ok: true; totalTrainedDays: number }
  | { ok: false; message: string }

export type PublishInput = {
  date: IsoDate
  sleepBand: number
  waterBand: number
  trained: boolean
}

/**
 * 写入 entries —— Phase 1 第 4 项。
 *
 * 同一天重复出刊是 UPDATE 不是 INSERT：靠 unique(user_id, date) +
 * onConflict 走 upsert（第 11 节验收第 4 条）。
 *
 * 日期窗口这里校验一遍，库里的 RLS 策略再校验一遍。前端的校验是为了给出
 * 能看懂的错误信息，真正的边界在库里 —— 就算这段代码写错了也写不进去
 * （第 11 节验收第 5 条）。
 */
export async function publishEntry(input: PublishInput): Promise<PublishResult> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError !== null || user === null) {
    return { ok: false, message: '登录过期了。回登录页重新发一条链接' }
  }

  // 「今天」按本人时区算 —— 在国外的朋友「昨天」和国内不是同一天。
  // 库里的 RLS 窗口用 user_today()，是同一个定义。
  const { data: profile } = await supabase
    .from('profiles')
    .select('time_zone')
    .eq('id', user.id)
    .maybeSingle()
  const rawTimeZone: unknown = profile?.time_zone
  const timeZone = typeof rawTimeZone === 'string' && rawTimeZone !== '' ? rawTimeZone : null

  const today = todayInZone(new Date(), timeZone)
  if (!isWritableDate(input.date, today)) {
    return { ok: false, message: '只能出今天或昨天的刊，更早的改不了' }
  }
  if (![1, 2, 3, 4].includes(input.sleepBand)) {
    return { ok: false, message: '睡眠时长没选上，再点一次' }
  }
  if (![1, 2, 3].includes(input.waterBand)) {
    return { ok: false, message: '饮水没选上，再点一次' }
  }

  const { error } = await supabase.from('entries').upsert(
    {
      user_id: user.id,
      date: input.date,
      sleep_band: input.sleepBand,
      water_band: input.waterBand,
      trained: input.trained,
      source: 'manual',
    },
    { onConflict: 'user_id,date' },
  )

  if (error !== null) {
    return { ok: false, message: `没存上：${error.message}` }
  }

  // 写完再数一次累计训练次数 —— 前端靠它判断有没有跨档。
  // 不在前端自己加一，因为「把没练改成练了」和「新出一期」加的不一样，
  // 而且补的是昨天的话也会影响累计。让库说了算最省心。
  const { count } = await supabase
    .from('entries')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('trained', true)

  revalidatePath('/')
  return { ok: true, totalTrainedDays: count ?? 0 }
}
