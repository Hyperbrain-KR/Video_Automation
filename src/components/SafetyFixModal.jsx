import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { requestSafetyFix, translateFix, wordDiff } from '../lib/safetyFix'
import { friendlyError } from '../lib/friendlyError'

const del = { color: 'var(--diff-del-text)', background: 'var(--diff-del-bg)', borderRadius: 2, padding: '0 1px' }
const add = { color: 'var(--diff-add-text)', background: 'var(--diff-add-bg)', textDecoration: 'underline', textUnderlineOffset: 2, borderRadius: 2, padding: '0 1px' }

const CONTEXT = 45
const flat = t => t.replace(/\s+/g, ' ')
const tail = t => { const s = flat(t); return s.length > CONTEXT ? `…${s.slice(-CONTEXT).replace(/^\S*\s/, '')}` : s.trimStart() }
const head = t => { const s = flat(t); return s.length > CONTEXT ? `${s.slice(0, CONTEXT).replace(/\s\S*$/, '')}…` : s.trimEnd() }

// 바뀐 단어만 강조하고, 바뀌지 않은 긴 구간은 접는다
function Words({ parts, skip, style }) {
  const shown = parts.filter(p => p.type !== skip)
  return shown.map((p, i) => {
    if (p.type !== 'same') return <span key={i} style={style}>{p.text}</span>
    const text = flat(p.text)
    if (text.length <= CONTEXT * 2) return <span key={i}>{text}</span>
    const left = i === 0 ? '' : head(text)
    const right = i === shown.length - 1 ? '' : tail(text)
    return <span key={i}>{left && right ? `${left} ${right.slice(1)}` : left || right}</span>
  })
}

// 바뀐 곳만 모아 보여준다 (앞뒤 문맥 + 이유)
export function SafetyChanges({ segments }) {
  const line = { fontSize: 11, lineHeight: 1.6, color: 'var(--t1)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', display: 'flex', gap: 6 }
  let n = 0
  return segments.map((g, i) => {
    if (g.same !== undefined) return null
    n++
    const parts = wordDiff(g.del, g.add)
    const koParts = wordDiff(g.delKo ?? '', g.addKo ?? '')
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
        {(g.delKo || g.addKo) && (
          <div style={{ ...line, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--sep2)' }}>
            <b style={{ flexShrink: 0, color: 'var(--t2)' }}>번역</b>
            <div style={{ minWidth: 0 }}>
              <div style={line}><b style={{ color: 'var(--diff-del-text)' }}>−</b><span><Words parts={koParts} skip="add" style={del} /></span></div>
              <div style={line}><b style={{ color: 'var(--diff-add-text)' }}>+</b><span>{g.addKo ? <Words parts={koParts} skip="del" style={add} /> : '(삭제)'}</span></div>
            </div>
          </div>
        )}
      </div>
    )
  })
}

