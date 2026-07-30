/**
 * 报头下的粗细双线 —— 设计系统 readme 说的 front-page furniture：
 * 这套版面唯一允许出现线的地方，用满墨色。
 * 其余分区一律靠留白，不要用线、框、卡片。
 *
 * 设计稿：border-top 3px + 2.5px 间隙 + border-top 1px。
 */
export function ThickThinRule({ thick = 3 }: { thick?: 3 | 2 }) {
  return (
    <div aria-hidden="true">
      <div
        className="border-t-ink mt-[7px]"
        style={{ borderTopWidth: `${thick}px`, borderTopStyle: 'solid' }}
      />
      <div className="border-ink mt-[2.5px] border-t" />
    </div>
  )
}
