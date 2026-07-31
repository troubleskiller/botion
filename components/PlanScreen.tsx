'use client'

import { useRef, useState } from 'react'
import { chatAboutPlan, clearPlanChat, createPlan } from '@/app/actions/plan'
import {
  dayOfPlan,
  isRestDay,
  weekdayName,
  type ChatMessage,
  type Plan,
  type PlanDay,
} from '@/lib/plan'
import type { IsoDate } from '@/lib/date'
import { BottomNav } from './BottomNav'
import { ThickThinRule } from './Rule'

/**
 * 训练计划页。
 *
 * dev-spec 第 9 节原本把训练计划列为 Phase 4 的「占位卡片」，现在做成真的：
 * AI 按本人档位和最近训练频率排一周，本人可以在下面直接跟它说要改什么，
 * 改完立刻覆盖。
 *
 * 版面仍然是设计系统那一套：报头 + 粗细双线、左对齐、留白分区、不用框。
 * 唯一的框是对话气泡 —— 那是对话，不是版面。
 */
export function PlanScreen({
  today,
  initialPlan,
  initialMessages,
}: {
  today: IsoDate
  initialPlan: Plan | null
  initialMessages: ChatMessage[]
}) {
  const [plan, setPlan] = useState<Plan | null>(initialPlan)
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState<'generating' | 'chatting' | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const chatEnd = useRef<HTMLDivElement>(null)

  const todayPlan = plan === null ? null : dayOfPlan(plan, today)

  async function generate() {
    setBusy('generating')
    setFailure(null)
    const result = await createPlan()
    setBusy(null)
    if (!result.ok) {
      setFailure(result.message)
      return
    }
    setPlan(result.plan)
  }

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = draft.trim()
    if (text === '' || busy !== null) return

    setDraft('')
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setBusy('chatting')
    setFailure(null)

    const result = await chatAboutPlan(text)
    setBusy(null)

    if (!result.ok) {
      // 把刚发出去的那条收回来，不然它会孤零零挂在那儿像是发成功了
      setMessages((prev) => prev.slice(0, -1))
      setDraft(text)
      setFailure(result.message)
      return
    }

    setPlan(result.plan)
    if (result.reply !== undefined) {
      setMessages((prev) => [...prev, { role: 'assistant', content: result.reply as string }])
    }
    requestAnimationFrame(() => chatEnd.current?.scrollIntoView({ behavior: 'smooth' }))
  }

  return (
    <div className="bg-paper flex h-dvh flex-col overflow-hidden">
      <div className="pt-safe flex-none" />

      <header className="flex-none px-[22px] pt-[6px]">
        <div className="flex items-baseline justify-between gap-[10px]">
          <div className="flex items-baseline gap-[9px]">
            <h1 className="font-heading text-ds-24 font-semibold leading-none">训练计划</h1>
            <span className="text-ds-8.5 tracking-ds-wide text-neutral-700 uppercase">Plan</span>
          </div>
          <span className="text-ds-11 whitespace-nowrap text-neutral-800">
            只有你能看到
          </span>
        </div>
        <ThickThinRule />
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-[22px] pb-[20px]">
        {plan === null ? (
          <EmptyPlan onGenerate={generate} busy={busy === 'generating'} />
        ) : (
          <>
            <section className="pt-[18px]">
              <div className="text-ds-9.5 tracking-ds-label text-neutral-700 uppercase">今天</div>
              {todayPlan === null ? (
                <p className="text-ds-13 mt-[8px] text-neutral-800">计划里没有今天。</p>
              ) : (
                <TodayBlock day={todayPlan} />
              )}
            </section>

            <section className="pt-[26px]">
              <div className="flex items-baseline justify-between">
                <h2 className="font-heading text-ds-17 font-semibold">{plan.title}</h2>
                <button
                  type="button"
                  onClick={generate}
                  disabled={busy !== null}
                  className="text-accent hover:bg-accent/10 active:bg-accent/[.18] font-heading text-ds-12.5 rounded-ds-md -mr-ds-1 min-h-[44px] whitespace-nowrap px-ds-1 font-semibold disabled:opacity-45"
                >
                  {busy === 'generating' ? '正在重排…' : '重新排一份 →'}
                </button>
              </div>
              {plan.note ? (
                <p className="text-ds-12.5 mt-[6px] text-neutral-800">{plan.note}</p>
              ) : null}

              <div className="mt-[14px]">
                {[...plan.days]
                  .sort((a, b) => a.weekday - b.weekday)
                  .map((day) => (
                    <WeekRow key={day.weekday} day={day} isToday={day === todayPlan} />
                  ))}
              </div>
            </section>

            <section className="pt-[26px]">
              <div className="flex items-baseline justify-between">
                <div className="text-ds-9.5 tracking-ds-label text-neutral-700 uppercase">
                  想改就直接说
                </div>
                {messages.length > 0 ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await clearPlanChat()
                      setMessages([])
                    }}
                    className="text-ds-11 min-h-[44px] text-neutral-700 hover:text-accent"
                  >
                    清空对话
                  </button>
                ) : null}
              </div>

              {messages.length === 0 ? (
                <p className="text-ds-12.5 mt-[8px] text-neutral-800">
                  比如「周三没时间，挪到周四」「膝盖不舒服，深蹲换个动作」「太轻了，加点量」。
                </p>
              ) : (
                <div className="mt-[12px] flex flex-col gap-[10px]">
                  {messages.map((m, i) => (
                    <Bubble key={`${m.role}-${i}`} message={m} />
                  ))}
                </div>
              )}

              {busy === 'chatting' ? (
                <div className="text-ds-12.5 mt-[10px] text-neutral-700" role="status">
                  正在改…要半分钟左右。
                </div>
              ) : null}

              {failure !== null ? (
                <p role="alert" className="text-ds-12.5 text-accent2-700 mt-[10px]">
                  {failure}。
                </p>
              ) : null}

              <form onSubmit={send} className="mt-[12px] flex items-end gap-[8px]">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      e.currentTarget.form?.requestSubmit()
                    }
                  }}
                  disabled={busy !== null}
                  rows={2}
                  placeholder="想怎么改？"
                  className="bg-surface border-divider caret-accent hover:border-ink/45 focus-visible:border-accent placeholder:text-ink/65 rounded-ds-md min-h-[48px] flex-1 resize-none border px-ds-2 py-[10px] text-[16px] focus-visible:outline-offset-0 disabled:opacity-45"
                />
                <button
                  type="submit"
                  disabled={draft.trim() === '' || busy !== null}
                  className="bg-accent text-paper hover:bg-accent-600 active:bg-accent-700 font-heading text-ds-14 rounded-ds-md flex h-[48px] flex-none items-center justify-center px-[16px] font-semibold disabled:cursor-not-allowed disabled:opacity-45"
                >
                  发
                </button>
              </form>
              <div ref={chatEnd} />
            </section>
          </>
        )}
      </div>

      <BottomNav current="workouts" />
      <div className="pb-safe bg-paper flex-none" />
    </div>
  )
}

