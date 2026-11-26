import { useCallback, useEffect, useRef, useState } from 'react'
import { addComment, deleteComment, getBoard, listComments, newFrame, removeImage, saveBoard, signedUrls, uploadFrameImage } from './api'
import { openBoard } from './nav'
import FrameCard from './FrameCard'
import ThemeToggle from './ThemeToggle'

const SAVE_DELAY = 800

export default function BoardView({ boardId, user }) {
  const [board, setBoard] = useState(null)
  const [error, setError] = useState('')
  const [urls, setUrls] = useState({})
  const [comments, setComments] = useState([])
  const [uploading, setUploading] = useState({})
  const [saveState, setSaveState] = useState('saved')
  const [copied, setCopied] = useState(false)
  const timer = useRef(null)
  const latest = useRef(null)

  const canEdit = board?.owner_id === user.id

  useEffect(() => {
    let alive = true
    Promise.all([getBoard(boardId), listComments(boardId)])
      .then(async ([b, cs]) => {
        if (!alive) return
        if (!b) { setError('보드를 찾을 수 없습니다. 삭제됐거나 주소가 잘못됐을 수 있습니다.'); return }
        setBoard(b)
        setComments(cs)
        const paths = b.frames.map(f => f.image).filter(Boolean)
        const signed = await signedUrls(paths)
        if (alive) setUrls(signed)
      })
      .catch(e => alive && setError(e.message))
    return () => { alive = false }
  }, [boardId])

  // 댓글은 팀원이 동시에 달 수 있으므로 주기적으로 새로 받는다
  useEffect(() => {
    const t = setInterval(() => { listComments(boardId).then(setComments).catch(() => {}) }, 30000)
    return () => clearInterval(t)
  }, [boardId])

  const flush = useCallback(async () => {
    clearTimeout(timer.current)
    const b = latest.current
    if (!b) return
    latest.current = null
    setSaveState('saving')
    try {
      await saveBoard(b.id, b)
      setSaveState(s => (s === 'saving' && !latest.current ? 'saved' : s))
    } catch (e) {
      setSaveState('error')
      setError(`저장하지 못했습니다: ${e.message}`)
    }
  }, [])

  useEffect(() => {
    const beforeUnload = e => { if (latest.current) { flush(); e.preventDefault() } }
    window.addEventListener('beforeunload', beforeUnload)
    return () => { window.removeEventListener('beforeunload', beforeUnload); flush() }
  }, [flush])

  const update = patch => {
    setBoard(b => {
      const next = { ...b, ...patch(b) }
      latest.current = next
      return next
    })
    setSaveState('pending')
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, SAVE_DELAY)
  }
  const setFrames = fn => update(b => ({ frames: fn(b.frames) }))
  const patchFrame = (id, patch) => setFrames(fs => fs.map(f => (f.id === id ? { ...f, ...patch } : f)))

  const onImage = async (frame, file) => {
    setUploading(u => ({ ...u, [frame.id]: true }))
    try {
      const path = await uploadFrameImage(user.id, boardId, frame.id, file)
      const signed = await signedUrls([path])
      setUrls(u => ({ ...u, ...signed }))
      const old = frame.image
      patchFrame(frame.id, { image: path })
      removeImage(old)
    } catch (e) {
      setError(`이미지를 올리지 못했습니다: ${e.message}`)
    } finally {
      setUploading(u => ({ ...u, [frame.id]: false }))
    }
  }

  const move = (i, dir) => setFrames(fs => {
    const next = [...fs]
    ;[next[i], next[i + dir]] = [next[i + dir], next[i]]
    return next
  })

  const removeFrame = frame => {
    const hasContent = frame.image || ['direction', 'prompt', 'audio', 'narration'].some(k => frame[k]?.trim())
    if (hasContent && !window.confirm('이 프레임을 삭제할까요? 내용과 이미지가 지워집니다.')) return
    setFrames(fs => fs.filter(f => f.id !== frame.id))
    removeImage(frame.image)
  }

  const share = async () => {
    const url = `${window.location.origin}/storyboard?board=${boardId}`
    try { await navigator.clipboard.writeText(url) } catch { window.prompt('공유 링크', url) }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (error && !board) return (
    <div className="sb-center">
      <div className="sb-alert" role="alert">⚠ {error}</div>
      <button className="sb-btn" onClick={() => openBoard(null)}>목록으로</button>
    </div>
  )
  if (!board) return <div className="sb-center">불러오는 중…</div>

  const saveText = { saved: '저장됨', pending: '저장 대기', saving: '저장 중…', error: '저장 실패' }[saveState]

  return (
    <div className="sb-page">
      <header className="sb-header">
        <button className="sb-btn sb-btn-ghost" onClick={() => { flush(); openBoard(null) }} title="목록으로">‹ 목록</button>
        {canEdit
          ? <input className="sb-title" value={board.title} aria-label="보드 제목" onChange={e => update(() => ({ title: e.target.value }))} />
          : <h1 className="sb-title is-static">{board.title}</h1>}
        <div className="sb-header-actions">
          {canEdit
            ? <span className={`sb-save sb-save-${saveState}`}>{saveText}</span>
            : <span className="sb-badge" title="만든 사람만 수정할 수 있습니다">{board.owner_name} · 보기·댓글만</span>}
          <ThemeToggle />
          <button className="sb-btn" onClick={share} title="허용된 팀원만 열 수 있습니다">{copied ? '✓ 링크 복사됨' : '🔗 공유 링크'}</button>
        </div>
      </header>
      {error && <div className="sb-alert sb-alert-bar" role="alert">⚠ {error} <button className="sb-link" onClick={() => setError('')}>닫기</button></div>}
      <main className="sb-board">
        {board.frames.map((f, i) => (
          <FrameCard key={f.id} index={i} total={board.frames.length} frame={f}
            imageUrl={f.image ? urls[f.image] : null} canEdit={canEdit} uploading={!!uploading[f.id]}
            onChange={patch => patchFrame(f.id, patch)}
            onImage={file => onImage(f, file)}
            onRemoveImage={() => { removeImage(f.image); patchFrame(f.id, { image: null }) }}
            onMove={dir => move(i, dir)} onDelete={() => removeFrame(f)}
            comments={comments.filter(c => c.frame_id === f.id)} userId={user.id}
            onAddComment={async body => { const c = await addComment(boardId, f.id, body, user); setComments(cs => [...cs, c]) }}
            onDeleteComment={async id => { await deleteComment(id); setComments(cs => cs.filter(c => c.id !== id)) }}
          />
        ))}
        {canEdit && (
          <button className="sb-add-frame" onClick={() => setFrames(fs => [...fs, newFrame()])}>+ 프레임 추가</button>
        )}
      </main>
    </div>
  )
}
