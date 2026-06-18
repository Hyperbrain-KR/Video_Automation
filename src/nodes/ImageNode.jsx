import { Handle, Position } from '@xyflow/react'

export default function ImageNode({ data, selected }) {
  const selectedGlow = selected ? {
    borderColor: '#29D9D9',
    boxShadow: '0 0 0 1.5px #29D9D9, 0 0 16px rgba(41,217,217,0.6), 0 4px 20px rgba(0,0,0,0.5)',
  } : {}

  return (
    <div style={{
      borderRadius: 10,
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.15)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      width: 160,
      background: 'rgba(10,12,24,0.8)',
      backdropFilter: 'blur(12px)',
      ...selectedGlow,
    }}>
      <Handle
        id="target"
        type="target"
        position={Position.Left}
        style={{ background: 'rgba(31,65,176,0.6)', border: '1.5px solid #1F41B0' }}
      />

      {data.src ? (
        <img
          src={data.src}
          alt={data.label ?? 'reference'}
          style={{ width: '100%', display: 'block', maxHeight: 200, objectFit: 'cover' }}
          draggable={false}
        />
      ) : (
        <div style={{
          width: '100%', height: 100,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 6,
          color: 'rgba(244,244,244,0.25)', fontSize: 11,
        }}>
          <span style={{ fontSize: 22, opacity: 0.4 }}>🖼</span>
          이미지 없음
        </div>
      )}

      {data.label && (
        <div style={{
          background: 'rgba(5,8,18,0.85)',
          padding: '5px 9px',
          fontSize: 10, color: 'rgba(244,244,244,0.55)',
          letterSpacing: '0.02em',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          📎 {data.label}
        </div>
      )}

      <Handle
        id="source"
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
