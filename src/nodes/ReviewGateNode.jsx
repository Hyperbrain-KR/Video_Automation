import { useState, useContext } from 'react'
import { Handle, Position, useReactFlow } from '@xyflow/react'
import { ProjectContext } from '../lib/ProjectContext'

const C = {
  blue: '#1F41B0',
  cyan: '#29D9D9',
  red: '#E34054',
  light: 'var(--t1)',
  textMuted: 'var(--t3)',
}

const glass = {
  background: 'var(--node-bg)',
  backdropFilter: 'blur(20px) saturate(160%)',
  WebkitBackdropFilter: 'blur(20px) saturate(160%)',
  border: '1px solid rgba(41,217,217,0.18)',
  boxShadow: [
    'inset 0 1px 0 rgba(255,255,255,0.10)',
    'inset 0 -1px 0 rgba(0,0,0,0.2)',
    '0 8px 32px rgba(0,0,0,0.45)',
    '0 0 0 1px rgba(41,217,217,0.06)',
  ].join(', '),
}

const glassCyan = {
  ...glass,
  border: '1px solid rgba(41,217,217,0.45)',
  boxShadow: [
    'inset 0 1px 0 rgba(255,255,255,0.10)',
    'inset 0 -1px 0 rgba(0,0,0,0.2)',
    '0 8px 32px rgba(0,0,0,0.5)',
    '0 0 0 1px rgba(41,217,217,0.2)',
    '0 0 20px rgba(41,217,217,0.10)',
  ].join(', '),
}

const styles = {
  node: {
    ...glassCyan,
    borderRadius: 12,
    padding: 14,
    width: 380,
    fontSize: 13,
    fontFamily: 'inherit',
  },
  label: {
    fontWeight: 600,
    marginBottom: 10,
    color: C.light,
    fontSize: 13,
    letterSpacing: '0.01em',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: C.cyan,
    background: 'rgba(41,217,217,0.08)',
    border: '1px solid rgba(41,217,217,0.25)',
    borderRadius: 4,
    padding: '2px 7px',
    marginBottom: 10,
  },
  prompt: {
    background: 'var(--node-prompt)',
    border: '1px solid var(--sep)',
    borderRadius: 8,
    padding: '9px 11px',
    marginBottom: 10,
    whiteSpace: 'pre-wrap',
    lineHeight: 1.6,
    color: 'var(--t2)',
    fontSize: 12,
    maxHeight: 120,
    overflowY: 'auto',
  },
  textarea: {
    width: '100%',
    minHeight: 72,
    maxHeight: 120,
    background: 'var(--node-input)',
    border: '1.5px solid rgba(41,217,217,0.5)',
    borderRadius: 8,
    padding: '9px 11px',
    marginBottom: 10,
    fontSize: 12,
    fontFamily: 'inherit',
    resize: 'vertical',
    outline: 'none',
    color: C.light,
    lineHeight: 1.6,
  },
  row: {
    display: 'flex',
    gap: 7,
  },
  btnApprove: {
    flex: 1,
    padding: '7px 0',
    background: 'linear-gradient(135deg, #1F41B0 0%, #29D9D9 100%)',
    color: '#F4F4F4',
    border: 'none',
    borderRadius: 7,
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: '0.02em',
    boxShadow: '0 2px 12px rgba(41,217,217,0.35)',
  },
  btnSecondary: {
    flex: 1,
    padding: '7px 0',
    background: 'var(--node-section)',
    color: C.textMuted,
    border: '1px solid var(--sep2)',
    borderRadius: 7,
    cursor: 'pointer',
    fontSize: 12,
  },
  approvedNode: {
    ...glass,
    border: '1px solid rgba(41,217,217,0.5)',
    background: 'rgba(41,217,217,0.06)',
    boxShadow: [
      'inset 0 1px 0 rgba(255,255,255,0.08)',
      '0 8px 32px rgba(0,0,0,0.45)',
      '0 0 0 1px rgba(41,217,217,0.2)',
      '0 0 24px rgba(41,217,217,0.12)',
    ].join(', '),
    borderRadius: 12,
    padding: 14,
    minWidth: 280,
    fontSize: 13,
    fontFamily: 'inherit',
  },
  approvedRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  approvedText: {
    color: C.light,
    fontWeight: 600,
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  approvedDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: C.cyan,
    display: 'inline-block',
    boxShadow: `0 0 10px ${C.cyan}, 0 0 20px rgba(41,217,217,0.4)`,
  },
  resetBtn: {
    fontSize: 11,
    color: C.textMuted,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
  },
}

