'use client'

import { useEffect } from 'react'
import { SELF_AVATAR_KEY } from '@/lib/avatars'
import { stateName, type Stage, type State } from '@/lib/logic'
import { Avatar } from './Avatar'

/**
 * 出刊页 —— 提交后的全屏反馈。设计稿里唯一「炸一下」的地方之一：
 * 小人升上来、状态印章砸上去、期号翻一格。
 *
 * 动画全部受 globals.css 里的 prefers-reduced-motion 规则约束
 * （dev-spec 第 10 节）—— 关掉动效时直接显示终态，信息一样不少。
 *
 * 注意：这是「出刊」反馈，不是 dev-spec Phase 2 第 8 项的升档动画。
 * 升档（1→2 档）那一下没做。
 */
const REVEAL_LINE: Record<State, string> = {
  energetic: '睡够了，水也喝上了 —— 朋友那一排里，你今天精神。',
  tired: '今天有点蔫。只是今天 —— 体型档位不会掉。',
  neutral: '记下了。这一期出了，连续没断。',
}

const STAMP_TONE: Record<State, string> = {
  energetic: 'text-accent-700 bg-accent-100',
  neutral: 'text-ink bg-transparent',
  tired: 'text-neutral-700 bg-neutral-200',
}

export function RevealOverlay({
  issue,
  state,
  stage,
  onDone,
}: {
  issue: number
  state: State
  stage: Stage
  onDone: () => void
}) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2400)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={onDone}
      className="animate-fade-in bg-paper fixed inset-0 z-40 flex cursor-default flex-col items-center justify-center px-[30px]"
    >
      <div className="relative h-[400px] w-[200px]">
        <div className="animate-rise-in absolute inset-0">
          <Avatar avatarKey={SELF_AVATAR_KEY} stage={stage} state={state} alt="" priority />
        </div>
        <div
          className={`animate-stamp-in font-heading text-ds-26 rounded-ds-md absolute right-[-12px] top-[34px] inline-flex whitespace-nowrap border-2 border-current pb-[9px] pl-[14px] pr-[14px] pt-[8px] font-semibold ${STAMP_TONE[state]}`}
        >
          {stateName(state)}
        </div>
      </div>

      <div className="animate-rise-in-late mt-[26px] text-center">
        <div className="font-heading text-ds-24 font-semibold leading-[1.2]">
          第 {issue} 期已出刊
        </div>
        <div className="text-ds-13 mt-[9px] text-neutral-700">{REVEAL_LINE[state]}</div>
      </div>
    </div>
  )
}
