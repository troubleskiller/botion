import { chatJson, type AiMessage } from './ai'
import { PlanRevisionSchema, PlanSchema, planToText, type Plan, type PlanRevision } from './plan'

/**
 * 训练计划的提示词。集中放在这里，不散到各个 action 里 ——
 * 这是产品口气的一部分，改它等于改产品。
 */

/** 排计划时告诉模型的那个人的情况。全是可空的，因为 profiles 里大多没填。 */
export type PlanContext = {
  displayName: string
  sex: 'male' | 'female' | null
  age: number | null
  heightCm: number | null
  /** 体型档位 1..4 */
  stage: number
  /** 累计训练次数 */
  totalTrained: number
  /** 最近 28 天练了几次 */
  recentTrained: number
  /** 本人补充的要求，比如「没有器械」「膝盖不好」 */
  request?: string
}

const SHARED_RULES = `
规则：
- days 必须正好 7 项，weekday 从 1 到 7（1 = 周一）
- 休息日的 focus 写「休息」，exercises 留空数组
- 每天动作不超过 6 个
- 有氧类动作 sets 用 null，reps 写时长（如「30 分钟」）
- 全部用中文，动作用国内健身房常见的叫法
- 不要评价对方的身材、体重或外貌
- 不要下医疗判断。对方提到伤病就把相关部位的强度降下来并在 note 里说明，
  同时建议他找专业人士看，但不要诊断
- 强度按对方现在的水平排，宁可保守 —— 排太重会让人第二周就放弃
`.trim()

function describe(context: PlanContext): string {
  const bits: string[] = []
  bits.push(`名字：${context.displayName}`)
  if (context.sex !== null) bits.push(`性别：${context.sex === 'male' ? '男' : '女'}`)
  if (context.age !== null) bits.push(`年龄：${context.age}`)
  if (context.heightCm !== null) bits.push(`身高：${context.heightCm} cm`)
  bits.push(`体型档位：第 ${context.stage} 档（共 4 档，按累计训练次数只涨不跌）`)
  bits.push(`累计训练 ${context.totalTrained} 次，最近四周练了 ${context.recentTrained} 次`)
  if (context.request) bits.push(`他自己的要求：${context.request}`)
  return bits.join('\n')
}

/** 首次生成一份周计划 */
export async function generatePlan(context: PlanContext): Promise<Plan> {
  const messages: AiMessage[] = [
    {
      role: 'system',
      content: `你是健身教练，为一个二十人朋友圈里的普通人排一周训练计划。对方不是运动员，是想把习惯坚持下来的普通人。

只返回合法 JSON，不要 markdown 围栏，不要前言：
{
  "title": "计划的名字，不超过 20 字",
  "note": "一两句话说明为什么这么排",
  "days": [
    { "weekday": 1, "focus": "下肢", "exercises": [
        { "name": "深蹲", "sets": 5, "reps": "5", "note": "" }
    ]}
  ]
}

${SHARED_RULES}`,
    },
    { role: 'user', content: `给这个人排一周计划：\n\n${describe(context)}` },
  ]

  return chatJson(PlanSchema, messages, { maxTokens: 3000 })
}

/** 用户在 App 里跟 AI 对话调整计划 */
export async function revisePlan(
  current: Plan,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  request: string,
): Promise<PlanRevision> {
  const messages: AiMessage[] = [
    {
      role: 'system',
      content: `你在帮一个人调整他自己的训练计划。他说想改什么，你改完之后返回整份计划。

只返回合法 JSON，不要 markdown 围栏，不要前言：
{
  "reply": "一两句话说明你改了什么，不超过 60 字",
  "plan": { "title": "...", "note": "...", "days": [ ...完整的 7 天... ] }
}

${SHARED_RULES}
- plan 必须是完整的七天，不是差异。只改他要求的部分，其余原样保留
- reply 用中文，直接说改了什么，不要客套`,
    },
    { role: 'assistant', content: `他现在的计划是：\n\n${planToText(current)}` },
    // 只带最近几轮，够上下文又不至于把 token 撑爆
    ...history.slice(-6).map((m) => ({ role: m.role, content: m.content }) as AiMessage),
    { role: 'user', content: request },
  ]

  return chatJson(PlanRevisionSchema, messages, { maxTokens: 3000 })
}
