import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { requestSafetyFix, wordDiff } from '../lib/safetyFix'
import { friendlyError } from '../lib/friendlyError'

const del = { color: 'var(--diff-del-text)', background: 'var(--diff-del-bg)', textDecoration: 'line-through', borderRadius: 2, padding: '0 1px' }
const add = { color: 'var(--diff-add-text)', background: 'var(--diff-add-bg)', textDecoration: 'underline', textUnderlineOffset: 2, borderRadius: 2, padding: '0 1px' }

const CONTEXT = 45
const flat = t => t.replace(/\s+/g, ' ')
const tail = t => { const s = flat(t); return s.length > CONTEXT ? `…${s.slice(-CONTEXT).replace(/^\S*\s/, '')}` : s.trimStart() }
const head = t => { const s = flat(t); return s.length > CONTEXT ? `${s.slice(0, CONTEXT).replace(/\s\S*$/, '')}…` : s.trimEnd() }

function Words({ parts, skip, style }) {
  return parts.filter(p => p.type !== skip).map((p, i) =>
    p.type === 'same' ? <span key={i}>{p.text}</span> : <span key={i} style={style}>{p.text}</span>)
}

// 바뀐 곳만 모아 보여준다 (앞뒤 문맥 + 이유)
export function SafetyChanges({ segments }) {
  const line = { fontSize: 11, lineHeight: 1.6, color: 'var(--t1)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', display: 'flex', gap: 6 }
  let n = 0
  return segments.map((g, i) => {
    if (g.same !== undefined) return null
    n++
    const parts = wordDiff(g.del, g.add)
    const before = tail(segments[i - 1]?.same ?? '')
    const after = head(segments[i + 1]?.same ?? '')
    return (
      <div key={i} style={{ padding: '9px 11px', marginBottom: 8, background: 'var(--node-prompt)', border: '1px solid var(--sep2)', borderRadius: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t1)', marginBottom: 5 }}>
          {n}. {g.reason || '안전 기준에 맞게 수정'}
        </div>
        <div style={line}>
          <b style={{ color: 'var(--diff-del-text)' }}>−</b>
          <span>{before}<Words parts={parts} skip="add" style={del} />{after}</span>
        </div>
        <div style={line}>
          <b style={{ color: 'var(--diff-add-text)' }}>+</b>
          <span>{before}<Words parts={parts} skip="del" style={add} />{after}</span>
        </div>
      </div>
    )
  })
}

function FullText({ segments }) {
  return (
    <div style={{ fontSize: 11, lineHeight: 1.65, color: 'var(--t1)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      padding: '10px 12px', background: 'var(--node-prompt)', border: '1px solid var(--sep2)', borderRadius: 8 }}>
      {segments.map((g, i) => g.same !== undefined
        ? <span key={i}>{g.same}</span>
        : <span key={i}><span style={del}>{g.del}</span><span style={add}>{g.add}</span></span>)}
    </div>
  )
}

const btn = (primary, disabled) => ({
  flex: primary ? 1.4 : 1, padding: '9px 0', borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
  cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
  color: primary ? 'var(--accent-text)' : 'var(--t1)',
  background: primary ? 'var(--btn-done-bg)' : 'var(--node-section)',
  border: `1px solid ${primary ? 'var(--btn-done-border)' : 'var(--sep2)'}`,
})

export default function SafetyFixModal({ prompt, code, isVideo, limit, projectId, onApply, onClose }) {
  const [fix, setFix] = useState(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [showFull, setShowFull] = useState(false)

  useEffect(() => {
    let alive = true
    requestSafetyFix({ prompt, code, isVideo, limit, projectId })
      .then(r => { if (alive) setFix(r) })
      .catch(e => { if (alive) setError(friendlyError(e.message)) })
    return () => { alive = false }
  }, [attempt]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const retry = () => { setFix(null); setError(''); setAttempt(a => a + 1) }
  const apply = regenerate => {
    const problem = onApply(fix, regenerate)
    if (problem) setError(problem)
  }

  return createPortal(
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{
      position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div className="safety-fix-modal" style={{
        width: 560, maxWidth: '100%', maxHeight: '86vh', display: 'flex', flexDirection: 'column', padding: 20,
        background: 'var(--drop-bg)', border: '1px solid var(--btn-done-border)', borderRadius: 14,
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)', color: 'var(--t1)', fontFamily: 'inherit',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 800 }}>
            ✦ 프롬프트 안전하게 수정{fix?.count ? ` · ${fix.count}곳 변경` : ''}
          </span>
          <button onClick={onClose} aria-label="닫기" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t2)', fontSize: 15 }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, minHeight: 60 }}>
          {!fix && !error && <div style={{ fontSize: 12, color: 'var(--t2)', padding: '18px 0' }}>⚙ 막혔을 만한 표현을 찾아 고치는 중…</div>}
          {error && (
            <div role="alert" style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--diff-del-text)', background: 'var(--diff-del-bg)', borderRadius: 8, padding: '9px 11px', marginBottom: 8 }}>
              ⚠ {error}
            </div>
          )}
          {fix?.count === 0 && (
            <div style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--t1)', padding: '8px 0' }}>
              프롬프트에서 막힐 만한 표현을 찾지 못했습니다. 참조 이미지나 첫 프레임이 원인일 수 있으니 이미지를 바꿔보세요.
            </div>
          )}
          {fix?.count > 0 && (
            <>
              <SafetyChanges segments={fix.segments} />
              <button onClick={() => setShowFull(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t2)', fontSize: 11, fontWeight: 700, padding: '4px 0 8px', fontFamily: 'inherit' }}>
                {showFull ? '▾' : '▸'} 전체 프롬프트 보기 (바뀐 곳 강조)
              </button>
              {showFull && <FullText segments={fix.segments} />}
              <div style={{ fontSize: 11, lineHeight: 1.6, color: 'var(--t2)', marginTop: 8 }}>
                Higgsfield가 막은 이유를 알려주지 않아 추정해서 고쳤습니다. 적용 후에도 막히면 참조 이미지를 바꿔보세요.
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button onClick={onClose} style={btn(false)}>{fix?.count === 0 ? '닫기' : '취소'}</button>
          {(error || fix) && <button onClick={retry} style={btn(false)}>다시 수정</button>}
          {fix?.count > 0 && <button onClick={() => apply(false)} style={btn(false)}>적용만</button>}
          {fix?.count > 0 && <button onClick={() => apply(true)} style={btn(true)}>적용하고 재생성</button>}
        </div>
      </div>
    </div>,
    document.body
  )
}
