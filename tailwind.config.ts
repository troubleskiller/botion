import type { Config } from 'tailwindcss'

/**
 * 设计 token —— 全部提取自 Claude Design 项目「练报设计原型」的
 *   _ds/broadsheet-3e484d86-57e3-4a71-b1e1-193d63776f3d/styles.css 的 :root
 * 并与同目录 _ds_manifest.json 的 tokens 数组逐条交叉核对（49 个 token 全覆盖）。
 *
 * 纪律（来自设计系统 readme.md 的 Do / Don't）：
 *   - 组件里不要硬编码色值、字号、间距、圆角、阴影 —— 一律走这里的 token。
 *   - 版面靠留白和字号分层，不用线、不用框、不用卡片做布局。
 *   - accent（青）用于可交互元素；accent2（洋红）是更罕见的第二专色，
 *     在本项目里只允许出现在一个地方：自己今天还没出刊的入口。
 *   - 间距是 1.25× 的宽松阶梯，不要收紧。
 *   - 不要为界面引入无衬线字体 —— 衬线就是这套系统的界面字体。
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#f3f2f2', // --color-bg
        surface: '#eae9e9', // --color-surface
        ink: '#201e1d', // --color-text
        // --color-divider: color-mix(in srgb, #201e1d 16%, transparent)
        divider: 'rgb(32 30 29 / 0.16)',

        // --color-accent-* 青，交互色
        accent: {
          DEFAULT: '#0088b0',
          100: '#e9f8ff',
          200: '#cbeeff',
          300: '#99e0ff',
          400: '#62c5ee',
          500: '#38a6cf',
          600: '#1186ac',
          700: '#006786',
          800: '#004961',
          900: '#0a303e',
        },

        // --color-accent-2-* 洋红，第二专色。用之前先想清楚
        accent2: {
          DEFAULT: '#d6006c',
          100: '#fff1f4',
          200: '#ffdee6',
          300: '#ffc0d0',
          400: '#ff90b1',
          500: '#ff458e',
          600: '#d82071',
          700: '#aa0b56',
          800: '#790e3d',
          900: '#4b1528',
        },

        // --color-neutral-*。注意：这里整体替换了 Tailwind 自带的 neutral，
        // 所以 neutral-50 / neutral-950 不存在 —— 用了会报错，这是故意的。
        neutral: {
          100: '#f8f4f4',
          200: '#eae7e7',
          300: '#d7d3d3',
          400: '#bab6b6',
          500: '#9b9797',
          600: '#7d7979',
          700: '#605d5d',
          800: '#444141',
          900: '#2d2b2b',
        },

        // --color-process-yellow。只用于印刷处理（CMYK 分色 / 版号），
        // 正文和界面 chrome 永远不取这个色。Phase 1 用不到。
        'process-yellow': '#edbb00',
      },

      fontFamily: {
        // --font-heading / --font-body 都是 Source Serif 4。
        // 尾部 system-ui 是设计稿里中文实际的落点（Source Serif 4 无 CJK 字形）。
        heading: ['var(--font-source-serif)', 'system-ui', 'sans-serif'],
        body: ['var(--font-source-serif)', 'system-ui', 'sans-serif'],
      },

      fontWeight: {
        // --font-heading-weight
        heading: '600',
      },

      /**
       * 字号阶梯。前段是设计系统 styles.css 的 h1–h6 / body，
       * 后段是 P0 设计稿在 368px 画布上实际用到的级别 —— 按 px 命名，
       * 方便和设计稿逐行对照（text-ds-11.5 ↔ font-size:11.5px）。
       */
      fontSize: {
        'ds-8.5': ['8.5px', { lineHeight: '1' }],
        'ds-9.5': ['9.5px', { lineHeight: '1' }],
        'ds-10': ['10px', { lineHeight: '1' }],
        'ds-11': ['11px', { lineHeight: '1.5' }],
        'ds-11.5': ['11.5px', { lineHeight: '1.5' }],
        'ds-12': ['12px', { lineHeight: '1.5' }],
        'ds-12.5': ['12.5px', { lineHeight: '1.5' }],
        'ds-13': ['13px', { lineHeight: '1.55' }], // h6
        'ds-14': ['14px', { lineHeight: '1.55' }],
        'ds-15': ['15px', { lineHeight: '1.55' }], // body
        'ds-16': ['16px', { lineHeight: '1.12' }], // h5
        'ds-17': ['17px', { lineHeight: '1.2' }], // .card-title
        'ds-19': ['19px', { lineHeight: '1' }],
        'ds-20': ['20px', { lineHeight: '1.12' }], // h4
        'ds-22': ['22px', { lineHeight: '1' }],
        'ds-23': ['23px', { lineHeight: '1.06' }],
        'ds-24': ['24px', { lineHeight: '1' }],
        'ds-25': ['25px', { lineHeight: '1.12' }], // h3
        'ds-26': ['26px', { lineHeight: '1.06' }],
        'ds-27': ['27px', { lineHeight: '1' }],
        'ds-32': ['32px', { lineHeight: '1.12' }], // h2
        'ds-42': ['42px', { lineHeight: '1.12' }], // h1
      },

      letterSpacing: {
        // 标题 / 大字负字距
        'ds-heading': '-0.015em',
        'ds-display': '-0.01em',
        // 印章、导航等小幅正字距
        'ds-stamp': '0.02em',
        'ds-nav': '0.04em',
        // 全大写小标签的字距，由小到大
        'ds-h6': '0.08em',
        'ds-label': '0.16em',
        'ds-wide': '0.2em',
        'ds-kicker': '0.22em',
        'ds-mast': '0.3em',
      },

      // --space-*，density 1.25×。不覆盖 Tailwind 默认阶梯，加前缀共存。
      spacing: {
        'ds-1': '5px',
        'ds-2': '10px',
        'ds-3': '15px',
        'ds-4': '20px',
        'ds-6': '30px',
        'ds-8': '40px',
      },

      // --radius-*
      borderRadius: {
        'ds-sm': '1px',
        'ds-md': '2px',
        'ds-lg': '4px',
      },

      // --shadow-*，已按纸白底调过
      boxShadow: {
        'ds-sm': '0 1px 2px rgb(45 43 43 / 0.14)',
        'ds-md': '0 3px 10px rgb(45 43 43 / 0.16)',
        'ds-lg': '0 12px 32px rgb(45 43 43 / 0.22)',
      },

      // 设计稿 <style> 里定义的关键帧，逐条搬过来。
      // 全部在 globals.css 里受 prefers-reduced-motion 约束。
      keyframes: {
        breathe: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '.72' },
        },
        sheetUp: {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        stampIn: {
          '0%': { transform: 'scale(2.4) rotate(-14deg)', opacity: '0' },
          '55%': { transform: 'scale(.94) rotate(-5deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(-5deg)', opacity: '1' },
        },
        riseIn: {
          from: { transform: 'translateY(14px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        tick: {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '40%': { transform: 'translateY(-16px)', opacity: '0' },
          '41%': { transform: 'translateY(16px)' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        breathe: 'breathe 2.6s ease-in-out infinite',
        'sheet-up': 'sheetUp .3s cubic-bezier(.22,1,.32,1)',
        'fade-in': 'fadeIn .2s ease-out',
        'fade-in-fast': 'fadeIn .18s ease-out',
        'stamp-in': 'stampIn .52s cubic-bezier(.3,1.5,.5,1) .3s both',
        'rise-in': 'riseIn .5s cubic-bezier(.22,1,.32,1) both',
        'rise-in-late': 'riseIn .5s cubic-bezier(.22,1,.32,1) .42s both',
        tick: 'tick .5s ease-in-out .1s both',
      },
    },
  },
  plugins: [],
}

export default config