const CANVAS_API = 'http://localhost:3002'

function CharCount({ text, charLimit }) {
  if (!charLimit) return null
  const len = text.length
  const over = len > charLimit
  return (
    <div style={{
      textAlign: 'right', fontSize: 10, fontWeight: 700,
      color: over ? C.red : len > charLimit * 0.9 ? '#f59e0b' : 'var(--t5)',
      marginTop: -6, marginBottom: 8,
      transition: 'color 0.2s',
    }}>
      {len.toLocaleString()} / {charLimit.toLocaleString()}
      {over && ' ⚠'}
    </div>
  )
}

export default function ReviewGateNode({ id, data, selected }) {
  const { updateNodeData, getEdges, getNodes } = useReactFlow()
  const projectId = useContext(ProjectContext)
  const [isEditing, setIsEditing] = useState(false)
  const [prompt, setPrompt] = useState(data.prompt ?? '(프롬프트 없음)')
  const charLimit = data.charLimit ?? (data.label?.includes('비디오 프롬프트') ? 2500 : null)
  const [showKo, setShowKo] = useState(false)
  const [koText, setKoText] = useState(null)
  const [translating, setTranslating] = useState(false)

  const [editTab, setEditTab] = useState('direct')   // 'direct' | 'ai'
  const [feedback, setFeedback] = useState('')
  const [feedbackImages, setFeedbackImages] = useState([]) // [{ data, mediaType, previewUrl }]
  const [regenerating, setRegenerating] = useState(false)
  const [isDraggingOver, setIsDraggingOver] = useState(false)


  // 승인된 프롬프트를 상위 ClaudeNode에 역전파
  const syncToClaudeNode = (approvedPrompt) => {
    const upstreamEdge = getEdges().find(e => e.target === id)
    if (!upstreamEdge) return
    const upstreamNode = getNodes().find(n => n.id === upstreamEdge.source)
    if (upstreamNode?.type === 'claudeNode') {
      updateNodeData(upstreamEdge.source, { result: approvedPrompt })
    }
  }

  // data.approved가 소스 오브 트루스 — status는 파생값
  const status = data.approved && !isEditing ? 'approved' : isEditing ? 'editing' : 'pending'

  const addFeedbackImage = (file) => {
    if (!file || feedbackImages.length >= 3) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target.result
      const [meta, data] = dataUrl.split(',')
      const mediaType = meta.split(':')[1].split(';')[0]
      setFeedbackImages(prev => [...prev, { data, mediaType, previewUrl: dataUrl }])
    }
    reader.readAsDataURL(file)
  }

  const regenerate = async () => {
    if (!feedback.trim() || regenerating) return
    setRegenerating(true)
    try {
      const res = await fetch(`${CANVAS_API}/api/claude/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: 'You are refining an AI image/video generation prompt based on user feedback. Preserve the original structure and what works well — apply only the requested changes. Output the revised English prompt only, no explanations, no preamble.',
          userMessage: `Original prompt:\n${prompt}\n\nUser feedback:\n${feedback.trim()}`,
          maxTokens: charLimit ? charLimit + 300 : 2000,
          projectId: projectId ?? undefined,
          images: feedbackImages.length ? feedbackImages.map(({ data, mediaType }) => ({ data, mediaType })) : undefined,
        }),
      })
      if (!res.ok) throw new Error('재생성 실패')
      const { text } = await res.json()
      setPrompt(text)
      updateNodeData(id, { prompt: text, approved: false })
      setFeedback('')
      setFeedbackImages([])
      setIsEditing(false)
    } catch (err) {
      console.error('[regenerate]', err.message)
    } finally {
      setRegenerating(false)
    }
  }

  // 외부 prompt 변경(Claude 생성·프로젝트 전환) 시 텍스트 동기화
  // syncedDataPrompt가 data.prompt로 초기화되므로 첫 렌더는 조건이 false — skip 자동 처리
  const [syncedDataPrompt, setSyncedDataPrompt] = useState(data.prompt)
  if (syncedDataPrompt !== data.prompt) {
    setSyncedDataPrompt(data.prompt)
    if (data.prompt && data.prompt !== '(프롬프트 없음)') {
      setPrompt(data.prompt)
      setIsEditing(false)
      setShowKo(false)
      setKoText(null)
    }
  }

  const toggleTranslation = async () => {
    if (showKo) { setShowKo(false); return }
    if (koText) { setShowKo(true); return }
    setTranslating(true)
    try {
      const res = await fetch(`${CANVAS_API}/api/claude/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: 'Translate the following English AI image/video generation prompt into natural Korean. Output Korean translation only — no explanations, no English.',
          userMessage: prompt,
          maxTokens: 4000,
          projectId: projectId ?? undefined,
        }),
      })
      const data2 = await res.json()
      setKoText(data2.text || '번역 실패')
      setShowKo(true)
    } catch {
      setKoText('번역 오류')
      setShowKo(true)
    } finally {
      setTranslating(false)
    }
  }

  const selectedGlow = selected ? {
    border: '1px solid #29D9D9',
    boxShadow: [
      'inset 0 1px 0 rgba(255,255,255,0.16)',
      'inset 0 -1px 0 rgba(0,0,0,0.2)',
      '0 0 0 1.5px #29D9D9',
      '0 0 16px rgba(41,217,217,0.75)',
      '0 0 40px rgba(41,217,217,0.4)',
      '0 0 80px rgba(41,217,217,0.18)',
      '0 8px 32px rgba(0,0,0,0.55)',
    ].join(', '),
  } : {}

  const handles = (
    <>
      <Handle id="left" type="target" position={Position.Left} />
      <Handle id="top" type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </>
  )

  if (status === 'approved') {
    return (
      <div style={{ ...styles.approvedNode, ...selectedGlow }}>
        {handles}
        <div style={styles.approvedRow}>
          <div style={styles.approvedText}>
            <span style={styles.approvedDot} />
            {data.label} — 승인됨
          </div>
          <button style={styles.resetBtn} onClick={() => updateNodeData(id, { approved: false })}>
            되돌리기
          </button>
        </div>
      </div>
    )
  }

  if (status === 'editing') {
    const isAi = editTab === 'ai'
    return (
      <div style={{ ...styles.node, ...selectedGlow }}>
        {handles}
        <div style={styles.statusBadge}>✏ 수정 중</div>
        <div style={styles.label}>{data.label}</div>

        {/* 탭 전환 */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 10,
          background: 'var(--node-prompt)', borderRadius: 6, padding: 3 }}>
          {[['direct', '직접 수정'], ['ai', '✦ AI 재생성']].map(([key, label]) => (
            <button key={key} onClick={() => setEditTab(key)}
              className="nopan nodrag"
              style={{
                flex: 1, padding: '4px 0', fontSize: 10, fontWeight: 700,
                borderRadius: 4, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.15s',
                background: editTab === key
                  ? key === 'ai' ? 'rgba(41,217,217,0.15)' : 'rgba(255,255,255,0.08)'
                  : 'transparent',
                color: editTab === key
                  ? key === 'ai' ? C.cyan : C.light
                  : C.textMuted,
              }}>{label}</button>
          ))}
        </div>

        {/* 직접 수정 */}
        {!isAi && (
          <>
            <textarea style={styles.textarea} value={prompt}
              onChange={e => setPrompt(e.target.value)} />
            <CharCount text={prompt} />
            <div style={styles.row}>
              <button style={styles.btnSecondary} onClick={() => { setIsEditing(false); setPrompt(data.prompt ?? '(프롬프트 없음)') }}>취소</button>
              <button style={styles.btnApprove} onClick={() => { updateNodeData(id, { prompt, approved: true }); setIsEditing(false); syncToClaudeNode(prompt) }}>
                수정 후 승인
              </button>
            </div>
          </>
        )}

        {/* AI 재생성 */}
        {isAi && (
          <>
            {/* 원본 프롬프트 (읽기 전용) */}
            <div style={{
              ...styles.prompt, fontSize: 10, color: 'var(--t4)',
              maxHeight: 72, overflow: 'hidden', position: 'relative', marginBottom: 8,
              userSelect: 'none',
            }}>
              <span style={{
                position: 'absolute', top: 5, right: 7, fontSize: 9,
                color: 'var(--t5)', background: 'var(--node-section)',
                border: '1px solid var(--sep)', borderRadius: 3, padding: '1px 5px',
              }}>원본</span>
              {prompt}
            </div>

            {/* 피드백 입력 */}
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t4)', marginBottom: 5 }}>
              수정 요청
            </div>
            <div
              className="nopan nodrag"
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(true) }}
              onDragEnter={e => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(true) }}
              onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(false) }}
              onDrop={e => {
                e.preventDefault()
                e.stopPropagation()
                setIsDraggingOver(false)
                const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'))
                files.slice(0, 3 - feedbackImages.length).forEach(addFeedbackImage)
              }}
              style={{
                borderRadius: 6,
                border: isDraggingOver ? '1.5px dashed rgba(41,217,217,0.8)' : '1.5px solid transparent',
                background: isDraggingOver ? 'rgba(41,217,217,0.06)' : 'transparent',
                transition: 'all 0.15s',
              }}
            >
            <textarea
              autoFocus
              placeholder={'예) 카메라를 더 가까이\n조명을 따뜻하게\n배경을 실내로 바꿔줘'}
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) regenerate() }}
              className="nopan nodrag"
              style={{
                ...styles.textarea, minHeight: 72,
                border: isDraggingOver ? '1.5px solid rgba(41,217,217,0.6)' : '1.5px solid rgba(41,217,217,0.45)',
              }}
            />

            {/* 이미지 첨부 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              {feedbackImages.map((img, i) => (
                <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
                  <img
                    src={img.previewUrl}
                    style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 5,
                      border: '1px solid rgba(41,217,217,0.35)' }}
                  />
                  <button
                    className="nopan nodrag"
                    onClick={() => setFeedbackImages(prev => prev.filter((_, j) => j !== i))}
                    style={{
                      position: 'absolute', top: -5, right: -5,
                      width: 14, height: 14, borderRadius: '50%',
                      background: '#E34054', border: 'none', cursor: 'pointer',
                      fontSize: 8, color: '#fff', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', padding: 0,
                    }}
                  >✕</button>
                </div>
              ))}
              {feedbackImages.length < 3 && (
                <label className="nopan nodrag" style={{
                  width: 48, height: 48, borderRadius: 5, cursor: 'pointer',
                  border: '1px dashed rgba(41,217,217,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, color: 'rgba(41,217,217,0.6)',
                  background: 'rgba(41,217,217,0.04)',
                  transition: 'all 0.15s',
                }}>
                  📎
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    style={{ display: 'none' }}
                    onChange={e => { addFeedbackImage(e.target.files[0]); e.target.value = '' }}
                    className="nopan nodrag"
                  />
                </label>
              )}
            </div>
            </div>{/* drop zone end */}

            <div style={{ fontSize: 9, color: 'var(--t5)', marginBottom: 8, marginTop: 4, textAlign: 'right' }}>
              ⌘↵ 로 재생성
            </div>

            <div style={styles.row}>
              <button style={styles.btnSecondary} onClick={() => setIsEditing(false)}>취소</button>
              <button
                onClick={regenerate}
                disabled={regenerating || (!feedback.trim() && feedbackImages.length === 0)}
                className="nopan nodrag"
                style={{
                  ...styles.btnApprove,
                  opacity: regenerating || (!feedback.trim() && feedbackImages.length === 0) ? 0.55 : 1,
                  cursor: regenerating || (!feedback.trim() && feedbackImages.length === 0) ? 'not-allowed' : 'pointer',
                }}
              >
                {regenerating ? '⚙ 재생성 중…' : '↺ 재생성'}
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div style={{ ...styles.node, ...selectedGlow }}>
      {handles}
      <div style={styles.statusBadge}>⏳ 검토 대기</div>
      <div style={styles.label}>{data.label}</div>

      {/* 프롬프트 / 번역 토글 영역 */}
      <div
        onClick={toggleTranslation}
        title={showKo ? '클릭하면 영어 원문 보기' : '클릭하면 한국어 번역 보기'}
        style={{
          ...styles.prompt,
          cursor: translating ? 'wait' : 'pointer',
          position: 'relative',
          userSelect: 'none',
        }}
      >
        {translating
          ? <span style={{ color: 'var(--t4)' }}>번역 중…</span>
          : (showKo ? koText : prompt)
        }
        <span style={{
          position: 'absolute', bottom: 6, right: 8,
          fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
          color: showKo ? C.cyan : 'var(--t4)',
          background: showKo ? 'rgba(41,217,217,0.1)' : 'var(--node-section)',
          border: `1px solid ${showKo ? 'rgba(41,217,217,0.3)' : 'var(--sep)'}`,
          borderRadius: 3, padding: '1px 5px',
          transition: 'all 0.2s',
        }}>
          {showKo ? 'KO' : 'EN'}
        </span>
      </div>

      <CharCount text={prompt} />
      <div style={styles.row}>
        <button style={styles.btnSecondary} onClick={() => { setEditTab('direct'); setFeedback(''); setIsEditing(true) }}>
          수정
        </button>
        <button style={styles.btnApprove} onClick={() => { updateNodeData(id, { approved: true }); syncToClaudeNode(prompt) }}>
          승인
        </button>
      </div>
    </div>
  )
}
