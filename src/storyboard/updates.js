// 스토리보드 업데이트 내역(public/storyboard-changelog.json)과 새 배포 감지
// 캔버스 앱 내역(server/changelog.json)과 따로 관리한다

const SEEN_KEY = 'sb-changelog-seen'

export async function fetchChangelog() {
  const res = await fetch('/storyboard-changelog.json', { cache: 'no-store' })
  if (!res.ok) throw new Error(`업데이트 내역을 불러오지 못했습니다 (${res.status})`)
  return res.json()
}

export const stripTags = item => item.replace(/^(\[[A-Z]+\])+\s*/, '')

// 가장 최근 날짜의 [NEW] 항목들 — 이게 바뀌면 "안 본 업데이트"로 본다
export function latestNew(changelog) {
  const first = changelog?.[0]
  const items = first?.items?.filter(i => i.startsWith('[NEW]')) ?? []
  return { date: first?.date ?? '', items, key: items.length ? `${first.date}:${items.join('|')}` : '' }
}

export function readSeen() {
  try { return localStorage.getItem(SEEN_KEY) ?? '' } catch { return '' }
}
export function markSeen(key) {
  try { localStorage.setItem(SEEN_KEY, key) } catch { /* 저장 못 해도 다음에 다시 보일 뿐 */ }
}

// ── 새 버전 적용 ─────────────────────────────────────────
// 화면(보드)이 "지금 바쁜지"와 "저장하기"를 등록해 두면, 적용 전에 저장부터 한다
const guards = new Set()
export function registerUpdateGuard(guard) {
  guards.add(guard)
  return () => guards.delete(guard)
}

const hasCommentDraft = () => [...document.querySelectorAll('.sb-comment-new textarea')].some(t => t.value.trim())
export const canAutoApply = () => !hasCommentDraft() && ![...guards].some(g => g.busy())

const TRIED_KEY = 'sb-update-tried'
const SCROLL_KEY = 'sb-update-scroll'

// 같은 새 버전으로 이미 한 번 새로고침했는데 또 옛 화면이면(배포 반영 지연 등) 자동으로 다시 하지 않는다
export function alreadyTried(build) {
  try { return sessionStorage.getItem(TRIED_KEY) === build } catch { return false }
}

export async function applyUpdate(build) {
  for (const g of guards) {
    if (!(await g.save())) return false
  }
  try {
    sessionStorage.setItem(TRIED_KEY, build ?? '')
    const board = document.querySelector('.sb-board')
    sessionStorage.setItem(SCROLL_KEY, JSON.stringify({ at: location.search, x: board?.scrollLeft ?? 0, y: window.scrollY }))
  } catch { /* 위치 복원만 못 할 뿐 */ }
  window.location.reload()
  return true
}

// 새로고침 전에 보던 위치로 돌아가기
export function restoreScroll() {
  try {
    const s = JSON.parse(sessionStorage.getItem(SCROLL_KEY) ?? 'null')
    sessionStorage.removeItem(SCROLL_KEY)
    if (!s || s.at !== location.search) return
    requestAnimationFrame(() => {
      const board = document.querySelector('.sb-board')
      if (board) board.scrollLeft = s.x
      window.scrollTo(0, s.y)
    })
  } catch { /* 무시 */ }
}

// 지금 열려 있는 화면의 스크립트 이름 (배포마다 바뀜). 개발 서버에서는 없음
const scriptName = html => html.match(/\/assets\/storyboard-[\w-]+\.js/)?.[0] ?? null
export const currentBuild = () => scriptName(document.documentElement.outerHTML)

export async function deployedBuild() {
  const res = await fetch('/storyboard', { cache: 'no-store' })
  if (!res.ok) return null
  return scriptName(await res.text())
}
