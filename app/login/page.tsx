'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ThickThinRule } from '@/components/Rule'
import { createClient } from '@/lib/supabase/client'

/**
 * Magic Link 登录 —— dev-spec 第 1 节：20 个朋友，不需要密码、不需要 OAuth。
 *
 * 设计稿没有这一屏（P0 只画了首页和打卡）。这里按设计系统的版面语言重建：
 * 报头 + 粗细双线、左对齐、留白分区、不用框不用卡片、青色是唯一的交互色。
 */
type Phase =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; email: string }
  /** 邮件没发出去 */
  | { kind: 'sendFailed'; message: string }
  /** 邮件发出去了，但点回来的那条链接没通过校验 */
  | { kind: 'linkFailed'; message: string }

export default function LoginPage() {
  const searchParams = useSearchParams()
  const callbackError = searchParams.get('error')

  const [email, setEmail] = useState('')
  const [phase, setPhase] = useState<Phase>(
    callbackError !== null ? { kind: 'linkFailed', message: callbackError } : { kind: 'idle' },
  )

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const address = email.trim()
    if (address === '') return

    setPhase({ kind: 'sending' })
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })

    if (error !== null) {
      setPhase({ kind: 'sendFailed', message: error.message })
      return
    }
    setPhase({ kind: 'sent', email: address })
  }

  const sending = phase.kind === 'sending'

  return (
    <main className="min-h-dvh px-[22px] pb-ds-8 pt-safe">
      <header className="pt-ds-2">
        <div className="flex items-baseline gap-[9px]">
          <span className="font-heading text-ds-27 tracking-ds-display font-semibold">练报</span>
          <span className="text-ds-8.5 tracking-ds-kicker text-neutral-700 uppercase">
            Daily Rep
          </span>
        </div>
        <ThickThinRule />
      </header>

      {phase.kind === 'sent' ? (
        <section className="pt-ds-8">
          <h1 className="text-ds-22 tracking-ds-display">链接发去 {phase.email} 了</h1>
          <p className="text-ds-13 mt-ds-3 text-neutral-800">
            打开邮件点那条链接就登录了。请在这台设备上打开 —— 登录凭据留在当前浏览器里，
            换设备点会失败。
          </p>
          <button
            type="button"
            onClick={() => setPhase({ kind: 'idle' })}
            className="text-accent hover:bg-accent/10 active:bg-accent/[.18] font-heading text-ds-13 mt-ds-4 -ml-ds-1 rounded-ds-md px-ds-1 min-h-[44px] font-semibold"
          >
            换个邮箱
          </button>
        </section>
      ) : (
        <form onSubmit={send} className="pt-ds-8">
          <h1 className="text-ds-22 tracking-ds-display">用邮箱登录</h1>
          <p className="text-ds-13 mt-ds-2 text-neutral-800">
            填邮箱，我发一条链接过去，点开就进来了。不用设密码。
          </p>

          <div className="mt-ds-6">
            <label htmlFor="email" className="text-ds-12 mb-ds-1 block text-neutral-800">
              邮箱
            </label>
            <input
              id="email"
              type="email"
              name="email"
              required
              autoComplete="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode="email"
              value={email}
              disabled={sending}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              /* 字号 16px 而非设计系统的 14px：iOS Safari 会给小于 16px 的输入框
                 自动放大页面。高度 48px 而非 36px：移动端触摸目标下限。 */
              className="bg-surface border-divider caret-accent hover:border-ink/45 focus-visible:border-accent placeholder:text-ink/65 rounded-ds-md min-h-[48px] w-full border px-ds-2 text-[16px] focus-visible:outline-offset-0 disabled:opacity-45"
            />
          </div>

          {/* 两种失败说两种话：邮件没发出去，和链接点回来没通过校验 ——
              修复办法完全不同（第 10 节：错误说清发生了什么和怎么修复） */}
          {phase.kind === 'sendFailed' ? (
            <p role="alert" className="text-ds-12.5 mt-ds-2 text-accent2-700">
              没发出去：{phase.message}。检查一下邮箱地址，再点一次。
            </p>
          ) : null}
          {phase.kind === 'linkFailed' ? (
            <p role="alert" className="text-ds-12.5 mt-ds-2 text-accent2-700">
              这条链接用不了：{phase.message}。链接只能用一次、而且要在发出它的这台设备上打开。
              填邮箱重新发一条。
            </p>
          ) : null}

          <button
            type="submit"
            disabled={sending || email.trim() === ''}
            className="bg-accent text-paper hover:bg-accent-600 active:bg-accent-700 font-heading text-ds-16 mt-ds-4 rounded-ds-md flex h-[50px] w-full items-center justify-center font-semibold disabled:cursor-not-allowed disabled:opacity-45"
          >
            {sending ? '正在发…' : '发登录链接'}
          </button>
        </form>
      )}
    </main>
  )
}
