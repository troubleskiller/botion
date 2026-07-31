import type { Stage } from './logic'

/**
 * 小人素材 —— dev-spec 第 8 节。
 *
 * 路径：public/avatars/{avatar_key}_{stage}.png，stage ∈ 1..4
 * 规格：512×1024 透明背景，角色高度固定 921px，基线 y=973，四档已对齐。
 * 四档共用同一个盒子 + object-fit: contain，所以切档时头顶和脚底不会跳动。
 *
 * 现有素材只有两套：you_1..4 和 friend_1..4。
 * 所以首页自己的主位固定用 you，朋友横排用各自 profile 的 avatar_key
 * （0004 迁移里默认建成 friend）。等哪天有了逐人素材，
 * 只要把每个 profile 的 avatar_key 改掉，朋友横排自动生效。
 */
/**
 * 建档时的默认套系（0004 迁移里写死的也是它）。
 * 每个人的实际套系存在 profiles.avatar_key，首页主位和朋友横排都读那个 ——
 * 用 npm run users:avatar 邮箱 套系名 指派。这里只是兜底。
 */
export const DEFAULT_AVATAR_KEY = 'friend'

export function avatarSrc(avatarKey: string, stage: Stage): string {
  return `/avatars/${avatarKey}_${stage}.png`
}

/**
 * 朋友排用的缩略图。盒子只有 72×96 CSS px，contain 后实际画到 48×96，
 * 3x DPR 需要 144×288 —— 为此下发 300 KB 的原图纯属浪费（19 个朋友
 * 5.3 MB）。缩略图 192×384 的 WebP，约 16 KB。
 *
 * 由 scripts/make-avatar-thumbs.mjs 等比缩放生成，所以基线位置按比例
 * 完全保持，四档之间照样不跳动（npm run verify:avatars 验这一条）。
 *
 * 自己的主位不用缩略图 —— 那里渲染到 190×312 CSS px，3x 下比原图还大。
 */
export function avatarThumbSrc(avatarKey: string, stage: Stage): string {
  return `/avatars/thumb/${avatarKey}_${stage}.webp`
}

/** 素材尺寸，给 <img> 的 width/height 用，避免加载时布局跳动 */
export const AVATAR_INTRINSIC = { width: 512, height: 1024 } as const
export const AVATAR_THUMB_INTRINSIC = { width: 192, height: 384 } as const
