import { useState, useRef, useEffect, useContext } from 'react'
import { createPortal } from 'react-dom'
import { Handle, Position, useReactFlow } from '@xyflow/react'
import { ProjectContext } from '../lib/ProjectContext'
import { CANVAS_API } from '../lib/config'
import { saveImage, loadImage, deleteImage } from '../lib/imageDB'
import { generateHandlerRef } from '../lib/generateHandlerRef'

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
  width: 260,
  fontFamily: 'inherit',
  boxShadow: [
    'inset 0 1px 0 rgba(255,255,255,0.10)',
    '0 8px 32px rgba(0,0,0,0.45)',
  ].join(', '),
}

const MAX_HEIGHT = 220

// ── 연출 제안 모달 ────────────────────────────────────────────────────────
function SuggestionModal({ onClose, onApply, projectId, styleAnchor, directionImage }) {
  const [narration, setNarration] = useState('')
  const [intent, setIntent] = useState('')
  const [suggesting, setSuggesting] = useState('')

  const suggest = async () => {
    if (!narration.trim()) return
    setSuggesting('loading')
    try {
      const anchor = styleAnchor?.trim()
      const hasImage = !!directionImage
      const systemPrompt = `You are a creative director writing Korean video scene directions.
${anchor ? "The project has a fixed visual style defined by a style anchor. Your direction MUST reflect and be consistent with that anchor's aesthetic, mood, and cinematography language." : ''}
${hasImage ? 'A reference image of the character is provided. Use it to inform the character\'s appearance and feel in the direction.' : ''}
Given the narration and optional intent, suggest a concise Korean video direction (camera movement, character action, timing, atmosphere).
Output ONLY the Korean direction — no labels, no explanations.`

      const userMessage = [
        anchor ? `[스타일 앵커]\n${anchor}` : '',
        hasImage ? '[캐릭터 레퍼런스 이미지가 첨부되어 있습니다. 이 캐릭터의 외형과 분위기를 연출에 반영해 주세요.]' : '',
        `[나레이션]\n${narration.trim()}`,
        intent.trim() ? `[의도]\n${intent.trim()}` : '',
      ].filter(Boolean).join('\n\n')

      const images = directionImage ? [directionImage] : undefined

      const res = await fetch(`${CANVAS_API}/api/claude/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt, userMessage, maxTokens: 600, projectId: projectId ?? undefined, images }),
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>✦ 연출 제안 받기</div>
            <div style={{ fontSize: 10, color: 'var(--t4)', marginTop: 2 }}>비디오 연출 · Claude가 제안</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--t4)', lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        <label style={{ display: 'block', marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6 }}>
            나레이션 / 대사 <span style={{ color: '#E34054', marginLeft: 3 }}>*</span>
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

        <label style={{ display: 'block', marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            의도
            <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--t5)', background: 'var(--node-section)', border: '1px solid var(--sep)', borderRadius: 3, padding: '1px 5px' }}>선택</span>
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

        {isError && (
          <div style={{ fontSize: 10, color: '#E34054', marginBottom: 10, padding: '6px 9px', background: 'rgba(227,64,84,0.08)', border: '1px solid rgba(227,64,84,0.2)', borderRadius: 6 }}>
            ⚠ {suggesting}
          </div>
        )}

        <div style={{ fontSize: 9, color: 'var(--t5)', textAlign: 'right', marginBottom: 12 }}>⌘↵ 로 제안 받기</div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '9px 0', background: 'var(--node-section)', border: '1px solid var(--sep2)', borderRadius: 8, fontSize: 12, fontWeight: 700, color: 'var(--t3)', cursor: 'pointer', fontFamily: 'inherit' }}>
            취소
          </button>
          <button
            onClick={suggest}
            disabled={isLoading || !narration.trim()}
            style={{
              flex: 2, padding: '9px 0',
              background: isLoading ? 'var(--node-section)' : 'linear-gradient(135deg, #1a3090 0%, #29D9D9 100%)',
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

// ── 대사 입력 필드 ────────────────────────────────────────────────────────
function DialogueInput({ label, value, onChange, placeholder }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.07em',
        textTransform: 'uppercase', color: 'var(--t4)', marginBottom: 4,
      }}>
        {label}
        <span style={{
          marginLeft: 5, fontSize: 8, fontWeight: 600, color: 'var(--t5)',
          background: 'var(--node-section)', border: '1px solid var(--sep)',
          borderRadius: 3, padding: '1px 4px',
        }}>선택</span>
      </div>
      <input
        className="nopan nodrag"
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          background: 'var(--node-input)',
          border: '1px solid var(--sep)',
          borderRadius: 6,
          padding: '6px 9px',
          fontSize: 11,
          fontFamily: 'inherit',
          outline: 'none',
          color: 'var(--t2)',
          lineHeight: 1.5,
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

// ── 메인 노드 ─────────────────────────────────────────────────────────────
export default function VideoDirectionNode({ id, data, selected }) {
  const { updateNodeData, getNodes, getEdges } = useReactFlow()
  const projectId = useContext(ProjectContext)

  const [value, setValue] = useState(data.value ?? data.defaultValue ?? '')
  const [syncedDataValue, setSyncedDataValue] = useState(data.value)
  const [koreanDialogue, setKoreanDialogue] = useState(data.koreanDialogue ?? '')
  const [syncedKorean, setSyncedKorean] = useState(data.koreanDialogue)
  const [englishDialogue, setEnglishDialogue] = useState(data.englishDialogue ?? '')
  const [syncedEnglish, setSyncedEnglish] = useState(data.englishDialogue)

  const [showModal, setShowModal] = useState(false)
  const [dirImgSrc, setDirImgSrc] = useState(null)
  const [dirImgMeta, setDirImgMeta] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)

  const styleAnchor = (() => {
    const anchorNode = getNodes().find(n => n.id === 'styleAnchor')
    return anchorNode?.data?.videoAnchor
  })()

  // 프로젝트 전환 시 node data 교체 → 로컬 state 동기화
  if (syncedDataValue !== data.value) {
    setSyncedDataValue(data.value)
    setValue(data.value ?? data.defaultValue ?? '')
  }
  if (syncedKorean !== data.koreanDialogue) {
    setSyncedKorean(data.koreanDialogue)
    setKoreanDialogue(data.koreanDialogue ?? '')
  }
  if (syncedEnglish !== data.englishDialogue) {
    setSyncedEnglish(data.englishDialogue)
    setEnglishDialogue(data.englishDialogue ?? '')
  }

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, MAX_HEIGHT) + 'px'
  }, [value])

  useEffect(() => {
    if (!data.hasDirectionImage) { setDirImgSrc(null); setDirImgMeta(null); return }
    loadImage(`direction-${projectId}-${id}`).then(url => {
      if (!url) return
      setDirImgSrc(url)
      const mediaType = (url.match(/^data:([^;]+)/) ?? [])[1] ?? 'image/jpeg'
      setDirImgMeta({ data: url.split(',')[1], mediaType })
    })
  }, [id, data.hasDirectionImage, projectId])

  const handleDirectionImageFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const url = e.target.result
      setDirImgSrc(url)
      setDirImgMeta({ data: url.split(',')[1], mediaType: file.type })
      saveImage(`direction-${projectId}-${id}`, url)
      updateNodeData(id, { hasDirectionImage: true })
    }
    reader.readAsDataURL(file)
  }

  const handleDirectionImageRemove = () => {
    setDirImgSrc(null)
    setDirImgMeta(null)
    deleteImage(`direction-${projectId}-${id}`)
    updateNodeData(id, { hasDirectionImage: false })
  }

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

  const handleKeyDown = (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.key !== 'Enter') return
    e.preventDefault()
    const edges = getEdges()
    const nodes = getNodes()
    const edge = edges.find(eg => eg.source === id && eg.targetHandle === 'command')
    if (!edge) return
    const target = nodes.find(n => n.id === edge.target && n.type === 'claudeNode')
    if (target) generateHandlerRef.current?.(target.id)
  }

  return (
    <div style={{ ...nodeBase, ...selectedGlow }}>

      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.cyan }}>
          🎬 {data.label}
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="nopan nodrag"
          style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
            color: C.cyan, background: 'rgba(41,217,217,0.08)',
            border: '1px solid rgba(41,217,217,0.3)',
            borderRadius: 5, padding: '2px 7px',
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(41,217,217,0.16)'; e.currentTarget.style.borderColor = 'rgba(41,217,217,0.6)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(41,217,217,0.08)'; e.currentTarget.style.borderColor = 'rgba(41,217,217,0.3)' }}
        >
          ✦ 제안받기
        </button>
      </div>

      {/* 연출 내용 */}
      <textarea
        ref={textareaRef}
        className="nopan nodrag"
        style={{
          width: '100%', minHeight: 80, maxHeight: MAX_HEIGHT,
          background: 'var(--node-input)',
          border: '1px solid var(--sep)',
          borderRadius: 7, padding: '8px 10px',
          fontSize: 12, fontFamily: 'inherit', resize: 'none',
          outline: 'none', color: 'var(--t2)', lineHeight: 1.6,
          boxSizing: 'border-box', overflowY: 'auto',
        }}
        placeholder={data.placeholder ?? '원하는 영상 연출을 설명해주세요.\n예) 카메라가 천천히 줌인하며...'}
        value={value}
        onChange={e => { setValue(e.target.value); updateNodeData(id, { value: e.target.value }) }}
        onKeyDown={handleKeyDown}
      />

      {/* 구분선 + 대사 섹션 */}
      <div style={{ margin: '10px 0 6px', borderTop: '1px solid var(--sep)', paddingTop: 8 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--t4)' }}>
          대사
        </div>
      </div>

      <DialogueInput
        label="Korean Dialogue"
        value={koreanDialogue}
        placeholder="안녕하세요, 오늘 날씨가 참 좋네요."
        onChange={v => { setKoreanDialogue(v); updateNodeData(id, { koreanDialogue: v }) }}
      />
      <DialogueInput
        label="English Dialogue"
        value={englishDialogue}
        placeholder="Hello, the weather is so nice today."
        onChange={v => { setEnglishDialogue(v); updateNodeData(id, { englishDialogue: v }) }}
      />

      {/* 연출 참고 이미지 */}
      <div style={{ marginTop: 10 }}>
        {dirImgSrc ? (
          <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
            <img
              src={dirImgSrc} alt="레퍼런스"
              style={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 6, border: '1px solid rgba(41,217,217,0.3)', display: 'block' }}
            />
            <button
              className="nopan nodrag"
              onClick={handleDirectionImageRemove}
              title="이미지 제거"
              style={{
                position: 'absolute', top: 4, right: 4, width: 18, height: 18,
                background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '50%', cursor: 'pointer', color: '#fff', fontSize: 9,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
              }}
            >✕</button>
          </div>
        ) : (
          <div
            className="nopan nodrag"
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleDirectionImageFile(e.dataTransfer.files[0]) }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `1px dashed ${dragOver ? 'rgba(41,217,217,0.7)' : 'rgba(255,255,255,0.15)'}`,
              borderRadius: 6, padding: '7px 10px',
              textAlign: 'center', cursor: 'pointer',
              fontSize: 10, color: dragOver ? C.cyan : 'var(--t5)',
              background: dragOver ? 'rgba(41,217,217,0.06)' : 'transparent',
              transition: 'all 0.15s', userSelect: 'none',
            }}
          >
            🖼 연출 참고용 이미지 첨부
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" className="nopan nodrag" style={{ display: 'none' }} onChange={e => handleDirectionImageFile(e.target.files[0])} />
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{ background: 'rgba(41,217,217,0.5)', border: '1.5px solid #29D9D9', boxShadow: '0 0 6px rgba(41,217,217,0.5)' }}
      />

      {showModal && (
        <SuggestionModal
          onClose={() => setShowModal(false)}
          onApply={text => { setValue(text); updateNodeData(id, { value: text }) }}
          projectId={projectId}
          styleAnchor={styleAnchor}
          directionImage={dirImgMeta}
        />
      )}
    </div>
  )
}
