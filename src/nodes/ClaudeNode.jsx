import { Handle, Position } from '@xyflow/react'

const C = {
  blue: '#1F41B0',
  cyan: '#29D9D9',
  light: '#F4F4F4',
  muted: 'rgba(244,244,244,0.45)',
}

const nodeBase = {
  background: 'rgba(31,65,176,0.07)',
  backdropFilter: 'blur(20px) saturate(160%)',
  WebkitBackdropFilter: 'blur(20px) saturate(160%)',
  border: '1px solid rgba(31,65,176,0.35)',
  borderRadius: 12,
  padding: 14,
  width: 240,
  fontFamily: 'inherit',
  boxShadow: [
    'inset 0 1px 0 rgba(255,255,255,0.08)',
    '0 8px 32px rgba(0,0,0,0.45)',
    '0 0 0 1px rgba(31,65,176,0.12)',
  ].join(', '),
}

export default function ClaudeNode({ data, selected }) {
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

      {/* 두 개 타겟 핸들 — 앵커(상단), 명령(하단) */}
      <Handle
        id="anchor"
        type="target"
        position={Position.Left}
        style={{ top: '32%', background: 'rgba(31,65,176,0.6)', border: '1.5px solid #1F41B0' }}
      />
      <Handle
        id="command"
        type="target"
        position={Position.Left}
        style={{ top: '68%', background: 'rgba(31,65,176,0.6)', border: '1.5px solid #1F41B0' }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
          color: C.blue, background: 'rgba(31,65,176,0.15)',
          border: '1px solid rgba(31,65,176,0.3)',
          borderRadius: 4, padding: '2px 6px', textTransform: 'uppercase',
        }}>Claude</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.light }}>{data.label}</span>
      </div>

      <div style={{
        fontSize: 11, color: C.muted, lineHeight: 1.5, marginBottom: 10,
      }}>
        {data.description ?? '앵커 + 입력 → 프롬프트 생성'}
      </div>

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
        style={{ background: 'rgba(41,217,217,0.5)', border: '1.5px solid #29D9D9',
          boxShadow: '0 0 6px rgba(41,217,217,0.5)' }}
      />
    </div>
  )
}
