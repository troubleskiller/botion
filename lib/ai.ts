import type { z } from 'zod'

/**
 * 模型调用 —— 只在服务端用。
 *
 * dev-spec 第 1 节写的是 Anthropic Messages API，按你的指定换成了
 * tokenfree 网关（OpenAI 兼容协议），模型 gpt-5.6-terra，支持看图。
 *
 * AI_API_KEY 没有 NEXT_PUBLIC_ 前缀，所以 Next 不会把它打进客户端包 ——
 * 万一有人从客户端组件 import 这个文件，拿到的是 undefined 而不是密钥。
 * 但别这么干：所有调用都应该发生在 Server Action 或 Route Handler 里。
 */
const BASE_URL = process.env.AI_BASE_URL ?? 'https://api.tokenfree.chat'
const MODEL = process.env.AI_MODEL ?? 'gpt-5.6-terra'

function apiKey(): string {
  const key = process.env.AI_API_KEY
  if (key === undefined || key === '') {
    throw new AiError('模型没配好：缺 AI_API_KEY')
  }
  return key
}

export class AiError extends Error {
  override readonly name = 'AiError'
}

export type TextPart = { type: 'text'; text: string }
export type ImagePart = { type: 'image_url'; image_url: { url: string } }
export type ContentPart = TextPart | ImagePart

export type AiMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string | ContentPart[]
}

/**
 * 速率限制 —— dev-spec 第 6.1 节要求每用户每分钟 10 次。
 *
 * 内存实现，所以在 serverless 上是「每实例每分钟」，不是严格的全局限流。
 * 20 个人的量级够用了；真要严格得往库里记，不值得为这个加一张表。
 */
const RATE_LIMIT = { max: 10, windowMs: 60_000 }
const hits = new Map<string, number[]>()

export function checkRateLimit(userId: string): void {
  const now = Date.now()
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs)
  if (recent.length >= RATE_LIMIT.max) {
    throw new AiError('这一分钟问得太多了，缓一下再来')
  }
  recent.push(now)
  hits.set(userId, recent)
}

/** 模型有时会把 JSON 包在 ``` 围栏里，解析前剥掉（dev-spec 第 6.1 节） */
export function stripFences(raw: string): string {
  const trimmed = raw.trim()
  const fenced = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/.exec(trimmed)
  return (fenced?.[1] ?? trimmed).trim()
}

type CallOptions = {
  /** 传了就走结构化输出，并用这个 schema 校验 */
  maxTokens?: number
  temperature?: number
  signal?: AbortSignal
}

async function call(messages: AiMessage[], options: CallOptions, json: boolean): Promise<string> {
  let response: Response
  try {
    response = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: options.maxTokens ?? 2000,
        ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: options.signal ?? AbortSignal.timeout(120_000),
    })
  } catch (cause) {
    const reason = cause instanceof Error && cause.name === 'TimeoutError' ? '等太久了' : '连不上'
    throw new AiError(`模型${reason}，再试一次`)
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new AiError(`模型返回 ${response.status}${body ? `：${body.slice(0, 200)}` : ''}`)
  }

  const payload: unknown = await response.json().catch(() => null)
  const content =
    typeof payload === 'object' && payload !== null
      ? ((payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]?.message
          ?.content ?? null)
      : null

  if (typeof content !== 'string' || content.trim() === '') {
    throw new AiError('模型没返回内容，再试一次')
  }
  return content
}

/** 要一段普通文本 */
export async function chatText(messages: AiMessage[], options: CallOptions = {}): Promise<string> {
  return call(messages, options, false)
}

/**
 * 要一个符合 schema 的对象。
 *
 * 解析或校验失败不抛裸异常 —— 抛的是能直接显示给用户的 AiError
 * （dev-spec 第 6.1 节：解析失败返回可读错误）。
 */
export async function chatJson<T>(
  schema: z.ZodType<T>,
  messages: AiMessage[],
  options: CallOptions = {},
): Promise<T> {
  const raw = await call(messages, options, true)

  let parsed: unknown
  try {
    parsed = JSON.parse(stripFences(raw))
  } catch {
    throw new AiError('模型返回的不是合法 JSON，再试一次')
  }

  const result = schema.safeParse(parsed)
  if (!result.success) {
    const first = result.error.issues[0]
    const where = first?.path.join('.') ?? ''
    throw new AiError(`模型返回的结构不对${where ? `（${where}）` : ''}，再试一次`)
  }
  return result.data
}

export const AI_MODEL_NAME = MODEL
