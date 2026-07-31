'use client'

import { useRef, useState } from 'react'
import { saveMeal } from '@/app/actions/meals'
import type { IsoDate } from '@/lib/date'
import {
  MEAL_SLOTS,
  scaleAnalysis,
  slotLabel,
  type MealAnalysis,
  type MealSlot,
} from '@/lib/meal'
import { BottomNav } from './BottomNav'
import { ThickThinRule } from './Rule'

/**
 * 饮食记录 —— Phase 3 第 11–13 项。
 *
 * 流程照设计稿：拍一张 → 说份量 → AI 估算 → 可修正的结果卡。
 *
 * 语音输入不自建录音转写（dev-spec 第 6.1 节）：iOS 键盘自带听写，
 * 一个普通 textarea + 一句「点键盘上的麦克风说份量」就够了，零代码零成本。
 *
 * 主指标是**七日均值**，今日只是次要（第 9 节第 13 项）——
 * 单日看多了会为一顿饭焦虑。
 *
 * 热量不影响小人（规则 5）。页尾明说这件事。
 */
export type MealRow = {
  id: string
  date: IsoDate
  slot: string
  kcal: number | null
  items: unknown
}

export type MealScreenProps = {
  today: IsoDate
  defaultSlot: MealSlot
  todayMeals: MealRow[]
  todayKcal: number
  weekAverage: number
  weekDays: Array<{ date: IsoDate; kcal: number }>
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'analyzing' }
  | { kind: 'result'; analysis: MealAnalysis; base: MealAnalysis }
  | { kind: 'failed'; message: string }

