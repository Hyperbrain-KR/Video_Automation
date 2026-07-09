import { useState, useRef, useEffect } from 'react'
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

const MAX_HEIGHT = 220

export default function TextInputNode({ id, data, selected }) {
  const { updateNodeData } = useReactFlow()
  const [value, setValue] = useState(data.value ?? data.defaultValue ?? '')
  const textareaRef = useRef(null)

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

  return (
    <div style={{ ...nodeBase, ...selectedGlow }}>

      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: C.cyan, marginBottom: 8,
      }}>
        ✏️ {data.label}
      </div>

      <textarea
        ref={textareaRef}
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
    </div>
  )
}
