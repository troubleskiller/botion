'use server'

import { revalidatePath } from 'next/cache'
import { MealAnalysisSchema, type MealSlot } from '@/lib/meal'
import type { IsoDate } from '@/lib/date'
import { createClient } from '@/lib/supabase/server'

export type MealResult = { ok: true } | { ok: false; message: string }

/**
 * 存一餐。
 *
 * 注意：**照片本身不入库。** dev-spec 第 4.4 节规划了 meal-photos 私有桶 +
 * 60 秒 signed URL，但那要先建桶和 storage 策略。为了今晚能上线先跳过 ——
 * 分析结果（逐项、总量、区间）才是热量视图要用的东西，照片是回看用的。
 * photo_path 字段留着，等建好桶补上即可。
 *
 * 热量不影响小人（第 5 节规则 5）—— 吃多了不会让小人变蔫。
 */
export async function saveMeal(input: {
  date: IsoDate
  slot: MealSlot
  transcript: string
  analysis: unknown
  userAdjusted: boolean
}): Promise<MealResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user === null) return { ok: false, message: '登录过期了，重新登录一下' }

  const parsed = MealAnalysisSchema.safeParse(input.analysis)
  if (!parsed.success) return { ok: false, message: '这份结果不完整，重新分析一次' }
  const a = parsed.data

  const { error } = await supabase.from('meals').insert({
    user_id: user.id,
    date: input.date,
    slot: input.slot,
    transcript: input.transcript.slice(0, 400),
    items: a.items,
    kcal: Math.round(a.total.kcal),
    protein_g: Math.round(a.total.protein_g),
    carbs_g: Math.round(a.total.carbs_g),
    fat_g: Math.round(a.total.fat_g),
    kcal_low: Math.round(a.range.kcal_low),
    kcal_high: Math.round(a.range.kcal_high),
    user_adjusted: input.userAdjusted,
  })

  if (error !== null) return { ok: false, message: `没存上：${error.message}` }

  revalidatePath('/meals')
  return { ok: true }
}

export async function deleteMeal(id: string): Promise<MealResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('meals').delete().eq('id', id)
  if (error !== null) return { ok: false, message: `没删掉：${error.message}` }
  revalidatePath('/meals')
  return { ok: true }
}
