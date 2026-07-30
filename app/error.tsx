'use client'

import { ThickThinRule } from '@/components/Rule'

/**
 * 失败态 —— dev-spec 第 10 节：所有网络请求有加载态和失败态，失败可重试。
 * 文案说清发生了什么和怎么修复，不道歉、不含糊。
 */
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="bg-paper min-h-dvh px-[22px] pb-ds-8 pt-safe">
      <header className="pt-ds-2">
        <div className="flex items-baseline gap-[9px]">
          <span className="font-heading text-ds-27 tracking-ds-display font-semibold">练报</span>
          <span className="text-ds-8.5 tracking-ds-kicker text-neutral-700 uppercase">
            Daily Rep
          </span>
        </div>
        <ThickThinRule />
      </header>

      <section className="pt-ds-8">
        <h1 className="text-ds-22 tracking-ds-display">这一期没取到</h1>
        <p className="text-ds-13 mt-ds-2 text-neutral-800">
          数据没读回来，你的记录还在库里，没丢。多半是网络断了一下。
        </p>
        <p className="text-ds-12 mt-ds-2 text-neutral-700">{error.message}</p>

        <button
          type="button"
          onClick={reset}
          className="bg-accent text-paper hover:bg-accent-600 active:bg-accent-700 font-heading text-ds-16 mt-ds-4 rounded-ds-md flex h-[50px] w-full items-center justify-center font-semibold"
        >
          再取一次
        </button>
      </section>
    </main>
  )
}