function FullText({ segments, projectId }) {
  const [lang, setLang] = useState('en')
  const [ko, setKo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const showKo = () => {
    setLang('ko')
    if (ko || loading) return
    setLoading(true)
    setError('')
    translateFix({ segments, projectId })
      .then(setKo)
      .catch(e => { setError(friendlyError(e.message)); setLang('en') })
      .finally(() => setLoading(false))
  }
  const tab = on => ({
    padding: '3px 10px', borderRadius: 5, fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
    color: on ? 'var(--accent-text)' : 'var(--t2)', background: on ? 'var(--btn-done-bg)' : 'transparent',
    border: `1px solid ${on ? 'var(--btn-done-border)' : 'var(--sep2)'}`,
  })

  return (
    <>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
      <button onClick={() => setLang('en')} style={tab(lang === 'en')}>영어 원문</button>
      <button onClick={showKo} style={tab(lang === 'ko')}>한글 번역</button>
      {error && <span style={{ fontSize: 11, color: 'var(--error-text)' }}>⚠ {error}</span>}
    </div>
    <div style={{ fontSize: 11, lineHeight: 1.65, color: 'var(--t1)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      padding: '10px 12px', background: 'var(--node-prompt)', border: '1px solid var(--sep2)', borderRadius: 8 }}>
      {lang === 'ko'
        ? (ko ? ko.map((p, i) => <span key={i} style={p.changed ? add : undefined}>{p.text}</span>) : '번역 중…')
        : segments.map((g, i) => g.same !== undefined
          ? <span key={i}>{g.same}</span>
          : <span key={i}><span style={del}>{g.del}</span><span style={add}>{g.add}</span></span>)}
    </div>
    </>
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
  const [job, setJob] = useState({ request: '', previous: null })
  const [showFull, setShowFull] = useState(false)
  const [asking, setAsking] = useState(false)
  const [request, setRequest] = useState('')

  useEffect(() => {
    let alive = true
    requestSafetyFix({ prompt, code, isVideo, limit, projectId, ...job })
      .then(r => { if (alive) setFix(r) })
      .catch(e => { if (alive) setError(friendlyError(e.message)) })
    return () => { alive = false }
  }, [job]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const retry = () => {
    setJob({ request, previous: fix?.count ? fix : null })
    setFix(null)
    setError('')
    setAsking(false)
    setShowFull(false)
  }
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
          {job.request && (
            <div style={{ fontSize: 11, lineHeight: 1.6, color: 'var(--t1)', background: 'var(--btn-done-bg)', border: '1px solid var(--btn-done-border)', borderRadius: 8, padding: '7px 11px', marginBottom: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              <b style={{ color: 'var(--accent-text)' }}>반영한 요청</b> {job.request}
            </div>
          )}
          {!fix && !error && <div style={{ fontSize: 12, color: 'var(--t2)', padding: '18px 0' }}>⚙ {job.request ? '요청을 반영해 다시 고치는 중…' : '막혔을 만한 표현을 찾아 고치는 중…'}</div>}
          {error && (
            <div role="alert" style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--diff-del-text)', background: 'var(--diff-del-bg)', borderRadius: 8, padding: '9px 11px', marginBottom: 8 }}>
              ⚠ {error}
            </div>
          )}
          {fix?.count === 0 && (
            <div style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--t1)', padding: '8px 0' }}>
              {job.request
                ? '요청을 지키면서 고칠 만한 표현을 찾지 못했습니다. 요청을 바꿔보거나, 참조 이미지나 첫 프레임을 바꿔보세요.'
                : '프롬프트에서 막힐 만한 표현을 찾지 못했습니다. 참조 이미지나 첫 프레임이 원인일 수 있으니 이미지를 바꿔보세요.'}
            </div>
          )}
          {fix?.count > 0 && (
            <>
              <SafetyChanges segments={fix.segments} />
              <button onClick={() => setShowFull(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t2)', fontSize: 11, fontWeight: 700, padding: '4px 0 8px', fontFamily: 'inherit' }}>
                {showFull ? '▾' : '▸'} 전체 프롬프트 보기 (바뀐 곳 강조)
              </button>
              {showFull && <FullText segments={fix.segments} projectId={projectId} />}
              <div style={{ fontSize: 11, lineHeight: 1.6, color: 'var(--t2)', marginTop: 8 }}>
                Higgsfield가 막은 이유를 알려주지 않아 추정해서 고쳤습니다. 적용 후에도 막히면 참조 이미지를 바꿔보세요.
              </div>
            </>
          )}
        </div>

        {asking ? (
          <div style={{ marginTop: 14 }}>
            <label htmlFor="safety-fix-request" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--t1)', marginBottom: 6 }}>
              요청 사항 <span style={{ fontWeight: 400, color: 'var(--t2)' }}>(선택) 꼭 있어야 하는 연출이나 바꾸고 싶은 방향을 적어주세요</span>
            </label>
            <textarea
              id="safety-fix-request" autoFocus value={request} rows={3} maxLength={1000}
              onChange={e => setRequest(e.target.value)}
              onKeyDown={e => {
                e.stopPropagation()
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) retry()
              }}
              placeholder={'예) 욕조는 꼭 있어야 해요. 아기는 옷을 입은 모습으로 바꿔주세요.'}
              style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: '9px 11px', fontSize: 12, lineHeight: 1.6, fontFamily: 'inherit',
                color: 'var(--t1)', background: 'var(--node-input)', border: '1px solid var(--btn-done-border)', borderRadius: 8, outline: 'none' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => setAsking(false)} style={btn(false)}>돌아가기</button>
              <button onClick={retry} style={btn(true)}>{request.trim() ? '요청 반영해서 다시 수정' : '요청 없이 다시 수정'} (⌘↵)</button>
            </div>
          </div>
        ) : (
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button onClick={onClose} style={btn(false)}>{fix?.count === 0 ? '닫기' : '취소'}</button>
          {(error || fix) && <button onClick={() => setAsking(true)} style={btn(false)}>다시 수정</button>}
          {fix?.count > 0 && <button onClick={() => apply(false)} style={btn(false)}>적용만</button>}
          {fix?.count > 0 && <button onClick={() => apply(true)} style={btn(true)}>적용하고 재생성</button>}
        </div>
        )}
      </div>
    </div>,
    document.body
  )
}
