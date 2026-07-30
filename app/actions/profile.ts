'use server'

import { revalidatePath } from 'next/cache'
import { isKnownTimeZone } from '@/lib/date'
import { createClient } from '@/lib/supabase/server'

/**
 * 首次登录时把浏览器探测到的时区写进自己的档案。
 *
 * 为什么只写一次（profiles.time_zone 从 null 变成有值之后就不再动）：
 * 出差旅行会让浏览器报告另一个时区，跟着改就会把「今天」整个挪走，
 * 有可能白断一期 —— 而 dev-spec 第 0 节的首要目标就是让人连用满 10 天。
 * 所以只在还没确定过的时候写，之后固定。
 *
 * 首次登录正好在国外的话，改库里那一行就行 ——「own profile writable」
 * 策略允许本人改自己的档案。
 */
export async function setTimeZoneOnce(timeZone: string): Promise<void> {
  if (!isKnownTimeZone(timeZone)) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user === null) return

  // is('time_zone', null) 让这次写入只在还没确定过时生效。
  // 并发或重复调用都落到同一个结果，不会互相覆盖。
  const { error } = await supabase
    .from('profiles')
    .update({ time_zone: timeZone })
    .eq('id', user.id)
    .is('time_zone', null)

  if (error !== null) return
  revalidatePath('/')
}