function EmptyPlan({ onGenerate, busy }: { onGenerate: () => void; busy: boolean }) {
  return (
    <section className="pt-ds-8">
      <h2 className="text-ds-22 tracking-ds-display">还没有计划</h2>
      <p className="text-ds-13 mt-ds-2 text-neutral-800">
        按你现在的档位和最近四周练了几次排一份，排完可以直接跟它说要改哪儿。
      </p>
      <button
        type="button"
        onClick={onGenerate}
        disabled={busy}
        className="bg-accent text-paper hover:bg-accent-600 active:bg-accent-700 font-heading text-ds-16 mt-ds-4 rounded-ds-md flex h-[50px] w-full items-center justify-center font-semibold disabled:opacity-45"
      >
        {busy ? '正在排…' : '排一份'}
      </button>
      {busy ? (
        <p className="text-ds-12 mt-ds-2 text-neutral-700" role="status">
          要半分钟左右，别关页面。
        </p>
      ) : null}
      <p className="text-ds-11 mt-ds-3 text-neutral-700">
        计划只是参考。练不练、练什么都不影响你的出刊链 —— 小人只看打卡里的那三项。
      </p>
    </section>
  )
}

function TodayBlock({ day }: { day: PlanDay }) {
  if (isRestDay(day)) {
    return (
      <div className="mt-[8px]">
        <div className="font-heading text-ds-22 font-semibold">休息</div>
        <p className="text-ds-12.5 mt-[6px] text-neutral-800">
          休息也是计划的一部分。今天照常出刊就行。
        </p>
      </div>
    )
  }
  return (
    <div className="mt-[8px]">
      <div className="font-heading text-ds-22 font-semibold">{day.focus}</div>
      <table className="mt-[10px] w-full">
        <tbody>
          {day.exercises.map((e, i) => (
            <tr key={`${e.name}-${i}`} className="border-ink/[.08] border-b">
              <td className="text-ds-13 py-[8px] pr-[8px]">
                {e.name}
                {e.note ? (
                  <span className="text-ds-11 block text-neutral-700">{e.note}</span>
                ) : null}
              </td>
              <td className="text-ds-13 whitespace-nowrap py-[8px] text-right tabular-nums">
                {e.sets === null ? e.reps : `${e.sets} × ${e.reps}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function WeekRow({ day, isToday }: { day: PlanDay; isToday: boolean }) {
  return (
    <div className="border-divider flex items-baseline gap-[10px] border-t py-[9px]">
      <span
        className={`text-ds-12 w-[30px] flex-none ${isToday ? 'text-ink font-semibold' : 'text-neutral-700'}`}
      >
        {weekdayName(day.weekday)}
      </span>
      <span className="text-ds-13 flex-none">{isRestDay(day) ? '休息' : day.focus}</span>
      <span className="text-ds-11.5 ml-auto text-right text-neutral-700">
        {isRestDay(day) ? '' : day.exercises.map((e) => e.name).join('、')}
      </span>
    </div>
  )
}

function Bubble({ message }: { message: ChatMessage }) {
  const mine = message.role === 'user'
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`text-ds-13 rounded-ds-md max-w-[78%] px-[12px] py-[9px] ${
          mine ? 'bg-accent text-paper' : 'bg-surface text-ink'
        }`}
      >
        {message.content}
      </div>
    </div>
  )
}
