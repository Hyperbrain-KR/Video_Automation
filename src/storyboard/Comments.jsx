import { useState } from 'react'

const when = iso => new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function Comments({ comments, userId, onAdd, onDelete }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    const body = text.trim()
    if (!body || busy) return
    setBusy(true)
    try { await onAdd(body); setText('') } finally { setBusy(false) }
  }
  return (
    <div className="sb-comments">
      {comments.map(c => (
        <div key={c.id} className="sb-comment">
          <div className="sb-comment-head">
            <b>{c.author_name}</b>
            <span>{when(c.created_at)}</span>
            {c.author_id === userId && (
              <button className="sb-link" onClick={() => onDelete(c.id)} title="댓글 삭제">삭제</button>
            )}
          </div>
          <div className="sb-comment-body">{c.body}</div>
        </div>
      ))}
      <div className="sb-comment-new">
        <textarea rows={2} value={text} maxLength={2000} placeholder="댓글 달기 (⌘↵ 등록)"
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit() }} />
        <button className="sb-btn sb-btn-primary sb-btn-sm" onClick={submit} disabled={busy || !text.trim()}>등록</button>
      </div>
    </div>
  )
}
