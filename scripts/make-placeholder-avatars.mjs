/**
 * 生成占位小人 —— 只为在真素材到位前能把界面跑起来看版面。
 *
 *   node scripts/make-placeholder-avatars.mjs
 *
 * 几何严格按 dev-spec 第 8 节：512×1024，角色高 921px，基线 y=973，
 * 四档的头顶 y 和脚底 y 完全一致（只有横向变宽）。所以
 * `npm run verify:avatars` 对这批图是全绿的 —— 这也顺便证明了那个
 * 检查脚本本身是对的。
 *
 * 真素材来了直接覆盖同名文件。别把这批图当成能交付的东西。
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

const OUT = 'public/avatars'

const W = 512
const H = 1024
const BASELINE = 973
const FIGURE_HEIGHT = 921
const STROKE = 6

const TOP = BASELINE - FIGURE_HEIGHT // 52
// 描边是居中画的，会往外溢出半个线宽，所以几何往里收 STROKE/2，
// 这样不透明像素的外框正好落在 52..973 上
const DRAW_TOP = TOP + STROKE / 2
const DRAW_BOTTOM = BASELINE - STROKE / 2

const CX = W / 2
const HEAD_R = 78
const HEAD_CY = DRAW_TOP + HEAD_R
const NECK = HEAD_CY + HEAD_R
const SHOULDER = NECK + 26
const HIP = TOP + Math.round(FIGURE_HEIGHT * 0.56)
const KNEE = TOP + Math.round(FIGURE_HEIGHT * 0.79)

/** 四档只改横向尺寸 —— 纵向关键点全档共用，这是「切档不跳动」的前提 */
const STAGES = [
  { torso: 96, arm: 26, thigh: 40 },
  { torso: 116, arm: 32, thigh: 46 },
  { torso: 138, arm: 40, thigh: 54 },
  { torso: 162, arm: 50, thigh: 62 },
]

const SETS = [
  { key: 'you', fill: '#c9b8a4', stroke: '#3a3330' },
  { key: 'friend', fill: '#b9b4ae', stroke: '#403c39' },
]

function svg({ torso, arm, thigh }, fill, stroke) {
  const half = torso / 2
  const legH = DRAW_BOTTOM - HIP + 8
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <g fill="${fill}" stroke="${stroke}" stroke-width="${STROKE}" stroke-linejoin="round" stroke-linecap="round">
    <circle cx="${CX}" cy="${HEAD_CY}" r="${HEAD_R}"/>
    <path d="M${CX - half} ${SHOULDER}
             Q${CX - half - 10} ${(SHOULDER + HIP) / 2} ${CX - half + 6} ${HIP}
             L${CX + half - 6} ${HIP}
             Q${CX + half + 10} ${(SHOULDER + HIP) / 2} ${CX + half} ${SHOULDER} Z"/>
    <rect x="${CX - half - arm}" y="${SHOULDER + 8}" width="${arm}" height="${HIP - SHOULDER - 40}" rx="${arm / 2}"/>
    <rect x="${CX + half}" y="${SHOULDER + 8}" width="${arm}" height="${HIP - SHOULDER - 40}" rx="${arm / 2}"/>
    <rect x="${CX - thigh - 6}" y="${HIP - 8}" width="${thigh}" height="${legH}" rx="${thigh / 2.6}"/>
    <rect x="${CX + 6}" y="${HIP - 8}" width="${thigh}" height="${legH}" rx="${thigh / 2.6}"/>
    <line x1="${CX - thigh / 2 - 6}" y1="${KNEE}" x2="${CX - 6}" y2="${KNEE}" stroke-width="3" opacity=".35"/>
    <line x1="${CX + 6}" y1="${KNEE}" x2="${CX + thigh / 2 + 6}" y2="${KNEE}" stroke-width="3" opacity=".35"/>
  </g>
</svg>`
}

mkdirSync(OUT, { recursive: true })

for (const set of SETS) {
  for (const [i, stage] of STAGES.entries()) {
    const png = await sharp(Buffer.from(svg(stage, set.fill, set.stroke))).png().toBuffer()
    writeFileSync(`${OUT}/${set.key}_${i + 1}.png`, png)
  }
}

console.log(`生成 8 张占位图 → ${OUT}/`)
console.log(`几何：头顶 y=${TOP}，基线 y=${BASELINE}，角色高 ${FIGURE_HEIGHT}，画布 ${W}×${H}`)
console.log('跑 npm run verify:avatars 核对。真素材来了覆盖同名文件即可。')
