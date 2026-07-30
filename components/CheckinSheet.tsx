'use client'

import { useEffect, useState } from 'react'
import { publishEntry } from '@/app/actions/checkin'
import { SLEEP_BANDS, TRAINED_OPTIONS, WATER_BANDS } from '@/lib/bands'
import { formatSheetDate, formatShortDate, type IsoDate } from '@/lib/date'
import type { SleepBand, WaterBand } from '@/lib/logic'
import { BandGroup } from './BandGroup'
import { ThickThinRule } from './Rule'

export type BandValues = {
  sleepBand: SleepBand
  waterBand: WaterBand
  trained: boolean
}

/**
 * 打卡底部弹层 —— Phase 1 第 4 项。三组分档按钮，写入 entries。
 *
 * 只问三件事，因为只有这三件事影响小人（dev-spec 规则 1）。
 * 运动明细和饮食不在这里，漏记它们不会断出刊链。
 *
 * 「补 7 月 29 日」把目标日期切到昨天。更早的日期没有入口，
 * 库里的 RLS 也拒绝（规则 4）。
 */
export function CheckinSheet({
  today,
  yesterday,
  existing,
  onClose,
  onPublished,
}: {
  today: IsoDate
  yesterday: IsoDate
  existing: Partial<Record<IsoDate, BandValues>>
  onClose: () => void
  onPublished: (published: BandValues & { date: IsoDate; wasNew: boolean }) => void
}) {
  const [targetDate, setTargetDate] = useState<IsoDate>(today)
  const [sleep, setSleep] = useState<SleepBand | null>(existing[today]?.sleepBand ?? null)
  const [water, setWater] = useState<WaterBand | null>(existing[today]?.waterBand ?? null)
  const [trained, setTrained] = useState<boolean | null>(existing[today]?.trained ?? null)
  const [submitting, setSubmitting] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  // Esc 关闭；弹层打开时锁住底层滚动
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  function switchDate(next: IsoDate) {
    setTargetDate(next)
    setSleep(existing[next]?.sleepBand ?? null)
    setWater(existing[next]?.waterBand ?? null)
    setTrained(existing[next]?.trained ?? null)
    setFailure(null)
  }

  const answered = (sleep !== null ? 1 : 0) + (water !== null ? 1 : 0) + (trained !== null ? 1 : 0)
  const ready = sleep !== null && water !== null && trained !== null

  async function submit() {
    if (sleep === null || water === null || trained === null) return
    setSubmitting(true)
    setFailure(null)

    const result = await publishEntry({
      date: targetDate,
      sleepBand: sleep,
      waterBand: water,
      trained,
    })

    setSubmitting(false)
    if (!result.ok) {
      setFailure(result.message)
      return
    }
    onPublished({
      date: targetDate,
      sleepBand: sleep,
      waterBand: water,
      trained,
      wasNew: existing[targetDate] === undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-30">
      <button
        type="button"
        aria-label="关掉出刊面板"
        onClick={onClose}
        className="animate-fade-in bg-neutral-900/[.46] absolute inset-0 w-full cursor-default"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkin-title"
        className="animate-sheet-up bg-paper shadow-ds-lg pb-safe absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-[20px] px-[22px] pb-[26px] pt-[12px]"
      >
        <div className="bg-neutral-400 mx-auto mb-[16px] h-[4px] w-[38px] rounded-[3px]" />

        <div className="flex items-baseline justify-between gap-[12px]">
          <div>
            <h2 id="checkin-title" className="text-ds-22 tracking-ds-display">
              {targetDate === today ? '今日出刊' : '补一期'}
            </h2>
            <div className="text-ds-11 mt-[5px] text-neutral-700">
              {formatSheetDate(targetDate)}
            </div>
          </div>
          <span className="text-ds-11.5 flex-none whitespace-nowrap text-neutral-700">
            已答 {answered}/3
          </span>
        </div>

        <ThickThinRule thick={2} />

        <div className="mt-[20px]">
          <BandGroup
            name="sleep"
            legend="昨晚睡了多久？"
            options={SLEEP_BANDS.map((b) => ({ value: String(b.band), label: b.label }))}
            value={sleep === null ? null : String(sleep)}
            onChange={(v) => setSleep(Number(v) as SleepBand)}
          />
        </div>

        <div className="mt-[18px]">
          <BandGroup
            name="water"
            legend="今天喝水？"
            options={WATER_BANDS.map((b) => ({ value: String(b.band), label: b.label }))}
            value={water === null ? null : String(water)}
            onChange={(v) => setWater(Number(v) as WaterBand)}
          />
        </div>

        <div className="mt-[18px]">
          <BandGroup
            name="trained"
            legend="今天练了吗？"
            options={TRAINED_OPTIONS.map((o) => ({
              value: o.value ? 'yes' : 'no',
              label: o.label,
            }))}
            value={trained === null ? null : trained ? 'yes' : 'no'}
            onChange={(v) => setTrained(v === 'yes')}
            hint={
              trained === true
                ? '记一次训练 · 体型档位的进度往前走一格'
                : '练不练都能出刊，只影响体型档位的进度'
            }
          />
        </div>

        {failure !== null ? (
          <p role="alert" className="text-ds-12.5 text-accent2-700 mt-[14px]">
            {failure}。再点一次「出刊」。
          </p>
        ) : null}

        <button
          type="button"
          disabled={!ready || submitting}
          onClick={submit}
          className="bg-accent text-paper hover:bg-accent-600 active:bg-accent-700 font-heading text-ds-17 rounded-ds-md mt-[22px] flex h-[52px] w-full items-center justify-center font-semibold disabled:cursor-not-allowed disabled:opacity-45"
        >
          {submitting ? '正在出刊…' : '出刊'}
        </button>

        <div className="mt-[16px] flex items-center justify-between">
          {targetDate === today ? (
            <button
              type="button"
              onClick={() => switchDate(yesterday)}
              className="text-accent hover:bg-accent/10 active:bg-accent/[.18] font-heading text-ds-12.5 rounded-ds-md -ml-ds-1 min-h-[44px] whitespace-nowrap px-ds-1 font-semibold"
            >
              补 {formatShortDate(yesterday)}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => switchDate(today)}
              className="text-accent hover:bg-accent/10 active:bg-accent/[.18] font-heading text-ds-12.5 rounded-ds-md -ml-ds-1 min-h-[44px] whitespace-nowrap px-ds-1 font-semibold"
            >
              改回今天
            </button>
          )}
          <button
            type="button"
            disabled
            aria-label="记录详情（即将上线）"
            className="font-heading text-ds-12.5 min-h-[44px] cursor-not-allowed whitespace-nowrap opacity-45"
          >
            记录详情 →
          </button>
        </div>
      </div>
    </div>
  )
}
