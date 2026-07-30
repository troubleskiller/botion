import { describe, expect, it } from 'vitest'
import {
  computeState,
  computeStage,
  computeStreak,
  computeTDEE,
  isTargetSafe,
  stageFillRatio,
  stageName,
  stateName,
  toNextStage,
  KCAL_FLOOR,
  NOT_PUBLISHED_LABEL,
  STAGE_THRESHOLDS,
  type State,
} from './logic'

describe('computeState —— 今日状态只由睡眠和饮水决定', () => {
  /**
   * 12 格全枚举。这张表同时锁住三件事：
   *   1. dev-spec 第 5 节 computeState 的分支判定
   *   2. 0003 迁移里 public_status 视图的同一段 SQL case
   *   3. 训练不参与状态计算（规则 1）—— 表里没有 trained 这一维
   * 改任何一处都要同步另一处，否则首页显示的状态会和朋友看到的不一致。
   */
  const TABLE: ReadonlyArray<readonly [sleep: number, water: number, expected: State]> = [
    [1, 1, 'tired'],
    [1, 2, 'tired'],
    [1, 3, 'tired'],
    [2, 1, 'tired'],
    [2, 2, 'neutral'],
    [2, 3, 'neutral'],
    [3, 1, 'neutral'],
    [3, 2, 'energetic'],
    [3, 3, 'energetic'],
    [4, 1, 'neutral'],
    [4, 2, 'energetic'],
    [4, 3, 'energetic'],
  ]

  it.each(TABLE)('睡眠 %i / 饮水 %i → %s', (sleep, water, expected) => {
    expect(computeState(sleep, water)).toBe(expected)
  })

  it('覆盖 4×3 全部组合，一格不漏', () => {
    expect(TABLE).toHaveLength(12)
    const keys = new Set(TABLE.map(([s, w]) => `${s}-${w}`))
    expect(keys.size).toBe(12)
  })

  it('训练与否不影响状态（规则 1）', () => {
    // computeState 的签名里根本没有 trained —— 这条测试是把这个约束写下来，
    // 防止以后有人图省事把 trained 塞进状态计算。
    expect(computeState.length).toBe(2)
  })

  it('设计稿的和值算法与 dev-spec 有两格不同，按 dev-spec', () => {
    // 设计稿用 sleep + water >= 6 → 精神 / <= 3 → 蔫，和分支判定在这两格分歧。
    // 你的规则是「数据规则听 dev-spec」，所以取 dev-spec 的结果。
    expect(computeState(1, 3)).toBe('tired') // 设计稿会算成「普通」
    expect(computeState(3, 2)).toBe('energetic') // 设计稿会算成「普通」
  })
})

describe('stateName', () => {
  it('三种状态的中文名', () => {
    expect(stateName('energetic')).toBe('精神')
    expect(stateName('neutral')).toBe('普通')
    expect(stateName('tired')).toBe('蔫')
  })

  it('未打卡不是一种状态，文案与「蔫」完全不同（规则 3）', () => {
    expect(stateName(null)).toBe(NOT_PUBLISHED_LABEL)
    expect(stateName(null)).not.toBe(stateName('tired'))
  })
})

describe('computeStage —— 累计训练次数分档', () => {
  it.each([
    [0, 1],
    [1, 1],
    [19, 1],
    [20, 2],
    [21, 2],
    [59, 2],
    [60, 3],
    [61, 3],
    [119, 3],
    [120, 4],
    [121, 4],
    [5000, 4],
  ])('累计 %i 次 → %i 档', (total, expected) => {
    expect(computeStage(total)).toBe(expected)
  })

  it('阈值和 STAGE_THRESHOLDS 一致', () => {
    expect(STAGE_THRESHOLDS).toEqual([0, 20, 60, 120])
    for (const [i, threshold] of STAGE_THRESHOLDS.entries()) {
      expect(computeStage(threshold)).toBe(i + 1)
      if (threshold > 0) expect(computeStage(threshold - 1)).toBe(i)
    }
  })

  it('只涨不跌：累计次数递增时档位单调不减（规则 2）', () => {
    let previous = computeStage(0)
    for (let total = 1; total <= 200; total += 1) {
      const current = computeStage(total)
      expect(current).toBeGreaterThanOrEqual(previous)
      previous = current
    }
  })

  it('停练不会退档 —— 档位只是累计次数的函数，与最近频率无关', () => {
    // 同一个累计次数，无论最后一次训练是昨天还是一年前，结果都一样。
    expect(computeStage(25)).toBe(computeStage(25))
    expect(computeStage(25)).toBe(2)
  })

  it('档位名称来自设计稿', () => {
    expect(stageName(1)).toBe('瘦削')
    expect(stageName(2)).toBe('匀称')
    expect(stageName(3)).toBe('结实')
    expect(stageName(4)).toBe('壮实')
  })
})

describe('toNextStage —— 距离下一档还差几次', () => {
  it.each([
    [0, 20],
    [1, 19],
    [19, 1],
    [20, 40],
    [59, 1],
    [60, 60],
    [119, 1],
  ])('累计 %i 次 → 还差 %i 次', (total, expected) => {
    expect(toNextStage(total)).toBe(expected)
  })

  it('已满档返回 null', () => {
    expect(toNextStage(120)).toBeNull()
    expect(toNextStage(121)).toBeNull()
    expect(toNextStage(9999)).toBeNull()
  })

  it('刚跨过阈值时立刻指向下一档', () => {
    expect(toNextStage(19)).toBe(1)
    expect(toNextStage(20)).toBe(40) // 进 2 档，下一站是 60
  })
})

