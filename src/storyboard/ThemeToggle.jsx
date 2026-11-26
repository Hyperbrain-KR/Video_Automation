import { useState } from 'react'

export default function ThemeToggle() {
  const [theme, setTheme] = useState(document.documentElement.dataset.theme)
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try { localStorage.setItem('canvas-theme', next) } catch { /* 저장 불가 환경: 이번 화면에만 적용 */ }
    setTheme(next)
  }
  return (
    <button className="sb-btn sb-btn-ghost" onClick={toggle} title={theme === 'dark' ? '라이트 모드' : '다크 모드'} aria-label="테마 전환">
      {theme === 'dark' ? '☀︎' : '☾'}
    </button>
  )
}
