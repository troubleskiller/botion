'use client'

import { useState } from 'react'
import { sleepLabel, waterLabel } from '@/lib/bands'
import type { IsoDate } from '@/lib/date'
import { computeStage, computeState, type DailyState, type Stage, type State } from '@/lib/logic'
import type { PublicStatusRow } from '@/lib/types'
import { Avatar } from './Avatar'
import { BottomNav } from './BottomNav'
import { CheckinSheet, type BandValues } from './CheckinSheet'
import { FriendRow } from './FriendRow'
import { Masthead } from './Masthead'
import { RevealOverlay } from './RevealOverlay'
import { StageBlock } from './StageProgress'
import { StageUpOverlay } from './StageUpOverlay'
import { StateStamp } from './StateBadge'
import { Toast } from './Toast'

export type HomeScreenProps = {
  today: IsoDate
  /** 本人的小人套系（profiles.avatar_key）。每个人可以不一样。 */
  avatarKey: string
  yesterday: IsoDate
  /** 期号 = 连续出刊天数。0 表示还没出过刊。 */
  issue: number
  stage: Stage
  totalTrainedDays: number
  /** null = 今天还没出刊。不是一种状态，是没有内容（规则 3）。 */
  state: DailyState
  /** 今天出刊的时刻，「9:41」。没出刊时为 null。 */
  publishedAt: string | null
  existing: Partial<Record<IsoDate, BandValues>>
  friends: readonly PublicStatusRow[]
}

export function HomeScreen(props: HomeScreenProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [reveal, setReveal] = useState<{
    issue: number
    state: State
    bands: BandValues
  } | null>(null)
  // 升档排在出刊页之后放 —— 先给「这一期出了」，再给「你长开了」
  const [stageUp, setStageUp] = useState<{
    from: Stage
    to: Stage
    total: number
  } | null>(null)

  // 出刊那一刻先用本地算出的状态，等 revalidate 回来的数据顶上。
  // computeState 和库里视图的 case 是同一套判定，不会打架。
  // 分档值也一起本地留一份 —— 否则 revalidate 到达前的那一小段，
  // state 是新的而 existing 还是旧的，副标题会显示成「睡 — · 水—」。
  const state = reveal !== null ? reveal.state : props.state
  const issue = reveal !== null ? reveal.issue : props.issue
  const published = state !== null
  const todayBands = reveal !== null ? reveal.bands : props.existing[props.today]

  function onPublished(
    entry: BandValues & { date: IsoDate; wasNew: boolean; totalTrainedDays: number },
  ) {
    setSheetOpen(false)

    // 跨档了就记下来，等出刊页放完再接上（补昨天的也算 —— 累计次数是累计次数）
    const before = computeStage(props.totalTrainedDays)
    const after = computeStage(entry.totalTrainedDays)
    if (after > before) {
      setStageUp({ from: before, to: after, total: entry.totalTrainedDays })
    }

    if (entry.date !== props.today) {
      // 补的是昨天：不放出刊动画（首页说的是今天这一期），但也不能没反应
      setToast(entry.wasNew ? '昨天那期补上了' : '昨天那期改好了')
      return
    }

    setReveal({
      issue: entry.wasNew ? props.issue + 1 : props.issue,
      state: computeState(entry.sleepBand, entry.waterBand),
      bands: entry,
    })
  }

  const reason =
    published && todayBands !== undefined
      ? `睡 ${sleepLabel(todayBands.sleepBand)} · 水${waterLabel(todayBands.waterBand)}`
      : published
        ? '今天这期已经出了'
        : '今天的这一期还空着'

  return (
    <div className="bg-paper flex h-dvh flex-col overflow-hidden">
      <div className="pt-safe flex-none" />

      <Masthead date={props.today} issue={issue} bumpIssue={reveal !== null} />

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {/* 主位：左侧状态与档位，右侧小人 */}
        <div className="flex flex-none gap-[6px] px-[22px] pt-[14px]">
          <div className="w-[150px] flex-none pt-[12px]">
            <div className="text-ds-9.5 tracking-ds-label text-neutral-700 uppercase">今日状态</div>
            <div className="mt-[9px]">
              <StateStamp state={state} />
            </div>
            <div className="text-ds-12 mt-[14px] text-neutral-700">{reason}</div>

            <div className="mt-[26px]">
              <StageBlock totalTrainedDays={props.totalTrainedDays} />
            </div>
          </div>

          <div className="relative h-[312px] flex-1">
            <Avatar
              avatarKey={props.avatarKey}
              stage={props.stage}
              state={state}
              alt={published ? `我的小人，${props.stage} 档` : '我的小人，今天还没出刊'}
              priority
            />
          </div>
        </div>

        {/* 出刊入口。洋红在整个 App 里只出现在这里 —— 设计稿的颜色纪律 */}
        <div className="flex-none px-[22px] pt-[2px]">
          {published ? (
            <div className="border-divider flex items-center justify-between gap-[10px] border-t pb-[12px] pt-[13px]">
              <span className="text-ds-12.5 text-neutral-700">
                第 {issue} 期已出刊
                {props.publishedAt !== null ? ` · ${props.publishedAt} 出的` : ''}
              </span>
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="text-accent hover:bg-accent/10 active:bg-accent/[.18] font-heading text-ds-12.5 rounded-ds-md -mr-ds-1 min-h-[44px] whitespace-nowrap px-ds-1 font-semibold"
              >
                改今天的记录 →
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="bg-accent2 text-paper hover:bg-accent2-600 active:bg-accent2-700 animate-breathe rounded-ds-md flex w-full items-center justify-between gap-[10px] px-[18px] py-[15px] text-left"
            >
              <span className="flex flex-col gap-[3px]">
                <span className="font-heading text-ds-17 font-semibold">今天这期还没出刊</span>
                <span className="text-ds-11.5 opacity-[.86]">三次点击，10 秒完成</span>
              </span>
              <span className="text-ds-19" aria-hidden="true">
                →
              </span>
            </button>
          )}
        </div>

        <FriendRow friends={props.friends} />
      </div>

      <BottomNav current="home" onPublish={() => setSheetOpen(true)} />
      <div className="pb-safe bg-paper flex-none" />

      {sheetOpen ? (
        <CheckinSheet
          today={props.today}
          yesterday={props.yesterday}
          existing={props.existing}
          onClose={() => setSheetOpen(false)}
          onPublished={onPublished}
        />
      ) : null}

      {reveal !== null ? (
        <RevealOverlay
          issue={reveal.issue}
          state={reveal.state}
          stage={props.stage}
          avatarKey={props.avatarKey}
          onDone={() => setReveal(null)}
        />
      ) : null}

      {toast !== null ? <Toast message={toast} onDone={() => setToast(null)} /> : null}

      {/* 出刊页放完了才轮到升档 —— 两个全屏叠一起会互相盖掉 */}
      {reveal === null && stageUp !== null ? (
        <StageUpOverlay
          from={stageUp.from}
          to={stageUp.to}
          avatarKey={props.avatarKey}
          totalTrainedDays={stageUp.total}
          onDone={() => setStageUp(null)}
        />
      ) : null}
    </div>
  )
}
