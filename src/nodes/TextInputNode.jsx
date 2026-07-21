import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Handle, Position, useReactFlow } from '@xyflow/react'

const C = {
  cyan: '#29D9D9',
  muted: 'var(--t3)',
  light: 'var(--t1)',
}

const nodeBase = {
  background: 'var(--node-bg)',
  backdropFilter: 'blur(20px) saturate(160%)',
  WebkitBackdropFilter: 'blur(20px) saturate(160%)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 12,
  padding: 14,
  width: 240,
  fontFamily: 'inherit',
  boxShadow: [
    'inset 0 1px 0 rgba(255,255,255,0.10)',
    '0 8px 32px rgba(0,0,0,0.45)',
  ].join(', '),
}

const CANVAS_API = 'http://localhost:3002'
const MAX_HEIGHT = 220

// ── 제안 모달 ─────────────────────────────────────────────────────────────
function SuggestionModal({ isVideo, onClose, onApply }) {
  const [narration, setNarration] = useState('')
  const [intent, setIntent] = useState('')
  const [suggesting, setSuggesting] = useState('')  // '' | 'loading' | error msg

  const suggest = async () => {
    if (!narration.trim()) return
    setSuggesting('loading')
    try {
      const isVid = isVideo
      const systemPrompt = isVid
        ? `You are a creative director helping write video scene directions in Korean.
Given a narration/script excerpt and optional creative intent, suggest a concise Korean video direction.
Focus on: camera movement (줌인, 트래킹, 패닝 등), character action, timing, and atmosphere.
Output ONLY the Korean scene direction — no labels, no explanations.`
        : `You are a creative director helping write image scene directions in Korean.
Given a narration/script excerpt and optional creative intent, suggest a concise Korean image direction.
Focus on: character action and expression, spatial composition, mood and atmosphere.
Output ONLY the Korean scene direction — no labels, no explanations.`

      const userMessage = `나레이션:\n${narration.trim()}${intent.trim() ? `\n\n의도:\n${intent.trim()}` : ''}`

      const res = await fetch(`${CANVAS_API}/api/claude/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt, userMessage, maxTokens: 600 }),
      })
      if (!res.ok) throw new Error('서버 오류')
      const { text } = await res.json()
      onApply(text.trim())
      onClose()
    } catch (err) {
      setSuggesting(err.message || '오류가 발생했습니다')
    }
  }

  const isLoading = suggesting === 'loading'
  const isError   = suggesting && suggesting !== 'loading'

  return createPortal(
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.62)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        width: 420, borderRadius: 14,
        background: 'var(--node-bg)',
        backdropFilter: 'blur(28px) saturate(180%)',
        WebkitBackdropFilter: 'blur(28px) saturate(180%)',
        border: '1px solid rgba(41,217,217,0.28)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(41,217,217,0.1)',
        padding: 22,
        fontFamily: 'inherit',
      }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>
              ✦ 연출 제안 받기
            </div>
            <div style={{ fontSize: 10, color: 'var(--t4)', marginTop: 2 }}>
              {isVideo ? '비디오 연출' : '이미지 연출'} · Claude가 제안
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 16, color: 'var(--t4)', lineHeight: 1, padding: 4,
          }}>✕</button>
        </div>

        {/* 나레이션 */}
        <label style={{ display: 'block', marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)',
            letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6 }}>
            나레이션 / 대사
            <span style={{ color: '#E34054', marginLeft: 3 }}>*</span>
          </div>
          <textarea
            autoFocus
            placeholder={'이 장면에서 주인공이 카페 창가에 앉아 창밖을 바라보며\n커피를 한 모금 마신다...'}
            value={narration}
            onChange={e => setNarration(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) suggest() }}
            style={{
              width: '100%', minHeight: 90,
              background: 'var(--node-input)',
              border: '1.5px solid rgba(41,217,217,0.35)',
              borderRadius: 8, padding: '9px 11px',
              fontSize: 12, fontFamily: 'inherit', resize: 'vertical',
              outline: 'none', color: 'var(--t1)', lineHeight: 1.6,
              boxSizing: 'border-box',
            }}
          />
        </label>

        {/* 의도 (선택) */}
        <label style={{ display: 'block', marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)',
            letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6,
            display: 'flex', alignItems: 'center', gap: 6 }}>
            의도
            <span style={{
              fontSize: 9, fontWeight: 600, color: 'var(--t5)',
              background: 'var(--node-section)', border: '1px solid var(--sep)',
              borderRadius: 3, padding: '1px 5px',
            }}>선택</span>
          </div>
          <textarea
            placeholder={'따뜻하고 감성적인 분위기\n카메라가 천천히 줌인\n인물 중심으로...'}
            value={intent}
            onChange={e => setIntent(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) suggest() }}
            style={{
              width: '100%', minHeight: 64,
              background: 'var(--node-input)',
              border: '1px solid var(--sep2)',
              borderRadius: 8, padding: '9px 11px',
              fontSize: 12, fontFamily: 'inherit', resize: 'vertical',
              outline: 'none', color: 'var(--t1)', lineHeight: 1.6,
              boxSizing: 'border-box',
            }}
          />
        </label>

        {/* 오류 메시지 */}
        {isError && (
          <div style={{ fontSize: 10, color: '#E34054', marginBottom: 10,
            padding: '6px 9px', background: 'rgba(227,64,84,0.08)',
            border: '1px solid rgba(227,64,84,0.2)', borderRadius: 6 }}>
            ⚠ {suggesting}
          </div>
        )}

        <div style={{ fontSize: 9, color: 'var(--t5)', textAlign: 'right', marginBottom: 12 }}>
          ⌘↵ 로 제안 받기
        </div>

        {/* 버튼 */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '9px 0',
            background: 'var(--node-section)', border: '1px solid var(--sep2)',
            borderRadius: 8, fontSize: 12, fontWeight: 700,
            color: 'var(--t3)', cursor: 'pointer', fontFamily: 'inherit',
          }}>
            취소
          </button>
          <button
            onClick={suggest}
            disabled={isLoading || !narration.trim()}
            style={{
              flex: 2, padding: '9px 0',
              background: isLoading
                ? 'var(--node-section)'
                : 'linear-gradient(135deg, #1a3090 0%, #29D9D9 100%)',
              border: isLoading ? '1px solid var(--sep2)' : '1px solid rgba(41,217,217,0.4)',
              borderRadius: 8, fontSize: 12, fontWeight: 700,
              color: isLoading ? 'var(--t5)' : '#F4F4F4',
              cursor: isLoading || !narration.trim() ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              opacity: !narration.trim() ? 0.5 : 1,
              boxShadow: isLoading ? 'none' : '0 2px 12px rgba(41,217,217,0.3)',
              transition: 'all 0.15s',
            }}
          >
            {isLoading ? '⚙ 제안 생성 중…' : '✦ 제안 받기'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── 메인 노드 ─────────────────────────────────────────────────────────────
export default function TextInputNode({ id, data, selected }) {
  const { updateNodeData } = useReactFlow()
  const [value, setValue] = useState(data.value ?? data.defaultValue ?? '')
  const [showModal, setShowModal] = useState(false)
  const textareaRef = useRef(null)

  const isDirectionNode = data.label?.includes('연출')
  const isVideo = data.label?.includes('비디오')

  // 프로젝트 전환 시 노드 data가 교체되면 로컬 state도 동기화
  useEffect(() => {
    setValue(data.value ?? data.defaultValue ?? '')
  }, [data.value])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, MAX_HEIGHT) + 'px'
  }, [value])

  const selectedGlow = selected ? {
    borderColor: '#29D9D9',
    boxShadow: [
      'inset 0 1px 0 rgba(255,255,255,0.16)',
      '0 0 0 1.5px #29D9D9',
      '0 0 16px rgba(41,217,217,0.75)',
      '0 0 40px rgba(41,217,217,0.4)',
      '0 8px 32px rgba(0,0,0,0.55)',
    ].join(', '),
  } : {}

  const handleApply = (text) => {
    setValue(text)
    updateNodeData(id, { value: text })
  }

  return (
    <div style={{ ...nodeBase, ...selectedGlow }}>

      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: C.cyan,
        }}>
          ✏️ {data.label}
        </div>
        {isDirectionNode && (
          <button
            onClick={() => setShowModal(true)}
            className="nopan nodrag"
            style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
              color: C.cyan, background: 'rgba(41,217,217,0.08)',
              border: '1px solid rgba(41,217,217,0.3)',
              borderRadius: 5, padding: '2px 7px',
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(41,217,217,0.16)'
              e.currentTarget.style.borderColor = 'rgba(41,217,217,0.6)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(41,217,217,0.08)'
              e.currentTarget.style.borderColor = 'rgba(41,217,217,0.3)'
            }}
          >
            ✦ 제안받기
          </button>
        )}
      </div>

      <textarea
        ref={textareaRef}
        className="nopan nodrag"
        style={{
          width: '100%',
          minHeight: 80,
          maxHeight: MAX_HEIGHT,
          background: 'var(--node-input)',
          border: '1px solid var(--sep)',
          borderRadius: 7,
          padding: '8px 10px',
          fontSize: 12,
          fontFamily: 'inherit',
          resize: 'none',
          outline: 'none',
          color: 'var(--t2)',
          lineHeight: 1.6,
          boxSizing: 'border-box',
          overflowY: 'auto',
        }}
        placeholder={data.placeholder ?? '내용을 입력하세요...'}
        value={value}
        onChange={e => { setValue(e.target.value); updateNodeData(id, { value: e.target.value }) }}
      />

      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: 'rgba(41,217,217,0.5)',
          border: '1.5px solid #29D9D9',
          boxShadow: '0 0 6px rgba(41,217,217,0.5)',
        }}
      />

      {showModal && (
        <SuggestionModal
          isVideo={isVideo}
          onClose={() => setShowModal(false)}
          onApply={handleApply}
        />
      )}
    </div>
  )
}
