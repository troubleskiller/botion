import type { CSSProperties } from 'react'
import {
  AVATAR_INTRINSIC,
  AVATAR_THUMB_INTRINSIC,
  avatarSrc,
  avatarThumbSrc,
} from '@/lib/avatars'
import type { DailyState, Stage } from '@/lib/logic'

/**
 * 小人展示 —— 体型档 + 今日状态。
 *
 * 状态的视觉处理照设计稿的 art()：
 *   精神  saturate 提一点，最饱和
 *   普通  原图
 *   蔫    去掉一半色彩、对比降一点、整个人往下沉 5px（有内容的状态）
 *   未打卡 纯剪影，13% 不透明度（没有内容 —— 规则 3，与「蔫」必须一眼分得开）
 *
 * dev-spec 第 8 节：未打卡不另做素材，同一张图套 CSS filter。
 */
const ART_STYLE: Record<'energetic' | 'neutral' | 'tired' | 'none', CSSProperties> = {
  energetic: { filter: 'saturate(1.08)' },
  neutral: {},
  tired: { filter: 'grayscale(.5) contrast(.97)', opacity: 0.9, transform: 'translateY(5px)' },
  // brightness(0) 把整张图压成黑，13% 不透明度落在纸白上就是浅灰剪影
  none: { filter: 'grayscale(1) brightness(0)', opacity: 0.13 },
}

export function Avatar({
  avatarKey,
  stage,
  state,
  alt,
  className,
  priority = false,
  thumb = false,
}: {
  avatarKey: string
  stage: Stage
  /** null = 今天还没出刊。这不是一种状态，是没有内容。 */
  state: DailyState
  alt: string
  className?: string
  priority?: boolean
  /** 朋友排用：换成 192×384 的 WebP 缩略图，约 16 KB 而不是 300 KB */
  thumb?: boolean
}) {
  const intrinsic = thumb ? AVATAR_THUMB_INTRINSIC : AVATAR_INTRINSIC

  return (
    <img
      src={thumb ? avatarThumbSrc(avatarKey, stage) : avatarSrc(avatarKey, stage)}
      width={intrinsic.width}
      height={intrinsic.height}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      // 四档共用同一个盒子 + contain，保证切档时头顶脚底不跳
      className={`h-full w-full object-contain ${className ?? ''}`}
      style={ART_STYLE[state ?? 'none']}
    />
  )
}
