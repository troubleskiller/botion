import { computeStage, stageFillRatio, stageName, toNextStage } from '@/lib/logic'

/**
 * 档位进度条 —— 设计稿里的四段楔形（照印刷的灰阶梯楔）。
 *
 * 已过的档满墨；当前档用青色按档内进度做线性填充；未到的档中性灰。
 * 档位只涨不跌（规则 2），所以这条进度条永远只往右长。
 */
export function StageProgress({
  totalTrainedDays,
  segmentHeight = 9,
  gap = 3,
}: {
  totalTrainedDays: number
  segmentHeight?: number
  gap?: number
}) {
  const stage = computeStage(totalTrainedDays)
  const ratio = stageFillRatio(totalTrainedDays)
  const percent = Math.round(ratio * 100)

  return (
    <div className="flex" style={{ gap: `${gap}px` }} aria-hidden="true">
      {([1, 2, 3, 4] as const).map((slot) => (
        <div
          key={slot}
          className="flex-1"
          style={{
            height: `${segmentHeight}px`,
            background:
              slot < stage
                ? '#201e1d' // ink，已过的档
                : slot === stage
                  ? `linear-gradient(to right, #0088b0 ${percent}%, #d7d3d3 ${percent}%)` // accent / neutral-300
                  : '#d7d3d3', // neutral-300，未到的档
          }}
        />
      ))}
    </div>
  )
}

/** 「3 档 结实」+ 楔形 + 「再练 16 次进 4 档 · 只涨不跌」 */
export function StageBlock({ totalTrainedDays }: { totalTrainedDays: number }) {
  const stage = computeStage(totalTrainedDays)
  const remaining = toNextStage(totalTrainedDays)

  return (
    <div>
      <div className="flex items-baseline gap-ds-1">
        <span className="font-heading text-ds-16 font-semibold">{stage} 档</span>
        <span className="text-ds-13 text-neutral-700">{stageName(stage)}</span>
      </div>
      <div className="mt-[9px]">
        <StageProgress totalTrainedDays={totalTrainedDays} />
      </div>
      <div className="text-ds-11.5 mt-[8px] text-neutral-700">
        {remaining === null
          ? `已是最高档 · 累计 ${totalTrainedDays} 次`
          : `再练 ${remaining} 次进 ${stage + 1} 档 · 只涨不跌`}
      </div>
    </div>
  )
}
