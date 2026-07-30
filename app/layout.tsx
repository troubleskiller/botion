import type { Metadata, Viewport } from 'next'
import { Source_Serif_4 } from 'next/font/google'
import './globals.css'

/**
 * --font-heading / --font-body 都是 Source Serif 4（设计系统 styles.css）。
 * adjustFontFallback 关掉：默认会插一层按 Arial 度量校正的本地兜底字体，
 * 中文字形会落到那层上；关掉之后字体链就是设计稿写的
 * Source Serif 4 → system-ui → sans-serif，中文落在 system-ui。
 */
const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-source-serif',
  fallback: ['system-ui', 'sans-serif'],
  adjustFontFallback: false,
})

export const metadata: Metadata = {
  title: '练报',
  description: '二十个人的一份小报，每天出一期。你出刊，这期才出得来。',
  /**
   * 只加 manifest，不加 Service Worker、不加 Web Push ——
   * Phase 2 第 6 项的其余部分一律不做。
   *
   * 加它是因为第 11 节验收第 8 条「在 iPhone 上添加到主屏后可以正常打开
   * 并保持登录」要的是独立窗口：没有 manifest 也能加到主屏，但会带着
   * Safari 的地址栏打开。iOS 16.4+ 认 manifest 的 display: standalone，
   * 老版本认 apple-mobile-web-app-capable，所以两个都给。
   */
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: '练报',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/icons/192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // 不锁 maximumScale —— 禁用缩放会挡掉低视力用户放大页面。
  // iOS 输入框聚焦时的自动放大改用 16px 字号解决（见 login 页的注释）。
  themeColor: '#f3f2f2', // --color-bg
  viewportFit: 'cover', // 让 env(safe-area-inset-*) 生效
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={sourceSerif.variable}>
      <body>{children}</body>
    </html>
  )
}
