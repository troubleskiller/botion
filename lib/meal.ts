import { z } from 'zod'

/**
 * 食物照片的分析结果 —— dev-spec 第 6.1 节。
 *
 * schema 完全照第 6.1 节给的那份 JSON，加了范围约束防止模型给出离谱数字。
 * 校验不过就降级为「无法识别，请手动输入」，不让半截数据进库。
 */
export const MealItemSchema = z.object({
  name: z.string().min(1).max(40),
  portion_estimate: z.string().max(40).default(''),
  grams: z.number().min(0).max(5000).nullable().default(null),
  confidence: z.enum(['high', 'medium', 'low']),
  kcal: z.number().min(0).max(5000),
  protein_g: z.number().min(0).max(400),
  carbs_g: z.number().min(0).max(800),
  fat_g: z.number().min(0).max(400),
})

export const MealAnalysisSchema = z.object({
  items: z.array(MealItemSchema).min(1).max(12),
  total: z.object({
    kcal: z.number().min(0).max(10000),
    protein_g: z.number().min(0).max(800),
    carbs_g: z.number().min(0).max(1600),
    fat_g: z.number().min(0).max(800),
  }),
  range: z.object({
    kcal_low: z.number().min(0).max(10000),
    kcal_high: z.number().min(0).max(12000),
  }),
  scale_reference: z.string().max(80).default(''),
  notes: z.string().max(200).default(''),
})

export type MealItem = z.infer<typeof MealItemSchema>
export type MealAnalysis = z.infer<typeof MealAnalysisSchema>

export const MEAL_SLOTS = [
  { slot: 'breakfast', label: '早餐' },
  { slot: 'lunch', label: '午餐' },
  { slot: 'dinner', label: '晚餐' },
  { slot: 'snack', label: '加餐' },
] as const

export type MealSlot = (typeof MEAL_SLOTS)[number]['slot']

export function slotLabel(slot: string): string {
  return MEAL_SLOTS.find((s) => s.slot === slot)?.label ?? '一餐'
}

/**
 * 按当地时间猜一个默认餐次。猜错了用户点一下就改，
 * 比每次都从「早餐」开始少一次点击。
 */
export function guessSlot(hour: number): MealSlot {
  if (hour < 10) return 'breakfast'
  if (hour < 15) return 'lunch'
  if (hour < 21) return 'dinner'
  return 'snack'
}

/** 份量滑块：把整份结果按倍数缩放，卡路里和三大营养素跟着动 */
export function scaleAnalysis(analysis: MealAnalysis, multipliers: number[]): MealAnalysis {
  const items = analysis.items.map((item, i) => {
    const m = multipliers[i] ?? 1
    return {
      ...item,
      grams: item.grams === null ? null : Math.round(item.grams * m),
      kcal: Math.round(item.kcal * m),
      protein_g: Math.round(item.protein_g * m),
      carbs_g: Math.round(item.carbs_g * m),
      fat_g: Math.round(item.fat_g * m),
    }
  })

  const sum = (key: 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g') =>
    items.reduce((a, it) => a + it[key], 0)

  const kcal = sum('kcal')
  // 区间按原始比例缩放，保持「不确定性随份量一起放大」的直觉
  const ratio = analysis.total.kcal === 0 ? 1 : kcal / analysis.total.kcal

  return {
    ...analysis,
    items,
    total: { kcal, protein_g: sum('protein_g'), carbs_g: sum('carbs_g'), fat_g: sum('fat_g') },
    range: {
      kcal_low: Math.round(analysis.range.kcal_low * ratio),
      kcal_high: Math.round(analysis.range.kcal_high * ratio),
    },
  }
}
