'use client'

import { useState } from 'react'
import { ThickThinRule } from '@/components/Rule'
import { createClient } from '@/lib/supabase/client'

/**
 * 邮箱 + 密码登录。
 *
 * 这里刻意没有注册入口 —— 20 个人的封闭圈，账号一律由管理员在
 * scripts/manage-users.mjs 里建好，密码直接发给本人。陌生人没有入口，
 * 也就不需要 dev-spec 第 0 节明确不做的那套注册引导流程。
 *
 * 也没有「忘了密码」。忘了就找建号的人重设（npm run users:reset）——
 * 做邮件重置等于把邮件链接那套依赖又请回来。
 *
 * autoComplete 用的是标准值，iOS 会主动问要不要存进钥匙串。
 * 存了之后朋友再也不用手打那串密码，这是这一屏最重要的一件事。
 *
 * 设计稿没有这一屏，按设计系统的版面语言重建：报头 + 粗细双线、左对齐、
 * 留白分区、不用框不用卡片。
 */
type Phase = { kind: 'idle' } | { kind: 'signing' } | { kind: 'failed'; message: string }

/** 把 Supabase 的英文错误换成能照着做的中文 */
function readableError(message: string): string {
  if (/invalid login credentials/i.test(message)) {
    return '邮箱或密码不对。密码可以直接粘贴，注意别把首尾的空格带进来'
  }
  if (/email not confirmed/i.test(message)) {
    return '这个账号还没启用，找建号的人看一下'
  }
  if (/too many requests|rate limit/i.test(message)) {
    return '试得太频繁了，等一分钟再来'
  }
  return message
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const address = email.trim()
    if (address === '' || password === '') return

    setPhase({ kind: 'signing' })
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: address,
      password,
    })

    if (error !== null) {
      setPhase({ kind: 'failed', message: readableError(error.message) })
      return
    }

    // 整页跳转而不是路由跳转：会话是 Cookie，整页跳能保证服务端这一次
    // 请求一定带上它，不会撞上 Cookie 还没写完就渲染的竞态
    window.location.assign('/')
  }

  const signing = phase.kind === 'signing'
  const ready = email.trim() !== '' && password !== ''

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

      <form onSubmit={signIn} className="pt-ds-8">
        <h1 className="text-ds-22 tracking-ds-display">登录</h1>
        <p className="text-ds-13 mt-ds-2 text-neutral-800">
          用发给你的那组邮箱和密码。存进钥匙串之后就不用再输了。
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
            autoComplete="username"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="email"
            value={email}
            disabled={signing}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            /* 字号 16px 而非设计系统的 14px：iOS Safari 会给小于 16px 的
               输入框自动放大页面。高度 48px：移动端触摸目标下限 */
            className="bg-surface border-divider caret-accent hover:border-ink/45 focus-visible:border-accent placeholder:text-ink/65 rounded-ds-md min-h-[48px] w-full border px-ds-2 text-[16px] focus-visible:outline-offset-0 disabled:opacity-45"
          />
        </div>

        <div className="mt-ds-3">
          <label htmlFor="password" className="text-ds-12 mb-ds-1 block text-neutral-800">
            密码
          </label>
          <input
            id="password"
            type="password"
            name="password"
            required
            autoComplete="current-password"
            value={password}
            disabled={signing}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="xxxx-xxxx-xxxx"
            className="bg-surface border-divider caret-accent hover:border-ink/45 focus-visible:border-accent placeholder:text-ink/65 rounded-ds-md min-h-[48px] w-full border px-ds-2 text-[16px] focus-visible:outline-offset-0 disabled:opacity-45"
          />
        </div>

        {phase.kind === 'failed' ? (
          <p role="alert" className="text-ds-12.5 mt-ds-2 text-accent2-700">
            {phase.message}。
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!ready || signing}
          className="bg-accent text-paper hover:bg-accent-600 active:bg-accent-700 font-heading text-ds-16 mt-ds-4 rounded-ds-md flex h-[50px] w-full items-center justify-center font-semibold disabled:cursor-not-allowed disabled:opacity-45"
        >
          {signing ? '正在登录…' : '登录'}
        </button>

        <p className="text-ds-12 mt-ds-4 text-neutral-700">
          没有账号，或者密码忘了？找拉你进来的那个人要一个新的。
        </p>
      </form>
    </main>
  )
}
