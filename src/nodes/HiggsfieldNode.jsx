import { Handle, Position } from '@xyflow/react'

const C = {
  blue: '#1F41B0',
  cyan: '#29D9D9',
  light: '#F4F4F4',
  muted: 'rgba(244,244,244,0.45)',
}

const nodeBase = {
  background: 'rgba(15,22,40,0.7)',
  backdropFilter: 'blur(20px) saturate(160%)',
  WebkitBackdropFilter: 'blur(20px) saturate(160%)',
  border: '1px solid rgba(31,65,176,0.45)',
  borderRadius: 12,
  padding: 14,
  width: 240,
  fontFamily: 'inherit',
  boxShadow: [
    'inset 0 1px 0 rgba(255,255,255,0.08)',
    '0 8px 32px rgba(0,0,0,0.5)',
    '0 0 0 1px rgba(31,65,176,0.18)',
    '0 0 20px rgba(31,65,176,0.08)',
  ].join(', '),
}

const handleStyle = {
  background: 'rgba(31,65,176,0.6)',
  border: '1.5px solid #1F41B0',
}

export default function HiggsfieldNode({ data, selected }) {
  const isVideo = data.type === 'video'
  const hasRef = data.hasRef ?? false
  const hasMultiInput = isVideo || hasRef
  const promptTop = hasMultiInput ? '35%' : '50%'

  let description = '프롬프트 → 이미지 생성'
  if (hasRef) description = '프롬프트 + 캐릭터 참조 → 이미지 생성'
  if (isVideo) description = '프롬프트 + 첫 프레임 → 영상 생성'

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

      <Handle id="prompt" type="target" position={Position.Left}
        style={{ top: promptTop, ...handleStyle }} />

      {hasRef && (
        <Handle id="ref" type="target" position={Position.Left}
          style={{ top: '65%', ...handleStyle }} />
      )}

      {isVideo && (
        <Handle id="image" type="target" position={Position.Left}
          style={{ top: '65%', ...handleStyle }} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
          color: '#F4F4F4', background: C.blue,
          borderRadius: 4, padding: '2px 6px', textTransform: 'uppercase',
        }}>Higgsfield</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.light }}>{data.label}</span>
      </div>

      <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>
        {description}
      </div>

      {hasMultiInput && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
          <span style={inputBadge}>📝 프롬프트</span>
          {hasRef && <span style={inputBadge}>🎭 캐릭터</span>}
          {isVideo && <span style={inputBadge}>🖼 첫 프레임</span>}
        </div>
      )}

      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
        color: C.muted,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 4, padding: '2px 8px',
      }}>
        <span style={{
          width: 5, height: 5, borderRadius: '50%',
          background: 'rgba(244,244,244,0.25)', display: 'inline-block',
        }} />
        대기 중
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: 'rgba(41,217,217,0.5)', border: '1.5px solid #29D9D9',
          boxShadow: '0 0 6px rgba(41,217,217,0.5)',
        }}
      />
    </div>
  )
}

const inputBadge = {
  fontSize: 9, color: 'rgba(244,244,244,0.5)',
  background: 'rgba(31,65,176,0.12)',
  border: '1px solid rgba(31,65,176,0.2)',
  borderRadius: 3, padding: '1px 5px',
}
