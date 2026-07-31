'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  saveWorkout,
  type StrengthExercise,
  type WorkoutDetail,
  type WorkoutKind,
} from '@/app/actions/workouts'
import { formatShortDate, type IsoDate } from '@/lib/date'
import { dayOfPlan, isRestDay, type Plan } from '@/lib/plan'
import { BottomNav } from './BottomNav'
import { ThickThinRule } from './Rule'

/**
 * 运动记录 —— Phase 3 第 10 项。
 *
 * 设计稿的判断：「复制上次」是整页最大的按钮，类型选择排在它下面。
 * 大多数人的训练是重复的。
 *
 * 页头一行小字写明「不影响小人状态」—— 漏记不会断出刊链（dev-spec 规则 1）。
 * 这句话很重要：不写的话人会以为不记就断了，反而更容易弃用。
 */
const KINDS: Array<{ kind: WorkoutKind; label: string }> = [
  { kind: 'strength', label: '力量' },
  { kind: 'run', label: '跑步' },
  { kind: 'sport', label: '球类' },
  { kind: 'other', label: '其他' },
]

export type RecentWorkout = {
  id: string
  date: IsoDate
  kind: WorkoutKind
  detail: WorkoutDetail
}

const EMPTY_EXERCISE: StrengthExercise = { name: '', sets: 3, reps: 10, weightKg: null }

