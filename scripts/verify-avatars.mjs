/**
 * 小人素材几何自测 —— dev-spec 第 8 节 + 第 11 节验收第 7 条
 * 「四档切换时小人的头顶和脚底位置不发生跳动」。
 *
 * 光看图看不出来 1px 的错位，所以这里直接量：把每张 PNG 的 alpha 通道
 * 扫一遍，找出不透明像素的外框，然后核对
 *   画布 512×1024
 *   角色高度 921px
 *   基线（脚底）y = 973
 * 四档的头顶 y 和脚底 y 必须完全一致 —— 一致才能对 <img> 直接做交叉淡入。
 *
 *   node scripts/verify-avatars.mjs
 */
import { existsSync } from 'node:fs'
import sharp from 'sharp'

const DIR = 'public/avatars'
const SETS = ['you', 'friend']
const STAGES = [1, 2, 3, 4]

const CANVAS = { width: 512, height: 1024 }
const FIGURE_HEIGHT = 921
const BASELINE = 973
/** 抗锯齿和描边会让边缘差一两个像素，允许 ±2px */
const TOLERANCE = 2
/** alpha 低于这个值当透明，避免羽化边缘被算进外框 */
const ALPHA_FLOOR = 8

let failed = 0
let passed = 0

function check(label, ok, detail = '') {
  if (ok) {
    passed += 1
    console.log(`  ✓ ${label}`)
  } else {
    failed += 1
    console.log(`  ✗ ${label}${detail ? `\n      ${detail}` : ''}`)
  }
}

async function measure(file) {
  const image = sharp(file)
  const meta = await image.metadata()
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true })

  let top = Infinity
  let bottom = -Infinity
  let left = Infinity
  let right = -Infinity

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[(y * info.width + x) * info.channels + 3]
      if (alpha > ALPHA_FLOOR) {
        if (y < top) top = y
        if (y > bottom) bottom = y
        if (x < left) left = x
        if (x > right) right = x
      }
    }
  }

  return {
    width: meta.width,
    height: meta.height,
    hasAlpha: meta.hasAlpha === true,
    top,
    // bottom 是最后一行不透明像素的索引；基线是它下面那条边
    baseline: bottom + 1,
    figureHeight: bottom - top + 1,
    left,
    right,
  }
}

const near = (a, b) => Math.abs(a - b) <= TOLERANCE

async function main() {
  const missing = []
  for (const set of SETS) {
    for (const stage of STAGES) {
      const file = `${DIR}/${set}_${stage}.png`
      if (!existsSync(file)) missing.push(file)
    }
  }
  if (missing.length > 0) {
    console.error('缺素材：\n  ' + missing.join('\n  '))
    console.error('\n规格见 public/avatars/README.md')
    process.exit(1)
  }

  for (const set of SETS) {
    console.log(`\n${set}_1..4.png`)
    const measured = []

    for (const stage of STAGES) {
      const file = `${DIR}/${set}_${stage}.png`
      const m = await measure(file)
      measured.push({ stage, ...m })

      const label = `${set}_${stage}`
      check(
        `${label} 画布 ${CANVAS.width}×${CANVAS.height}`,
        m.width === CANVAS.width && m.height === CANVAS.height,
        `实际 ${m.width}×${m.height}`,
      )
      check(`${label} 有透明通道`, m.hasAlpha)
      check(`${label} 角色高 ${FIGURE_HEIGHT}px`, near(m.figureHeight, FIGURE_HEIGHT),
        `实际 ${m.figureHeight}px（差 ${m.figureHeight - FIGURE_HEIGHT}）`)
      check(`${label} 基线 y=${BASELINE}`, near(m.baseline, BASELINE),
        `实际 y=${m.baseline}（差 ${m.baseline - BASELINE}）`)
      check(`${label} 横向没出画布`, m.left >= 0 && m.right < CANVAS.width,
        `左 ${m.left} 右 ${m.right}`)
    }

    // 验收第 7 条：四档之间头顶和脚底必须对齐
    const tops = measured.map((m) => m.top)
    const baselines = measured.map((m) => m.baseline)
    const topSpread = Math.max(...tops) - Math.min(...tops)
    const baseSpread = Math.max(...baselines) - Math.min(...baselines)

    check(`${set} 四档头顶对齐（偏差 ${topSpread}px）`, topSpread <= TOLERANCE,
      measured.map((m) => `${m.stage} 档 y=${m.top}`).join('，'))
    check(`${set} 四档脚底对齐（偏差 ${baseSpread}px）`, baseSpread <= TOLERANCE,
      measured.map((m) => `${m.stage} 档 y=${m.baseline}`).join('，'))

    console.log(
      '    ' +
        measured
          .map((m) => `${m.stage} 档 顶${m.top} 底${m.baseline} 高${m.figureHeight} 宽${m.right - m.left + 1}`)
          .join('\n    '),
    )
  }

  console.log(`\n${'─'.repeat(52)}`)
  console.log(`通过 ${passed} 项，失败 ${failed} 项`)
  if (failed > 0) {
    console.log('素材几何不达标 —— 切档时小人会跳动。')
    process.exit(1)
  }
  console.log('素材几何全部通过：四档切换时头顶和脚底不会移动。')
}

main().catch((err) => {
  console.error(`\n跑挂了：${err.message}`)
  process.exit(1)
})
