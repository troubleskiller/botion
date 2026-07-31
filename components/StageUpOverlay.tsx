'use client'

import { useEffect, useState } from 'react'
import { stageName, type Stage } from '@/lib/logic'
import { Avatar } from './Avatar'

/**
 * 升档动画 —— dev-spec 第 8 节：「这是产品里唯一该『炸一下』的地方。」
 *
 * 全屏遮罩 + 新旧形象交叉淡入 + 轻微弹跳 + navigator.vibrate()。
 * 交叉淡入之所以成立，是因为四档素材的头顶和脚底像素级对齐
 * （npm run verify:avatars 盯着这件事）—— 不对齐的话人会在换档瞬间跳一下，
 * 那就不是「炸一下」而是「闪了一下」。
 *
 * 尊重 prefers-reduced-motion（第 8 节和第 10 节都写了）：
 * 关掉动效时直接显示新形象，不淡入、不弹跳、不震动。
 */
export function StageUpOverlay({
  from,
  to,
  avatarKey,
  totalTrainedDays,
  onDone,
}: {
  from: Stage
  to: Stage
  avatarKey: string
  totalTrainedDays: number
  onDone: () => void
}) {
  // 起手先显示旧形象，下一帧再切到新的，让 CSS 过渡有东西可插值
  const [showNew, setShowNew] = useState(false)

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduced) {
      setShowNew(true)
    } else {
      // 震动是锦上添花：iOS Safari 目前不支持 navigator.vibrate，
      // 支持的设备上给一记短震，不支持的什么都不发生
      navigator.vibrate?.([18, 60, 34])
      const raf = requestAnimationFrame(() => setShowNew(true))
      return () => cancelAnimationFrame(raf)
    }
    return undefined
  }, [])

  useEffect(() => {
    const timer = setTimeout(onDone, 4200)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={onDone}
      className="animate-fade-in bg-paper fixed inset-0 z-50 flex cursor-default flex-col items-center justify-center px-[30px]"
    >
      <div className="text-ds-9.5 tracking-ds-label text-accent uppercase">升档</div>

      <div className="relative mt-[14px] h-[400px] w-[220px]">
        {/* 旧形象在下，新形象叠在上面淡入。两张图共用同一个盒子，
            素材基线又对齐，所以人不会移动，只是「长开了」。 */}
        <div
          className="absolute inset-0 transition-opacity duration-[900ms] ease-out motion-reduce:transition-none"
          style={{ opacity: showNew ? 0 : 1 }}
        >
          <Avatar avatarKey={avatarKey} stage={from} state="neutral" alt="" priority />
        </div>
        <div
          className="absolute inset-0 transition-opacity duration-[900ms] ease-out motion-reduce:transition-none"
          style={{ opacity: showNew ? 1 : 0 }}
        >
          <Avatar avatarKey={avatarKey} stage={to} state="energetic" alt="" priority />
        </div>
      </div>

      <div className="animate-rise-in-late mt-[22px] text-center">
        <div className="flex items-baseline justify-center gap-[8px]">
          <span className="text-ds-19 text-neutral-700 line-through">{from} 档</span>
          <span className="text-ds-19 text-neutral-700">→</span>
          <span className="font-heading text-ds-32 tracking-ds-heading font-semibold">
            {to} 档
          </span>
        </div>
        <div className="font-heading text-ds-22 mt-[6px] font-semibold">{stageName(to)}</div>
        <p className="text-ds-13 mt-[10px] text-neutral-700">
          累计练了 {totalTrainedDays} 次。档位只涨不跌 —— 这一档不会再掉回去了。
        </p>
      </div>
    </div>
  )
}
