/**
 * 从 public/avatars 里发现有哪些小人套系。
 *
 * 文件名规则是 {avatar_key}_{stage}.png，stage ∈ 1..4。
 * 早期这两个脚本把 ['you','friend'] 写死了，现在改成扫目录 ——
 * 你往里丢 alice_1..4.png，生成缩略图和几何校验就自动带上它，
 * 不用改任何代码。
 */
import { readdirSync } from 'node:fs'

export const STAGES = [1, 2, 3, 4]
export const AVATAR_DIR = 'public/avatars'
export const THUMB_DIR = 'public/avatars/thumb'

/**
 * @returns {{ complete: string[], incomplete: Array<{key: string, missing: number[]}> }}
 *   complete   —— 四档齐全的套系名，已排序
 *   incomplete —— 缺档的，附上缺哪几档，好让调用方报出来而不是默默跳过
 */
export function discoverSets(dir = AVATAR_DIR) {
  const byKey = new Map()

  for (const name of readdirSync(dir)) {
    const match = /^(.+)_([1-4])\.png$/.exec(name)
    if (match === null) continue
    const [, key, stage] = match
    if (!byKey.has(key)) byKey.set(key, new Set())
    byKey.get(key).add(Number(stage))
  }

  const complete = []
  const incomplete = []

  for (const [key, stages] of [...byKey.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const missing = STAGES.filter((s) => !stages.has(s))
    if (missing.length === 0) complete.push(key)
    else incomplete.push({ key, missing })
  }

  return { complete, incomplete }
}
