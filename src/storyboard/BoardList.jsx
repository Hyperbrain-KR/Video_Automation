import { useEffect, useState } from 'react'
import { createBoard, deleteBoard, listBoards } from './api'
import { openBoard } from './nav'
import ThemeToggle from './ThemeToggle'

const when = iso => new Date(iso).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

function BoardCard({ board, mine, onDelete }) {
  return (
    <div className="sb-card" role="link" tabIndex={0}
      onClick={() => openBoard(board.id)} onKeyDown={e => { if (e.key === 'Enter') openBoard(board.id) }}>
      <div className="sb-card-title">{board.title}</div>
      <div className="sb-card-meta">
        {board.frames?.length ?? 0}개 프레임 · {when(board.updated_at)}{mine ? '' : ` · ${board.owner_name}`}
      </div>
      {mine && (
        <button className="sb-card-delete" title="보드 삭제"
          onClick={e => { e.stopPropagation(); onDelete(board) }}>삭제</button>
      )}
    </div>
  )
}

export default function BoardList({ user }) {
  const [boards, setBoards] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    listBoards().then(setBoards).catch(e => setError(e.message))
  }, [])

  const create = async () => {
    setBusy(true)
    try { openBoard((await createBoard(user)).id) } catch (e) { setError(e.message); setBusy(false) }
  }
  const remove = async board => {
    if (!window.confirm(`"${board.title}" 보드를 삭제할까요? 이미지와 댓글도 함께 지워지며 되돌릴 수 없습니다.`)) return
    try {
      await deleteBoard(board)
      setBoards(bs => bs.filter(b => b.id !== board.id))
    } catch (e) { setError(e.message) }
  }

  const mine = boards?.filter(b => b.owner_id === user.id) ?? []
  const team = boards?.filter(b => b.owner_id !== user.id) ?? []

  return (
    <div className="sb-page">
      <header className="sb-header">
        <div className="sb-brand"><img src="/logo-square.png" alt="" width="22" height="22" /> Storyboard</div>
        <div className="sb-header-actions">
          <ThemeToggle />
          <button className="sb-btn sb-btn-primary" onClick={create} disabled={busy}>+ 새 스토리보드</button>
        </div>
      </header>
      <main className="sb-list">
        {error && <div className="sb-alert" role="alert">⚠ {error}</div>}
        {!boards && !error && <div className="sb-muted">불러오는 중…</div>}
        {boards && (
          <>
            <section>
              <h2>내 스토리보드</h2>
              {mine.length ? <div className="sb-grid">{mine.map(b => <BoardCard key={b.id} board={b} mine onDelete={remove} />)}</div>
                : <div className="sb-muted">아직 없습니다. 오른쪽 위 "새 스토리보드"로 시작하세요.</div>}
            </section>
            <section>
              <h2>팀 스토리보드 <span className="sb-muted">보기·댓글만 가능</span></h2>
              {team.length ? <div className="sb-grid">{team.map(b => <BoardCard key={b.id} board={b} />)}</div>
                : <div className="sb-muted">팀원이 만든 보드가 없습니다.</div>}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
