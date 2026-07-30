'use client'

/**
 * 分段控件 —— 设计系统的 .seg / .seg-opt，用原生 radio 实现。
 *
 * 用真 radio 而不是 button：键盘方向键能切换、读屏能念出「N 之 M」、
 * 焦点环由设计系统的 :focus-visible 规则接管（dev-spec 第 10 节要求
 * 键盘焦点可见）。设计系统 readme 也是这个意思 —— form fields on native
 * elements，no script。
 *
 * 尺寸取设计稿在屏内的覆写：flex:1、居中、padding 13px 0、min-height 46px。
 */
export type BandOption = { value: string; label: string }

export function BandGroup({
  name,
  legend,
  options,
  value,
  onChange,
  hint,
}: {
  name: string
  legend: string
  options: readonly BandOption[]
  value: string | null
  onChange: (value: string) => void
  hint?: string
}) {
  return (
    <fieldset>
      <legend className="text-ds-14">{legend}</legend>
      <div className="border-divider rounded-ds-md mt-[9px] flex w-full overflow-hidden border">
        {options.map((option, index) => {
          const checked = value === option.value
          return (
            <label
              key={option.value}
              className={[
                'text-ds-13 relative flex min-h-[46px] flex-1 cursor-pointer items-center justify-center py-[13px]',
                index > 0 ? 'border-divider border-l' : '',
                checked ? 'bg-accent text-paper' : 'hover:bg-ink/[.07] active:bg-ink/[.14]',
                'has-[:focus-visible]:outline-accent has-[:focus-visible]:outline has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-2',
              ].join(' ')}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="pointer-events-none absolute h-0 w-0 opacity-0"
              />
              {option.label}
            </label>
          )
        })}
      </div>
      {hint !== undefined ? (
        <div className="text-ds-11 mt-[7px] text-neutral-700">{hint}</div>
      ) : null}
    </fieldset>
  )
}
