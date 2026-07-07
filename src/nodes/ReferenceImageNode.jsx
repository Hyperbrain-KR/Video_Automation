import { useRef, useState } from 'react'
import { Handle, Position, useReactFlow } from '@xyflow/react'

const C = {
  cyan: '#29D9D9',
  light: '#F4F4F4',
  muted: 'rgba(244,244,244,0.45)',
  blue: '#1F41B0',
}

const nodeBase = {
  background: 'rgba(15,22,40,0.7)',
  backdropFilter: 'blur(20px) saturate(160%)',
  WebkitBackdropFilter: 'blur(20px) saturate(160%)',
  border: '1px solid rgba(41,217,217,0.3)',
  borderRadius: 12,
  padding: 14,
  width: 240,
  fontFamily: 'inherit',
  boxShadow: [
    'inset 0 1px 0 rgba(255,255,255,0.08)',
    '0 8px 32px rgba(0,0,0,0.5)',
  ].join(', '),
}

export default function ReferenceImageNode({ id, data, selected }) {
  const { updateNodeData } = useReactFlow()
  const fileInputRef = useRef(null)
  const [tab, setTab] = useState('file') // 'file' | 'url'
  const [urlInput, setUrlInput] = useState(data.imageUrl ?? '')
  const [dragging, setDragging] = useState(false)

  const preview = data.imageDataUrl || data.imageUrl || null

  const selectedGlow = selected ? {
    border: '1px solid #29D9D9',
    boxShadow: [
      '0 0 0 1.5px #29D9D9',
      '0 0 16px rgba(41,217,217,0.6)',
      '0 8px 32px rgba(0,0,0,0.55)',
    ].join(', '),
  } : {}

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => {
      updateNodeData(id, {
        imageDataUrl: e.target.result,
        filename: file.name,
        contentType: file.type,
        imageUrl: null,
      })
    }
    reader.readAsDataURL(file)
  }

  const handleUrlConfirm = () => {
    if (!urlInput.trim()) return
    updateNodeData(id, { imageUrl: urlInput.trim(), imageDataUrl: null, filename: null })
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const tabBtn = (t, label) => (
    <button
      onClick={() => setTab(t)}
      style={{
        flex: 1, padding: '4px 0', fontSize: 10, fontWeight: 700,
        fontFamily: 'inherit', cursor: 'pointer', border: 'none',
        borderRadius: 4,
        background: tab === t ? 'rgba(41,217,217,0.15)' : 'transparent',
        color: tab === t ? C.cyan : C.muted,
        transition: 'all 0.15s',
      }}
    >{label}</button>
  )

  return (
    <div style={{ ...nodeBase, ...selectedGlow }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
        color: C.cyan, textTransform: 'uppercase', marginBottom: 10 }}>
        🖼 레퍼런스 이미지
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8,
        background: 'rgba(0,0,0,0.2)', borderRadius: 5, padding: 3 }}>
        {tabBtn('file', '파일 업로드')}
        {tabBtn('url', 'URL 입력')}
      </div>

      {tab === 'file' ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          style={{
            border: `1.5px dashed ${dragging ? C.cyan : 'rgba(255,255,255,0.12)'}`,
            borderRadius: 8, padding: '12px 8px', textAlign: 'center',
            cursor: 'pointer', transition: 'all 0.15s',
            background: dragging ? 'rgba(41,217,217,0.05)' : 'rgba(0,0,0,0.15)',
          }}
        >
          <div style={{ fontSize: 18, marginBottom: 4 }}>📁</div>
          <div style={{ fontSize: 10, color: C.muted }}>클릭하거나 드래그해서 업로드</div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files?.[0])}
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            type="text"
            placeholder="https://..."
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleUrlConfirm()}
            style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 5, padding: '5px 8px',
              fontSize: 10, color: C.light, fontFamily: 'inherit', outline: 'none',
            }}
          />
          <button
            onClick={handleUrlConfirm}
            style={{
              background: 'rgba(41,217,217,0.1)',
              border: '1px solid rgba(41,217,217,0.25)',
              borderRadius: 5, padding: '4px 0',
              fontSize: 10, color: C.cyan, fontFamily: 'inherit',
              cursor: 'pointer', fontWeight: 700,
            }}
          >확인</button>
        </div>
      )}

      {/* 미리보기 */}
      {preview && (
        <div style={{ marginTop: 8 }}>
          <img
            src={preview}
            alt="reference"
            style={{ width: '100%', borderRadius: 7, display: 'block',
              border: '1px solid rgba(41,217,217,0.2)' }}
          />
          <button
            onClick={() => updateNodeData(id, { imageDataUrl: null, imageUrl: null, filename: null })}
            style={{
              marginTop: 5, width: '100%', padding: '4px 0',
              background: 'rgba(227,64,84,0.08)',
              border: '1px solid rgba(227,64,84,0.2)',
              borderRadius: 5, fontSize: 10, color: '#E34054',
              fontFamily: 'inherit', cursor: 'pointer',
            }}
          >✕ 제거</button>
        </div>
      )}

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
