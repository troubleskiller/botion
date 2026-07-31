import { NextResponse, type NextRequest } from 'next/server'
import { AiError, chatJson, checkRateLimit, type AiMessage } from '@/lib/ai'
import { MealAnalysisSchema } from '@/lib/meal'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/analyze-meal —— dev-spec 第 6.1 节。
 *
 * 输入 { imageBase64, mediaType, transcript }，输出结构化营养数据。
 *
 * system prompt 基本照抄第 6.1 节给的那份（换成了 tokenfree 网关 +
 * gpt-5.6-terra，按你的指定）。里面有两条是产品底线，别删：
 *   - 用户口述的份量覆盖模型的视觉估计
 *   - 不评价这顿饭健不健康，不评价用户的身体
 *
 * 图片在客户端压到长边 ≤1568px 再传（省流量也省 token），这里再挡一次大小。
 */
const MAX_IMAGE_BYTES = 4_000_000

const SYSTEM_PROMPT = `You are a nutrition estimation assistant. Analyze the food photo and the
user's spoken description of portion size.

Return ONLY valid JSON, no markdown fences, no preamble:
{
  "items": [{
    "name": "steamed white rice",
    "portion_estimate": "1.5 cups cooked",
    "grams": 240,
    "confidence": "high" | "medium" | "low",
    "kcal": 312, "protein_g": 6, "carbs_g": 68, "fat_g": 1
  }],
  "total": { "kcal": 680, "protein_g": 42, "carbs_g": 78, "fat_g": 22 },
  "range": { "kcal_low": 560, "kcal_high": 820 },
  "scale_reference": "hand visible, used for scale" | "none detected",
  "notes": "brief note on what was uncertain"
}

Rules:
- The user's spoken portion description OVERRIDES your visual estimate.
- If no scale reference is visible and the user gave no portion info,
  mark confidence "low" and widen the range accordingly.
- Do NOT comment on whether the meal is healthy, or on the user's body.
- Never invent items you cannot see.
- Write "name" and "notes" in Chinese; keep the JSON keys exactly as shown.`

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user === null) {
    return NextResponse.json({ message: '登录过期了，重新登录一下' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: '请求格式不对' }, { status: 400 })
  }

  const b = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
  const imageBase64 = typeof b.imageBase64 === 'string' ? b.imageBase64 : ''
  const mediaType = typeof b.mediaType === 'string' ? b.mediaType : 'image/jpeg'
  const transcript = typeof b.transcript === 'string' ? b.transcript.slice(0, 400) : ''

  if (imageBase64 === '') {
    return NextResponse.json({ message: '没收到照片' }, { status: 400 })
  }
  if (imageBase64.length > MAX_IMAGE_BYTES) {
    return NextResponse.json({ message: '照片太大了，换一张' }, { status: 413 })
  }

  try {
    checkRateLimit(user.id)

    const messages: AiMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              transcript === ''
                ? '这是我这一餐。我没有说份量，请按照片估计，并把 confidence 标低、区间放宽。'
                : `这是我这一餐。我说的份量是：${transcript}`,
          },
          { type: 'image_url', image_url: { url: `data:${mediaType};base64,${imageBase64}` } },
        ],
      },
    ]

    const analysis = await chatJson(MealAnalysisSchema, messages, { maxTokens: 2000 })
    return NextResponse.json({ analysis })
  } catch (err) {
    // 解析失败返回可读错误，不抛裸异常（第 6.1 节）
    const message =
      err instanceof AiError ? err.message : '没认出来，手动填一下或者换张照片再试'
    return NextResponse.json({ message }, { status: 422 })
  }
}
