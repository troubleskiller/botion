'use client'

import { useEffect } from 'react'

/**
 * 轻提示 —— 设计稿的 toast：贴在底部导航上方，深墨底纸白字，1.6 秒后消失。
 *
 * 只用在「补了昨天那期」这一种情况：首页说的是今天这一期，补昨天不该放
 * 全屏出刊动画，但也不能点完什么反应都没有。
 * 出错不走这里 —— 错误留在弹层里，说清怎么修复并且能重试（第 10 节）。
 */
export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 1600)
    return () => clearTimeout(timer)
  }, [onDone, message])

  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-fade-in-fast pointer-events-none fixed inset-x-0 bottom-[104px] z-40 flex justify-center"
    >
      <div className="bg-neutral-900 text-paper text-ds-12.5 rounded-ds-md px-[16px] py-[9px]">
        {message}
      </div>
    </div>
  )
}
