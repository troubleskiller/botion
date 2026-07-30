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
export const SELF_AVATAR_KEY = 'you'

export function avatarSrc(avatarKey: string, stage: Stage): string {
  return `/avatars/${avatarKey}_${stage}.png`
}

/** 素材原始尺寸，给 <img> 的 width/height 用，避免加载时布局跳动 */
export const AVATAR_INTRINSIC = { width: 512, height: 1024 } as const
