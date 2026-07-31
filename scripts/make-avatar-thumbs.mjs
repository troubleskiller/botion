/**
 * 生成朋友排用的小人缩略图。
 *
 *   npm run avatars:thumbs
 *
 * 为什么要这一步：朋友排的盒子是 72×96 CSS px，图是 1:2 比例，contain
 * 之后实际只画到 48×96 —— 3x DPR 下 144×288 设备像素就够了。而原图是
 * 512×1024 / 约 300 KB。19 个朋友就是 5.3 MB，全为了画成指甲盖大小。
 *
 * 输出 192×384 的 WebP（约 18 KB），横向留了余量：设计稿的「强调」版
 * 缩略图是 86×108 的盒子，3x 下需要 162×324，也覆盖得住。
 *
 * 格式选 WebP 不选 PNG：同尺寸下 18 KB vs 64 KB。dev-spec 第 0 节写明
 * 全部是 iPhone 用户，iOS 14+ 原生支持 WebP。
 *
 * 缩放是等比的（512→192 正好 1:2.667），所以角色的基线位置按比例完全
 * 保持 —— 四档之间仍然不会跳动。npm run verify:avatars 会验这一条。
 */
import { mkdirSync } from 'node:fs'
import sharp from 'sharp'

const SRC = 'public/avatars'
const OUT = 'public/avatars/thumb'
const SETS = ['you', 'friend']
const STAGES = [1, 2, 3, 4]

export const THUMB = { width: 192, height: 384, quality: 88 }

mkdirSync(OUT, { recursive: true })

let total = 0
for (const set of SETS) {
  for (const stage of STAGES) {
    const info = await sharp(`${SRC}/${set}_${stage}.png`)
      .resize(THUMB.width, THUMB.height, { fit: 'fill' })
      .webp({ quality: THUMB.quality })
      .toFile(`${OUT}/${set}_${stage}.webp`)
    total += info.size
    console.log(`  ${OUT}/${set}_${stage}.webp  ${Math.round(info.size / 1024)} KB`)
  }
}

console.log(`\n8 张合计 ${Math.round(total / 1024)} KB（原图合计约 2200 KB）`)
