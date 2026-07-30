'use client'

import { useEffect, useRef } from 'react'
import { setTimeZoneOnce } from '@/app/actions/profile'
import { detectTimeZone } from '@/lib/date'

/**
 * 首次登录时探测一次浏览器时区，写进自己的档案。之后再也不跑。
 * 不渲染任何东西 —— 没有设置页（dev-spec 第 0 节），这一步必须是无声的。
 */
export function TimeZoneSync({ needsDetection }: { needsDetection: boolean }) {
  const sent = useRef(false)

  useEffect(() => {
    if (!needsDetection || sent.current) return
    sent.current = true
    void setTimeZoneOnce(detectTimeZone())
  }, [needsDetection])

  return null
}
