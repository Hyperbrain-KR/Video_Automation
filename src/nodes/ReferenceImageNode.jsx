import { useRef, useState, useEffect, useContext } from 'react'
import { Handle, Position, useReactFlow } from '@xyflow/react'
import { CharactersContext } from '../lib/CharactersContext'
import { saveImage, loadImageByNodeId, deleteImage } from '../lib/imageDB'

const C = {
  cyan: '#29D9D9',
  light: 'var(--t1)',
  muted: 'var(--t3)',
  blue: '#1F41B0',
}

const nodeBase = {
  background: 'var(--node-bg)',
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
  const { saveCharacter } = useContext(CharactersContext)
  const fileInputRef = useRef(null)
  const [tab, setTab] = useState('file') // 'file' | 'url'
  const [urlInput, setUrlInput] = useState(data.imageUrl ?? '')
  const [dragging, setDragging] = useState(false)
  const [savingName, setSavingName] = useState('')
  const [showSaveInput, setShowSaveInput] = useState(false)
  const [localPreview, setLocalPreview] = useState(null)
  // "캐릭터로 저장" 후에는 캐릭터 파일(char-...)을 공유하고, 그 전에는 노드 id가 곧 Storage 키
  const imageKey = data.imageKey ?? id

  // 마운트 시 IndexedDB에서 이미지 복원
  useEffect(() => {
    if (!data.hasLocalImage) return
    loadImageByNodeId(imageKey).then(url => setLocalPreview(url ?? null)).catch(() => setLocalPreview(null))
  }, [imageKey, data.hasLocalImage])

  const preview = (data.hasLocalImage ? localPreview : null) || data.imageUrl || null

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
    reader.onload = async (e) => {
      const dataUrl = e.target.result
      await saveImage(id, dataUrl).catch(err =>
        console.error('[ReferenceImageNode] IndexedDB 저장 실패:', err)
      )
      setLocalPreview(dataUrl)
      updateNodeData(id, {
        hasLocalImage: true,
        imageKey: null,
        filename: file.name,
        contentType: file.type,
        imageUrl: null,
        imageDataUrl: null,
      })
    }
    reader.readAsDataURL(file)
  }

  const handleUrlConfirm = () => {
    if (!urlInput.trim()) return
    updateNodeData(id, { imageUrl: urlInput.trim(), hasLocalImage: false, imageKey: null, imageDataUrl: null, filename: null })
  }

  const handleSaveCharacter = async () => {
    const name = savingName.trim()
    if (!name) return
    setSavingName(''); setShowSaveInput(false)
    const imgSrc = data.imageUrl || (data.hasLocalImage ? await loadImageByNodeId(imageKey) : null)
    const charKey = await saveCharacter(name, imgSrc)
    // 사본 업로드가 확인된 뒤에만 캐릭터 파일을 공유 — 노드의 원본 파일은 서버 정리 작업이 나중에 삭제
    if (charKey && data.hasLocalImage && !data.imageKey) updateNodeData(id, { imageKey: charKey })
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
      className="nopan nodrag"
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
        background: 'var(--node-prompt)', borderRadius: 5, padding: 3 }}>
        {tabBtn('file', '파일 업로드')}
        {tabBtn('url', 'URL 입력')}
      </div>

      {tab === 'file' ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className="nopan nodrag"
          style={{
            border: `1.5px dashed ${dragging ? C.cyan : 'rgba(255,255,255,0.12)'}`,
            borderRadius: 8, padding: '12px 8px', textAlign: 'center',
            cursor: 'pointer', transition: 'all 0.15s',
            background: dragging ? 'rgba(41,217,217,0.05)' : 'var(--node-prompt)',
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
            className="nopan nodrag"
            style={{
              background: 'var(--node-input)',
              border: '1px solid var(--sep2)',
              borderRadius: 5, padding: '5px 8px',
              fontSize: 10, color: C.light, fontFamily: 'inherit', outline: 'none',
            }}
          />
          <button
            onClick={handleUrlConfirm}
            className="nopan nodrag"
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
            onClick={() => {
              if (!data.imageKey) deleteImage(id).catch(() => {})
              setLocalPreview(null)
              updateNodeData(id, { imageDataUrl: null, imageUrl: null, hasLocalImage: false, imageKey: null, filename: null })
            }}
            style={{
              marginTop: 5, width: '100%', padding: '4px 0',
              background: 'rgba(227,64,84,0.08)',
              border: '1px solid rgba(227,64,84,0.2)',
              borderRadius: 5, fontSize: 10, color: '#E34054',
              fontFamily: 'inherit', cursor: 'pointer',
            }}
          >✕ 제거</button>

          {/* 캐릭터로 저장 */}
          {showSaveInput ? (
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              <input
                autoFocus
                value={savingName}
                onChange={e => setSavingName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSaveCharacter()
                  if (e.key === 'Escape') setShowSaveInput(false)
                }}
                placeholder="캐릭터 이름..."
                className="nopan nodrag"
                style={{
                  flex: 1, background: 'var(--node-input)', border: '1px solid var(--sep2)',
                  borderRadius: 5, padding: '4px 7px', fontSize: 10,
                  color: 'var(--t1)', fontFamily: 'inherit', outline: 'none',
                }}
              />
              <button className="nopan nodrag"
                onClick={handleSaveCharacter}
                style={{ padding: '4px 8px', background: 'rgba(41,217,217,0.1)',
                  border: '1px solid rgba(41,217,217,0.3)', borderRadius: 5,
                  fontSize: 10, color: '#29D9D9', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}
              >저장</button>
              <button className="nopan nodrag"
                onClick={() => setShowSaveInput(false)}
                style={{ padding: '4px 7px', background: 'var(--node-bg)',
                  border: '1px solid var(--sep)', borderRadius: 5,
                  fontSize: 10, color: 'var(--t4)', cursor: 'pointer', fontFamily: 'inherit' }}
              >✕</button>
            </div>
          ) : (
            <button className="nopan nodrag"
              onClick={() => setShowSaveInput(true)}
              style={{
                width: '100%', padding: '5px 0', marginTop: 6,
                background: 'var(--node-bg)', border: '1px solid var(--sep2)',
                borderRadius: 5, fontSize: 10, fontWeight: 700,
                color: 'var(--t3)', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >👤 캐릭터로 저장</button>
          )}
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
