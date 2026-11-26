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

// 지금 열려 있는 화면의 스크립트 이름 (배포마다 바뀜). 개발 서버에서는 없음
const scriptName = html => html.match(/\/assets\/storyboard-[\w-]+\.js/)?.[0] ?? null
export const currentBuild = () => scriptName(document.documentElement.outerHTML)

export async function deployedBuild() {
  const res = await fetch('/storyboard', { cache: 'no-store' })
  if (!res.ok) return null
  return scriptName(await res.text())
}
