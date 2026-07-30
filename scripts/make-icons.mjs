/**
 * PWA 图标。用设计系统的 token 画：纸白底、满墨的粗细双线、衬线字距的
 * 拉丁小标，主体是「练报」两个字。
 *
 *   node scripts/make-icons.mjs
 *
 * 输出 public/icons/{192,512,apple-touch-icon}.png。
 * 图标是刻意做成可重跑的 —— 想换直接改这里的 SVG 再跑一次。
 */
import { mkdirSync } from 'node:fs'
import sharp from 'sharp'

const OUT = 'public/icons'

// 全部来自 _ds/broadsheet-.../styles.css 的 :root
const PAPER = '#f3f2f2'
const INK = '#201e1d'
const ACCENT = '#0088b0'

/**
 * 在 S×S 的方形里排版。iOS 会把图标裁成圆角矩形并可能再套一层遮罩，
 * 所以内容留出 ~14% 的安全边距。
 */
function svg(S) {
  const pad = Math.round(S * 0.145)
  const inner = S - pad * 2
  const ruleThick = Math.max(2, Math.round(S * 0.028))
  const ruleThin = Math.max(1, Math.round(S * 0.0095))
  const ruleGap = Math.max(1, Math.round(S * 0.012))
  const kickerSize = Math.round(S * 0.062)
  const wordSize = Math.round(S * 0.315)

  const ruleY = Math.round(pad + inner * 0.2)
  const wordY = Math.round(pad + inner * 0.78)
  const kickerY = ruleY - Math.round(S * 0.035)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <rect width="${S}" height="${S}" fill="${PAPER}"/>
  <text x="${pad}" y="${kickerY}"
        font-family="Georgia, 'Times New Roman', serif"
        font-size="${kickerSize}" letter-spacing="${kickerSize * 0.22}"
        fill="${ACCENT}">DAILY REP</text>
  <rect x="${pad}" y="${ruleY}" width="${inner}" height="${ruleThick}" fill="${INK}"/>
  <rect x="${pad}" y="${ruleY + ruleThick + ruleGap}" width="${inner}" height="${ruleThin}" fill="${INK}"/>
  <text x="${pad}" y="${wordY}"
        font-family="'PingFang SC', 'Hiragino Sans GB', 'Heiti SC', 'Songti SC', sans-serif"
        font-size="${wordSize}" font-weight="600"
        fill="${INK}">练报</text>
</svg>`
}

mkdirSync(OUT, { recursive: true })

for (const size of [192, 512, 180]) {
  const name = size === 180 ? 'apple-touch-icon' : String(size)
  await sharp(Buffer.from(svg(size))).png().toFile(`${OUT}/${name}.png`)
  console.log(`${OUT}/${name}.png  ${size}×${size}`)
}
