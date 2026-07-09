import { useState, useEffect, useRef } from 'react'
import { Handle, Position, useReactFlow } from '@xyflow/react'

const C = {
  cyan: '#29D9D9',
  light: 'var(--t1)',
  muted: 'var(--t3)',
}

const nodeBase = {
  background: 'var(--node-bg)',
  backdropFilter: 'blur(20px) saturate(160%)',
  WebkitBackdropFilter: 'blur(20px) saturate(160%)',
  border: '1px solid rgba(41,217,217,0.3)',
  borderRadius: 12,
  padding: 14,
  width: 280,
  fontFamily: 'inherit',
  boxShadow: [
    'inset 0 1px 0 rgba(255,255,255,0.10)',
    '0 8px 32px rgba(0,0,0,0.45)',
    '0 0 0 1px rgba(41,217,217,0.08)',
  ].join(', '),
}

const MAX_TA = 200

const textareaStyle = {
  width: '100%',
  minHeight: 72,
  maxHeight: MAX_TA,
  background: 'var(--node-input)',
  border: '1px solid var(--sep)',
  borderRadius: 7,
  padding: '7px 9px',
  fontSize: 11,
  fontFamily: 'inherit',
  resize: 'none',
  outline: 'none',
  color: 'var(--t2)',
  lineHeight: 1.55,
  boxSizing: 'border-box',
  overflowY: 'auto',
}

function useAutoResize(ref, value) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, MAX_TA) + 'px'
  }, [value, ref])
}

export default function StyleAnchorInputNode({ id, data, selected }) {
  const { updateNodeData } = useReactFlow()
  const [imageAnchor, setImageAnchor] = useState(data.imageAnchor ?? '')
  const [videoAnchor, setVideoAnchor] = useState(data.videoAnchor ?? '')
  const imgRef = useRef(null)
  const vidRef = useRef(null)
  useAutoResize(imgRef, imageAnchor)
  useAutoResize(vidRef, videoAnchor)

  // ScriptImportNode에서 updateNodeData로 값이 주입되면 동기화
  useEffect(() => { if (data.imageAnchor !== undefined) setImageAnchor(data.imageAnchor) }, [data.imageAnchor])
  useEffect(() => { if (data.videoAnchor !== undefined) setVideoAnchor(data.videoAnchor) }, [data.videoAnchor])

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

  return (
    <div style={{ ...nodeBase, ...selectedGlow }}>

      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: C.cyan, marginBottom: 12,
      }}>
        🎨 스타일 앵커
      </div>

      {/* 이미지 앵커 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 5, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>🖼 이미지 앵커</span>
          <span style={{ fontSize: 9, color: 'rgba(41,217,217,0.6)', fontWeight: 700,
            letterSpacing: '0.06em' }}>IMAGE</span>
        </div>
        <textarea
          ref={imgRef}
          style={textareaStyle}
          placeholder="이미지 스타일 앵커를 붙여넣으세요..."
          value={imageAnchor}
          onChange={e => { setImageAnchor(e.target.value); updateNodeData(id, { imageAnchor: e.target.value }) }}
        />
      </div>

      <div style={{ height: 1, background: 'var(--sep)', marginBottom: 12 }} />

      {/* 비디오 앵커 */}
      <div>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 5, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>🎬 비디오 앵커</span>
          <span style={{ fontSize: 9, color: 'rgba(41,217,217,0.6)', fontWeight: 700,
            letterSpacing: '0.06em' }}>VIDEO</span>
        </div>
        <textarea
          ref={vidRef}
          style={textareaStyle}
          placeholder="비디오 스타일 앵커를 붙여넣으세요..."
          value={videoAnchor}
          onChange={e => { setVideoAnchor(e.target.value); updateNodeData(id, { videoAnchor: e.target.value }) }}
        />
      </div>

      {/* 이미지 앵커 소스 핸들 — 상단 35% */}
      <Handle
        id="image"
        type="source"
        position={Position.Right}
        style={{ top: '33%', background: 'rgba(41,217,217,0.5)', border: '1.5px solid #29D9D9',
          boxShadow: '0 0 6px rgba(41,217,217,0.5)' }}
      />
      {/* 비디오 앵커 소스 핸들 — 하단 75% */}
      <Handle
        id="video"
        type="source"
        position={Position.Right}
        style={{ top: '76%', background: 'rgba(41,217,217,0.5)', border: '1.5px solid #29D9D9',
          boxShadow: '0 0 6px rgba(41,217,217,0.5)' }}
      />
    </div>
  )
}
