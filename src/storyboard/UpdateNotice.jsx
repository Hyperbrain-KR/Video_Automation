import { useEffect, useState } from 'react'
import { currentBuild, deployedBuild, fetchChangelog, latestNew, markSeen, readSeen, stripTags } from './updates'

const POLL = 60 * 1000

// 1) 접속했을 때 안 본 업데이트가 있으면 바뀐 점 팝업
// 2) 보드를 열어둔 동안 새 버전이 배포되면 아래쪽에 새로고침 안내
export default function UpdateNotice() {
  const [latest, setLatest] = useState(null)
  const [showPopup, setShowPopup] = useState(false)
  const [newBuild, setNewBuild] = useState(false)

  useEffect(() => {
    fetchChangelog().then(log => {
      const l = latestNew(log)
      setLatest(l)
      if (l.key && l.key !== readSeen()) setShowPopup(true)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const mine = currentBuild()
    if (!mine) return
    const check = async () => {
      try {
        const live = await deployedBuild()
        if (live && live !== mine) {
          setNewBuild(true)
          fetchChangelog().then(log => setLatest(latestNew(log))).catch(() => {})
        }
      } catch { /* 네트워크 오류는 다음 확인 때 다시 */ }
    }
    const t = setInterval(check, POLL)
    const onFocus = () => { if (!document.hidden) check() }
    document.addEventListener('visibilitychange', onFocus)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onFocus) }
  }, [])

  const close = () => { markSeen(latest?.key ?? ''); setShowPopup(false) }

  return (
    <>
      {showPopup && latest?.items.length > 0 && (
        <div className="sb-modal-back" onClick={close}>
          <div className="sb-modal" role="dialog" aria-modal="true" aria-labelledby="sb-update-title" onClick={e => e.stopPropagation()}>
            <h2 id="sb-update-title">스토리보드가 업데이트됐습니다</h2>
            <div className="sb-muted">{latest.date}</div>
            <ul>{latest.items.map(i => <li key={i}>{stripTags(i)}</li>)}</ul>
            <div className="sb-modal-actions">
              <button className="sb-btn sb-btn-primary" onClick={close} autoFocus>확인</button>
            </div>
          </div>
        </div>
      )}
      {newBuild && !showPopup && (
        <div className="sb-update-bar" role="status">
          <span>새 버전이 나왔습니다</span>
          {latest?.items.length > 0 && <button className="sb-link-accent" onClick={() => setShowPopup(true)}>바뀐 점</button>}
          <button className="sb-btn sb-btn-primary sb-btn-sm" onClick={() => window.location.reload()}>새로고침</button>
        </div>
      )}
    </>
  )
}