describe('stageFillRatio —— 当前档内的进度', () => {
  it.each([
    [0, 0],
    [10, 0.5],
    [20, 0],
    [40, 0.5],
    [60, 0],
    [90, 0.5],
    [120, 1],
    [500, 1],
  ])('累计 %i 次 → %f', (total, expected) => {
    expect(stageFillRatio(total)).toBeCloseTo(expected, 10)
  })

  it('永远落在 0..1 之间', () => {
    for (let total = 0; total <= 200; total += 1) {
      const ratio = stageFillRatio(total)
      expect(ratio).toBeGreaterThanOrEqual(0)
      expect(ratio).toBeLessThanOrEqual(1)
    }
  })

  it('满档恒为 1，不会因为继续练而溢出', () => {
    expect(stageFillRatio(120)).toBe(1)
    expect(stageFillRatio(1200)).toBe(1)
  })
})

describe('computeStreak —— 从今天或昨天往前数', () => {
  const TODAY = '2026-07-30'

  it('没有任何记录 → 0', () => {
    expect(computeStreak([], TODAY)).toBe(0)
  })

  it('今天出过刊 → 从今天数', () => {
    expect(computeStreak(['2026-07-30'], TODAY)).toBe(1)
    expect(computeStreak(['2026-07-30', '2026-07-29', '2026-07-28'], TODAY)).toBe(3)
  })

  it('今天还没出刊但昨天出过 → 从昨天数，不算断链', () => {
    expect(computeStreak(['2026-07-29'], TODAY)).toBe(1)
    expect(computeStreak(['2026-07-29', '2026-07-28', '2026-07-27'], TODAY)).toBe(3)
  })

  it('最近一次是前天 → 断了，归零', () => {
    expect(computeStreak(['2026-07-28', '2026-07-27'], TODAY)).toBe(0)
  })

  it('中间缺一天就停在缺口处', () => {
    expect(computeStreak(['2026-07-30', '2026-07-28', '2026-07-27'], TODAY)).toBe(1)
  })

  it('乱序或重复的输入也算得对', () => {
    expect(computeStreak(['2026-07-28', '2026-07-30', '2026-07-29'], TODAY)).toBe(3)
    expect(computeStreak(['2026-07-30', '2026-07-30', '2026-07-29'], TODAY)).toBe(2)
  })

  it('未来的日期不会把链拉长', () => {
    expect(computeStreak(['2026-07-31', '2026-07-30'], TODAY)).toBe(1)
  })

  it('跨月', () => {
    expect(computeStreak(['2026-08-01', '2026-07-31', '2026-07-30'], '2026-08-01')).toBe(3)
  })

  it('跨年', () => {
    expect(computeStreak(['2027-01-01', '2026-12-31', '2026-12-30'], '2027-01-01')).toBe(3)
  })

  it('跨闰日', () => {
    expect(computeStreak(['2028-03-01', '2028-02-29', '2028-02-28'], '2028-03-01')).toBe(3)
  })

  it('连满十天 —— 产品的首要目标', () => {
    const dates = Array.from({ length: 10 }, (_, i) => {
      const day = 30 - i
      return `2026-07-${String(day).padStart(2, '0')}`
    })
    expect(computeStreak(dates, TODAY)).toBe(10)
  })
})

describe('computeTDEE —— Mifflin-St Jeor', () => {
  it('男性', () => {
    expect(
      computeTDEE({ sex: 'male', weightKg: 80, heightCm: 180, age: 30, activityFactor: 1.375 }),
    ).toBe(2448)
  })

  it('女性', () => {
    expect(
      computeTDEE({ sex: 'female', weightKg: 60, heightCm: 165, age: 28, activityFactor: 1.375 }),
    ).toBe(1829)
  })

  it('性别常数差 166 kcal（BMR 层面）', () => {
    const shared = { weightKg: 70, heightCm: 170, age: 30, activityFactor: 1 } as const
    const male = computeTDEE({ ...shared, sex: 'male' })
    const female = computeTDEE({ ...shared, sex: 'female' })
    expect(male - female).toBe(166)
  })

  it('活动系数线性放大', () => {
    const base = { sex: 'male', weightKg: 80, heightCm: 180, age: 30 } as const
    expect(computeTDEE({ ...base, activityFactor: 1 })).toBe(1780)
    expect(computeTDEE({ ...base, activityFactor: 2 })).toBe(3560)
  })

  it('返回整数', () => {
    expect(
      Number.isInteger(
        computeTDEE({ sex: 'female', weightKg: 55.5, heightCm: 162.3, age: 33, activityFactor: 1.375 }),
      ),
    ).toBe(true)
  })
})

describe('isTargetSafe —— 安全下限', () => {
  it('阈值就是 KCAL_FLOOR', () => {
    expect(KCAL_FLOOR).toEqual({ male: 1500, female: 1200 })
  })

  it.each([
    [1500, 'male', true],
    [1499, 'male', false],
    [1200, 'female', true],
    [1199, 'female', false],
    [1300, 'male', false],
    [1300, 'female', true],
  ] as const)('%i kcal / %s → %s', (kcal, sex, expected) => {
    expect(isTargetSafe(kcal, sex)).toBe(expected)
  })
})