export function WorkoutScreen({
  today,
  plan,
  recent,
  lastStrength,
}: {
  today: IsoDate
  plan: Plan | null
  recent: RecentWorkout[]
  lastStrength: StrengthExercise[] | null
}) {
  const [kind, setKind] = useState<WorkoutKind>('strength')
  const [exercises, setExercises] = useState<StrengthExercise[]>([{ ...EMPTY_EXERCISE }])
  const [minutes, setMinutes] = useState('')
  const [distance, setDistance] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const todayPlan = plan === null ? null : dayOfPlan(plan, today)
  const isCardio = kind === 'run'

  function copyLast() {
    if (lastStrength === null) return
    setKind('strength')
    setExercises(lastStrength.map((e) => ({ ...e })))
    setSaved(false)
  }

  async function save() {
    setBusy(true)
    setFailure(null)

    const detail: WorkoutDetail = isCardio
      ? {
          kind: 'cardio',
          minutes: Number(minutes) || 0,
          distanceKm: distance === '' ? null : Number(distance),
        }
      : kind === 'strength'
        ? { kind: 'strength', exercises: exercises.filter((e) => e.name.trim() !== '') }
        : { kind: 'plain' }

    const result = await saveWorkout({ date: today, kind, detail })
    setBusy(false)
    if (!result.ok) {
      setFailure(result.message)
      return
    }
    setSaved(true)
    setExercises([{ ...EMPTY_EXERCISE }])
    setMinutes('')
    setDistance('')
  }

  const canSave = isCardio
    ? minutes.trim() !== ''
    : kind === 'strength'
      ? exercises.some((e) => e.name.trim() !== '')
      : true

  return (
    <div className="bg-paper flex h-dvh flex-col overflow-hidden">
      <div className="pt-safe flex-none" />

      <header className="flex-none px-[22px] pt-[6px]">
        <div className="flex items-baseline justify-between gap-[10px]">
          <div className="flex items-baseline gap-[9px]">
            <h1 className="font-heading text-ds-24 font-semibold leading-none">运动</h1>
            <span className="text-ds-8.5 tracking-ds-wide text-neutral-700 uppercase">
              Training
            </span>
          </div>
          <span className="text-ds-11 whitespace-nowrap text-neutral-800">
            可选 · 不影响小人状态
          </span>
        </div>
        <ThickThinRule />
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-[22px] pb-[20px]">
        {/* 今天该练什么 —— 来自训练计划 */}
        <section className="pt-[16px]">
          <div className="flex items-baseline justify-between">
            <div className="text-ds-9.5 tracking-ds-label text-neutral-700 uppercase">
              今天该练什么
            </div>
            <Link
              href="/plan"
              className="text-accent font-heading text-ds-12.5 min-h-[44px] font-semibold"
            >
              {plan === null ? '排一份计划 →' : '完整计划 →'}
            </Link>
          </div>
          {plan === null ? (
            <p className="text-ds-12.5 mt-[6px] text-neutral-800">
              还没有计划。让 AI 按你的档位排一份，之后可以直接跟它说要改哪儿。
            </p>
          ) : todayPlan === null || isRestDay(todayPlan) ? (
            <p className="text-ds-13 mt-[6px]">今天休息。休息也是计划的一部分。</p>
          ) : (
            <p className="text-ds-13 mt-[6px]">
              <span className="font-heading font-semibold">{todayPlan.focus}</span>
              <span className="text-neutral-800">
                {' · '}
                {todayPlan.exercises.map((e) => e.name).join('、')}
              </span>
            </p>
          )}
        </section>

        {/* 复制上次 —— 整页最大的按钮 */}
        <button
          type="button"
          onClick={copyLast}
          disabled={lastStrength === null}
          className="bg-accent text-paper hover:bg-accent-600 active:bg-accent-700 rounded-ds-md mt-[22px] flex w-full items-center justify-between gap-[12px] px-[18px] py-[16px] text-left disabled:cursor-not-allowed disabled:opacity-45"
        >
          <span className="flex flex-col gap-[4px]">
            <span className="font-heading text-ds-18 font-semibold leading-none">复制上次</span>
            <span className="text-ds-11.5 opacity-90">
              {lastStrength === null
                ? '还没有可以复制的力量训练'
                : `力量 · ${lastStrength.map((e) => e.name).join('、')}`}
            </span>
          </span>
          <span className="text-ds-19" aria-hidden="true">
            →
          </span>
        </button>
        <p className="text-ds-11 mt-[10px] text-neutral-800">
          大多数人的训练是重复的 —— 这个按钮排在第一位。
        </p>

        {/* 类型 */}
        <div className="text-ds-9.5 tracking-ds-label mt-[24px] text-neutral-700 uppercase">
          类型
        </div>
        <div className="border-divider rounded-ds-md mt-[10px] flex w-full overflow-hidden border">
          {KINDS.map((k, i) => (
            <label
              key={k.kind}
              className={[
                'text-ds-13 relative flex min-h-[46px] flex-1 cursor-pointer items-center justify-center py-[13px]',
                i > 0 ? 'border-divider border-l' : '',
                kind === k.kind ? 'bg-accent text-paper' : 'hover:bg-ink/[.07]',
                'has-[:focus-visible]:outline-accent has-[:focus-visible]:outline has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-2',
              ].join(' ')}
            >
              <input
                type="radio"
                name="kind"
                checked={kind === k.kind}
                onChange={() => {
                  setKind(k.kind)
                  setSaved(false)
                }}
                className="pointer-events-none absolute h-0 w-0 opacity-0"
              />
              {k.label}
            </label>
          ))}
        </div>

        {kind === 'strength' ? (
          <StrengthForm exercises={exercises} onChange={setExercises} />
        ) : isCardio ? (
          <CardioForm
            minutes={minutes}
            distance={distance}
            onMinutes={setMinutes}
            onDistance={setDistance}
          />
        ) : (
          <p className="text-ds-12.5 mt-[16px] text-neutral-800">
            记一次就行，明细可以不填。
          </p>
        )}

        {failure !== null ? (
          <p role="alert" className="text-ds-12.5 text-accent2-700 mt-[14px]">
            {failure}。
          </p>
        ) : null}
        {saved ? (
          <p role="status" className="text-ds-12.5 text-accent-700 mt-[14px]">
            记下了。
          </p>
        ) : null}

        <button
          type="button"
          onClick={save}
          disabled={!canSave || busy}
          className="bg-accent text-paper hover:bg-accent-600 active:bg-accent-700 font-heading text-ds-16 rounded-ds-md mt-[20px] flex h-[50px] w-full items-center justify-center font-semibold disabled:cursor-not-allowed disabled:opacity-45"
        >
          {busy ? '正在存…' : '保存'}
        </button>

        <p className="text-ds-11 mt-[12px] text-neutral-800">
          漏记不影响出刊链。小人的状态只看睡眠和饮水，档位只看打卡里的「练了」。
        </p>

        {recent.length > 0 ? (
          <section className="pt-[26px]">
            <div className="text-ds-9.5 tracking-ds-label text-neutral-700 uppercase">最近</div>
            <div className="mt-[8px]">
              {recent.map((w) => (
                <div key={w.id} className="border-divider border-t py-[9px]">
                  <div className="flex items-baseline justify-between gap-[10px]">
                    <span className="text-ds-13">
                      {KINDS.find((k) => k.kind === w.kind)?.label ?? w.kind}
                    </span>
                    <span className="text-ds-11.5 text-neutral-700">
                      {formatShortDate(w.date)}
                    </span>
                  </div>
                  <div className="text-ds-11.5 mt-[3px] text-neutral-800">{summarize(w.detail)}</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <BottomNav current="workouts" />
      <div className="pb-safe bg-paper flex-none" />
    </div>
  )
}

function summarize(detail: WorkoutDetail): string {
  if (detail.kind === 'strength') {
    return detail.exercises
      .map((e) => `${e.name} ${e.sets}×${e.reps}${e.weightKg === null ? '' : ` ${e.weightKg}kg`}`)
      .join('、')
  }
  if (detail.kind === 'cardio') {
    return `${detail.minutes} 分钟${detail.distanceKm === null ? '' : ` · ${detail.distanceKm} 公里`}`
  }
  return '记了一次'
}

const CELL =
  'bg-surface border-divider caret-accent focus-visible:border-accent rounded-ds-md min-h-[44px] border px-[8px] text-[16px] focus-visible:outline-offset-0'

function StrengthForm({
  exercises,
  onChange,
}: {
  exercises: StrengthExercise[]
  onChange: (next: StrengthExercise[]) => void
}) {
  function patch(i: number, part: Partial<StrengthExercise>) {
    onChange(exercises.map((e, idx) => (idx === i ? { ...e, ...part } : e)))
  }

  return (
    <div className="mt-[16px]">
      <div className="text-ds-11 flex gap-[8px] text-neutral-700">
        <span className="flex-1">动作</span>
        <span className="w-[54px] text-center">组</span>
        <span className="w-[54px] text-center">次</span>
        <span className="w-[62px] text-center">kg</span>
      </div>
      {exercises.map((e, i) => (
        <div key={i} className="mt-[8px] flex items-center gap-[8px]">
          <input
            value={e.name}
            onChange={(ev) => patch(i, { name: ev.target.value })}
            placeholder="深蹲"
            className={`${CELL} flex-1`}
          />
          <input
            type="number"
            inputMode="numeric"
            value={e.sets}
            onChange={(ev) => patch(i, { sets: Number(ev.target.value) || 0 })}
            className={`${CELL} w-[54px] text-center`}
          />
          <input
            type="number"
            inputMode="numeric"
            value={e.reps}
            onChange={(ev) => patch(i, { reps: Number(ev.target.value) || 0 })}
            className={`${CELL} w-[54px] text-center`}
          />
          <input
            type="number"
            inputMode="decimal"
            value={e.weightKg ?? ''}
            onChange={(ev) =>
              patch(i, { weightKg: ev.target.value === '' ? null : Number(ev.target.value) })
            }
            placeholder="—"
            className={`${CELL} w-[62px] text-center`}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...exercises, { ...EMPTY_EXERCISE }])}
        className="border-divider hover:bg-ink/[.07] rounded-ds-md text-ds-14 mt-[12px] min-h-[46px] w-full border"
      >
        ＋ 加一个动作
      </button>
    </div>
  )
}

function CardioForm({
  minutes,
  distance,
  onMinutes,
  onDistance,
}: {
  minutes: string
  distance: string
  onMinutes: (v: string) => void
  onDistance: (v: string) => void
}) {
  return (
    <div className="mt-[16px] flex gap-[14px]">
      <div className="flex-1">
        <label className="text-ds-11 block text-neutral-800">时长（分钟）</label>
        <input
          type="number"
          inputMode="numeric"
          value={minutes}
          onChange={(e) => onMinutes(e.target.value)}
          placeholder="42"
          className={`${CELL} mt-[6px] w-full`}
        />
      </div>
      <div className="flex-1">
        <label className="text-ds-11 block text-neutral-800">距离（公里）</label>
        <input
          type="number"
          inputMode="decimal"
          value={distance}
          onChange={(e) => onDistance(e.target.value)}
          placeholder="7.2"
          className={`${CELL} mt-[6px] w-full`}
        />
      </div>
    </div>
  )
}
