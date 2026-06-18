import { useState } from 'react'
import { Handle, Position } from '@xyflow/react'

const C = {
  cyan: '#29D9D9',
  light: '#F4F4F4',
  muted: 'rgba(244,244,244,0.45)',
}

const nodeBase = {
  background: 'rgba(255,255,255,0.04)',
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

const textareaStyle = {
  width: '100%',
  minHeight: 72,
  background: 'rgba(0,0,0,0.25)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 7,
  padding: '7px 9px',
  fontSize: 11,
  fontFamily: 'inherit',
  resize: 'vertical',
  outline: 'none',
  color: 'rgba(244,244,244,0.8)',
  lineHeight: 1.55,
  boxSizing: 'border-box',
}

export default function StyleAnchorInputNode({ data, selected }) {
  const [imageAnchor, setImageAnchor] = useState(data.imageAnchor ?? '')
  const [videoAnchor, setVideoAnchor] = useState(data.videoAnchor ?? '')

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
          style={textareaStyle}
          placeholder="이미지 스타일 앵커를 붙여넣으세요..."
          value={imageAnchor}
          onChange={e => setImageAnchor(e.target.value)}
        />
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 12 }} />

      {/* 비디오 앵커 */}
      <div>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 5, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>🎬 비디오 앵커</span>
          <span style={{ fontSize: 9, color: 'rgba(41,217,217,0.6)', fontWeight: 700,
            letterSpacing: '0.06em' }}>VIDEO</span>
        </div>
        <textarea
          style={textareaStyle}
          placeholder="비디오 스타일 앵커를 붙여넣으세요..."
          value={videoAnchor}
          onChange={e => setVideoAnchor(e.target.value)}
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
