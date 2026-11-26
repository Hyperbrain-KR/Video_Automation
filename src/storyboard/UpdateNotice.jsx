import { useEffect, useRef, useState } from 'react'
import { alreadyTried, applyUpdate, canAutoApply, currentBuild, deployedBuild, fetchChangelog, latestNew, markSeen, readSeen, stripTags } from './updates'

const POLL = 60 * 1000
const IDLE = 30 * 1000

// 1) 접속했을 때 안 본 업데이트가 있으면 바뀐 점 팝업
// 2) 작업 중 새 버전이 배포되면 안내하고, 30초 동안 손을 떼거나 다른 탭에 가 있으면 저장 후 자동 적용
export default function UpdateNotice() {
  const [latest, setLatest] = useState(null)
  const [showPopup, setShowPopup] = useState(false)
  const [newBuild, setNewBuild] = useState(null)
  const [blocked, setBlocked] = useState('')
  const lastActive = useRef(0)

  useEffect(() => {
    fetchChangelog().then(log => {
      const l = latestNew(log)
      setLatest(l)
      if (l.key && l.key !== readSeen()) setShowPopup(true)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    lastActive.current = Date.now()
    const touch = () => { lastActive.current = Date.now() }
    const events = ['keydown', 'pointerdown', 'input', 'wheel']
    events.forEach(e => window.addEventListener(e, touch, { capture: true, passive: true }))
    return () => events.forEach(e => window.removeEventListener(e, touch, { capture: true }))
  }, [])

  useEffect(() => {
    const mine = currentBuild()
    if (!mine) return
    const check = async () => {
      try {
        const live = await deployedBuild()
        if (live && live !== mine) {
          setNewBuild(live)
          fetchChangelog().then(log => setLatest(latestNew(log))).catch(() => {})
        }
      } catch { /* 네트워크 오류는 다음 확인 때 다시 */ }
    }
    const t = setInterval(check, POLL)
    const onVisible = () => { if (!document.hidden) check() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  // 새 버전이 있으면 사용자가 쉬는 틈에 저장하고 적용
  useEffect(() => {
    if (!newBuild || alreadyTried(newBuild)) return
    let running = false
    const tick = async () => {
      const idle = document.hidden || Date.now() - lastActive.current > IDLE
      if (!idle || running) return
      if (!canAutoApply()) { setBlocked('올리는 중인 이미지나 쓰던 댓글이 있어 자동으로 적용하지 않았습니다'); return }
      running = true
      if (!(await applyUpdate(newBuild))) setBlocked('저장하지 못해 자동으로 적용하지 않았습니다')
      running = false
    }
    const t = setInterval(tick, 5000)
    return () => clearInterval(t)
  }, [newBuild])

  const close = () => { markSeen(latest?.key ?? ''); setShowPopup(false) }
  const applyNow = async () => {
    if (!canAutoApply() && !window.confirm('올리는 중인 이미지나 쓰던 댓글이 사라질 수 있습니다. 지금 적용할까요?')) return
    if (!(await applyUpdate(newBuild))) setBlocked('저장하지 못해 적용하지 않았습니다. 잠시 뒤 다시 눌러주세요')
  }

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
          <span className="sb-update-text">
            새 버전이 나왔습니다
            <small>{blocked || '잠시 손을 떼면 저장 후 자동으로 적용됩니다'}</small>
          </span>
          {latest?.items.length > 0 && <button className="sb-link-accent" onClick={() => setShowPopup(true)}>바뀐 점</button>}
          <button className="sb-btn sb-btn-primary sb-btn-sm" onClick={applyNow}>지금 적용</button>
        </div>
      )}
    </>
  )
}