export function MealScreen(props: MealScreenProps) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [slot, setSlot] = useState<MealSlot>(props.defaultSlot)
  const [transcript, setTranscript] = useState('')
  const [multipliers, setMultipliers] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file === undefined) return
    setPhase({ kind: 'analyzing' })

    try {
      const base64 = await compress(file)
      const response = await fetch('/api/analyze-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType: 'image/jpeg', transcript }),
      })
      const payload: unknown = await response.json()
      const p = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {}

      if (!response.ok) {
        setPhase({ kind: 'failed', message: typeof p.message === 'string' ? p.message : '分析失败' })
        return
      }
      const analysis = p.analysis as MealAnalysis
      setMultipliers(analysis.items.map(() => 1))
      setPhase({ kind: 'result', analysis, base: analysis })
    } catch {
      setPhase({ kind: 'failed', message: '照片没传上去，再试一次' })
    } finally {
      if (fileInput.current !== null) fileInput.current.value = ''
    }
  }

  function adjust(i: number, value: number) {
    if (phase.kind !== 'result') return
    const next = multipliers.map((m, idx) => (idx === i ? value : m))
    setMultipliers(next)
    setPhase({ ...phase, analysis: scaleAnalysis(phase.base, next) })
  }

  async function store() {
    if (phase.kind !== 'result') return
    setSaving(true)
    const result = await saveMeal({
      date: props.today,
      slot,
      transcript,
      analysis: phase.analysis,
      userAdjusted: multipliers.some((m) => m !== 1),
    })
    setSaving(false)
    if (!result.ok) {
      setPhase({ kind: 'failed', message: result.message })
      return
    }
    setPhase({ kind: 'idle' })
    setTranscript('')
    setMultipliers([])
  }

  return (
    <div className="bg-paper flex h-dvh flex-col overflow-hidden">
      <div className="pt-safe flex-none" />

      <header className="flex-none px-[22px] pt-[6px]">
        <div className="flex items-baseline justify-between gap-[10px]">
          <div className="flex items-baseline gap-[9px]">
            <h1 className="font-heading text-ds-24 font-semibold leading-none">饮食</h1>
            <span className="text-ds-8.5 tracking-ds-wide text-neutral-700 uppercase">Meals</span>
          </div>
          <span className="text-ds-11 whitespace-nowrap text-neutral-800">只有你能看到</span>
        </div>
        <ThickThinRule />
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-[22px] pb-[20px]">
        {phase.kind === 'result' ? (
          <ResultCard
            analysis={phase.analysis}
            multipliers={multipliers}
            slot={slot}
            saving={saving}
            onSlot={setSlot}
            onAdjust={adjust}
            onSave={store}
            onCancel={() => setPhase({ kind: 'idle' })}
          />
        ) : (
          <>
            {/* 七日均值 —— 主指标 */}
            <section className="pt-[16px]">
              <div className="text-ds-9.5 tracking-ds-label text-neutral-700 uppercase">
                本周日均 · 主要指标
              </div>
              <div className="mt-[8px] flex items-baseline gap-[8px]">
                <span className="font-heading text-ds-32 tracking-ds-display font-semibold">
                  {props.weekAverage > 0 ? props.weekAverage.toLocaleString('en-US') : '—'}
                </span>
                <span className="text-ds-13 text-neutral-800">kcal / 天</span>
              </div>
              <WeekBars days={props.weekDays} average={props.weekAverage} today={props.today} />
              <p className="text-ds-11.5 mt-[14px] text-neutral-800">
                七日均值是主要指标。单日高低不用管 —— 一顿饭吃多了不代表这周不行。
              </p>
            </section>

            {/* 今日 —— 次要 */}
            <section className="pt-[24px]">
              <div className="text-ds-9.5 tracking-ds-label text-neutral-700 uppercase">
                今日 · 次要
              </div>
              <div className="mt-[6px] flex items-baseline gap-[6px]">
                <span className="font-heading text-ds-22 font-semibold">
                  {props.todayKcal.toLocaleString('en-US')}
                </span>
                <span className="text-ds-12.5 text-neutral-800">kcal</span>
              </div>
              {props.todayMeals.length > 0 ? (
                <div className="mt-[10px]">
                  {props.todayMeals.map((m) => (
                    <div
                      key={m.id}
                      className="border-divider flex items-baseline justify-between gap-[10px] border-t py-[8px]"
                    >
                      <span className="text-ds-13">{slotLabel(m.slot)}</span>
                      <span className="text-ds-13 tabular-nums text-neutral-800">
                        {m.kcal ?? '—'} kcal
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-ds-12.5 mt-[6px] text-neutral-800">今天还没记。</p>
              )}
            </section>

            {phase.kind === 'failed' ? (
              <p role="alert" className="text-ds-12.5 text-accent2-700 mt-[16px]">
                {phase.message}。
              </p>
            ) : null}

            {/* 说份量 —— iOS 键盘自带听写，不自建录音 */}
            <section className="pt-[24px]">
              <label htmlFor="portion" className="text-ds-12 block text-neutral-800">
                份量（可选）
              </label>
              <textarea
                id="portion"
                rows={2}
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="两碗米饭、半个鸡胸"
                className="bg-surface border-divider caret-accent focus-visible:border-accent placeholder:text-ink/65 rounded-ds-md mt-[6px] w-full resize-none border px-ds-2 py-[10px] text-[16px] focus-visible:outline-offset-0"
              />
              <p className="text-ds-11 mt-[6px] text-neutral-700">
                点键盘上的麦克风直接说。说了份量的话，AI 会以你说的为准。
              </p>
            </section>

            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onPick}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={phase.kind === 'analyzing'}
              className="bg-accent text-paper hover:bg-accent-600 active:bg-accent-700 font-heading text-ds-16 rounded-ds-md mt-[18px] flex h-[50px] w-full items-center justify-center font-semibold disabled:opacity-45"
            >
              {phase.kind === 'analyzing' ? '正在认…' : '拍一张'}
            </button>
            {phase.kind === 'analyzing' ? (
              <p role="status" className="text-ds-12 mt-[8px] text-neutral-700">
                要半分钟左右，别关页面。
              </p>
            ) : (
              <p className="text-ds-11 mt-[10px] text-neutral-800">
                把手或餐具一起入镜，有助于估算份量。
              </p>
            )}

            <p className="text-ds-11 mt-[18px] text-neutral-800">
              卡路里、餐食全部私密，朋友那一排永远只有小人、状态和名字。吃多了也不会让小人变蔫。
            </p>
          </>
        )}
      </div>

      <BottomNav current="meals" />
      <div className="pb-safe bg-paper flex-none" />
    </div>
  )
}

function WeekBars({
  days,
  average,
  today,
}: {
  days: Array<{ date: IsoDate; kcal: number }>
  average: number
  today: IsoDate
}) {
  const max = Math.max(2400, ...days.map((d) => d.kcal))
  return (
    <div className="relative mt-[16px] h-[86px]">
      {average > 0 ? (
        <div
          className="border-accent absolute inset-x-0 border-t border-dashed opacity-85"
          style={{ top: `${Math.max(0, 66 - (average / max) * 66)}px` }}
        />
      ) : null}
      <div className="absolute inset-0 flex items-end gap-[7px]">
        {days.map((d) => {
          const isToday = d.date === today
          return (
            <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-[6px]">
              <div
                className={`w-full rounded-[1px] ${isToday ? 'bg-accent' : 'bg-neutral-400'}`}
                style={{ height: `${Math.round((d.kcal / max) * 66)}px` }}
              />
              <div
                className={`text-ds-10 ${isToday ? 'text-accent-700' : 'text-neutral-700'}`}
              >
                {['日', '一', '二', '三', '四', '五', '六'][
                  new Date(`${d.date}T00:00:00Z`).getUTCDay()
                ]}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ResultCard({
  analysis,
  multipliers,
  slot,
  saving,
  onSlot,
  onAdjust,
  onSave,
  onCancel,
}: {
  analysis: MealAnalysis
  multipliers: number[]
  slot: MealSlot
  saving: boolean
  onSlot: (s: MealSlot) => void
  onAdjust: (i: number, v: number) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="pt-[16px]">
      <div className="flex items-baseline justify-between gap-[10px]">
        <h2 className="font-heading text-ds-24 font-semibold leading-none">{slotLabel(slot)}</h2>
        <span className="font-heading text-ds-20 font-semibold">
          ~{analysis.total.kcal.toLocaleString('en-US')} kcal
        </span>
      </div>
      <ThickThinRule thick={2} />

      <div className="border-divider rounded-ds-md mt-[12px] flex w-full overflow-hidden border">
        {MEAL_SLOTS.map((s, i) => (
          <label
            key={s.slot}
            className={[
              'text-ds-13 relative flex min-h-[44px] flex-1 cursor-pointer items-center justify-center',
              i > 0 ? 'border-divider border-l' : '',
              slot === s.slot ? 'bg-accent text-paper' : 'hover:bg-ink/[.07]',
            ].join(' ')}
          >
            <input
              type="radio"
              name="slot"
              checked={slot === s.slot}
              onChange={() => onSlot(s.slot)}
              className="pointer-events-none absolute h-0 w-0 opacity-0"
            />
            {s.label}
          </label>
        ))}
      </div>

      <table className="mt-[14px] w-full">
        <tbody>
          {analysis.items.map((item, i) => (
            <tr key={`${item.name}-${i}`} className="border-ink/[.08] border-b">
              <td className="text-ds-13 py-[8px] pr-[8px]">
                {item.name}
                {item.confidence === 'low' ? (
                  <span className="text-ds-11 ml-[6px] text-neutral-700">不太确定</span>
                ) : null}
              </td>
              <td className="text-ds-12.5 whitespace-nowrap py-[8px] text-right text-neutral-800">
                {item.portion_estimate}
              </td>
              <td className="text-ds-13 whitespace-nowrap py-[8px] pl-[8px] text-right tabular-nums">
                {item.kcal} kcal
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="text-ds-12.5 mt-[12px] text-neutral-800">
        蛋白质 {analysis.total.protein_g}g · 碳水 {analysis.total.carbs_g}g · 脂肪{' '}
        {analysis.total.fat_g}g
      </div>
      <div className="text-ds-12.5 mt-[4px] text-neutral-800">
        可能范围 {analysis.range.kcal_low} – {analysis.range.kcal_high} kcal
      </div>
      {analysis.notes ? (
        <p className="text-ds-11.5 mt-[8px] text-neutral-700">{analysis.notes}</p>
      ) : null}

      <div className="text-ds-9.5 tracking-ds-label mt-[20px] text-neutral-700 uppercase">
        份量修正 · 0.5× – 2×
      </div>
      {analysis.items.map((item, i) => (
        <div key={`adj-${i}`} className="mt-[12px] flex items-center gap-[12px]">
          <span className="text-ds-13 w-[74px] flex-none truncate">{item.name}</span>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.25}
            value={multipliers[i] ?? 1}
            onChange={(e) => onAdjust(i, Number(e.target.value))}
            className="accent-accent min-h-[44px] flex-1"
          />
          <span className="text-ds-13 w-[38px] flex-none text-right tabular-nums">
            ×{multipliers[i] ?? 1}
          </span>
        </div>
      ))}

      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="bg-accent text-paper hover:bg-accent-600 active:bg-accent-700 font-heading text-ds-16 rounded-ds-md mt-[20px] flex h-[50px] w-full items-center justify-center font-semibold disabled:opacity-45"
      >
        {saving ? '正在记…' : '记下这一餐'}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="text-ds-13 mt-[10px] min-h-[44px] w-full text-neutral-700"
      >
        不记了
      </button>
    </div>
  )
}

/**
 * 客户端压图：长边 ≤1568px（dev-spec 第 6.1 节），省流量也省 token。
 * 顺便统一转成 JPEG —— HEIC 直接传上去模型认不了。
 */
async function compress(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1568 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (ctx === null) throw new Error('canvas 用不了')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.82).split(',')[1] ?? ''
}
