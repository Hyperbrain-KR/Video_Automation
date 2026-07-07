import { useState } from 'react'
import { Handle, Position, useReactFlow } from '@xyflow/react'
import { higgsfieldHandlerRef } from '../lib/higgsfieldHandlerRef'

const C = {
  blue: '#1F41B0',
  cyan: '#29D9D9',
  red: '#E34054',
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
  width: 260,
  fontFamily: 'inherit',
  boxShadow: [
    'inset 0 1px 0 rgba(255,255,255,0.08)',
    '0 8px 32px rgba(0,0,0,0.5)',
    '0 0 0 1px rgba(31,65,176,0.18)',
  ].join(', '),
}

const IMAGE_MODELS = [
  ['nano_banana_2', '나노바나나 2'],
  ['nano_banana_2_shots', '나노바나나 Pro (레퍼런스 필요)'],
  ['gpt_image_2', 'GPT 이미지 2'],
]

const QUALITY_OPTIONS = [
  ['720', '720p'],
  ['1k', '1K'],
  ['2k', '2K'],
  ['4k', '4K'],
]

const ASPECT_OPTIONS = [
  ['auto', 'Auto'],
  ['1:1', '1:1'],
  ['3:4', '3:4'],
  ['4:3', '4:3'],
  ['2:3', '2:3'],
  ['3:2', '3:2'],
  ['9:16', '9:16'],
  ['16:9', '16:9'],
  ['5:4', '5:4'],
  ['4:5', '4:5'],
  ['21:9', '21:9'],
]

const statusConfigs = {
  idle:       { dot: 'rgba(244,244,244,0.25)', text: '대기 중',  glow: 'none' },
  loading:    { dot: '#29D9D9', text: '생성 중…', glow: '0 0 8px rgba(41,217,217,0.8)' },
  generating: { dot: '#29D9D9', text: '생성 중…', glow: '0 0 8px rgba(41,217,217,0.8)' },
  done:       { dot: '#29D9D9', text: '완료',     glow: '0 0 8px rgba(41,217,217,0.8)' },
  error:      { dot: '#E34054', text: '오류',     glow: '0 0 8px rgba(227,64,84,0.8)' },
}

const selectStyle = {
  flex: 1,
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 5,
  color: 'rgba(244,244,244,0.8)',
  padding: '3px 6px',
  fontSize: 10,
  fontFamily: 'inherit',
  outline: 'none',
  cursor: 'pointer',
}

function SelectRow({ label, value, onChange, options }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 9, color: 'rgba(244,244,244,0.35)', width: 36, flexShrink: 0 }}>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} style={selectStyle}>
        {options.map(([v, l]) => (
          <option key={v} value={v} style={{ background: '#0d1020' }}>{l}</option>
        ))}
      </select>
    </div>
  )
}

const CANVAS_API = 'http://localhost:3002'

export default function HiggsfieldNode({ id, data, selected }) {
  const { updateNodeData } = useReactFlow()
  const isVideo = data.type === 'video'
  const hasRef = data.hasRef ?? false
  const hasMultiInput = isVideo || hasRef
  const promptTop = hasMultiInput ? '30%' : '50%'

  const [model, setModel] = useState(data.model ?? 'nano_banana_2')
  const [quality, setQuality] = useState(data.quality ?? '1k')
  const [aspectRatio, setAspectRatio] = useState(data.aspectRatio ?? 'auto')

  const status = data.status ?? 'idle'
  const cfg = statusConfigs[status] ?? statusConfigs.idle
  const isLoading = status === 'loading' || status === 'generating'
  const isDone = status === 'done'

  let description = '프롬프트 → 이미지 생성'
  if (hasRef) description = '프롬프트 + 캐릭터 참조 → 이미지 생성'
  if (isVideo) description = '프롬프트 + 첫 프레임 → 영상 생성'

  const selectedGlow = selected ? {
    borderColor: '#29D9D9',
    boxShadow: [
      '0 0 0 1.5px #29D9D9',
      '0 0 16px rgba(41,217,217,0.75)',
      '0 0 40px rgba(41,217,217,0.4)',
      '0 8px 32px rgba(0,0,0,0.55)',
    ].join(', '),
  } : {}

  const handleModel = (v) => { setModel(v); updateNodeData(id, { model: v }) }
  const handleQuality = (v) => { setQuality(v); updateNodeData(id, { quality: v }) }
  const handleAspect = (v) => { setAspectRatio(v); updateNodeData(id, { aspectRatio: v }) }

  const btnStyle = {
    width: '100%', padding: '8px 0', marginTop: 10,
    background: isLoading ? 'rgba(31,65,176,0.1)' : isDone ? 'rgba(41,217,217,0.08)' : 'linear-gradient(135deg, #1a3090 0%, #1F41B0 100%)',
    color: isLoading ? 'rgba(244,244,244,0.25)' : isDone ? 'rgba(41,217,217,0.85)' : C.light,
    border: isLoading ? '1px solid rgba(31,65,176,0.2)' : isDone ? '1px solid rgba(41,217,217,0.3)' : '1px solid rgba(31,65,176,0.6)',
    borderRadius: 7, cursor: isLoading ? 'not-allowed' : 'pointer',
    fontWeight: 700, fontSize: 12, letterSpacing: '0.05em', fontFamily: 'inherit',
    boxShadow: isLoading || isDone ? 'none' : '0 2px 12px rgba(31,65,176,0.45)',
    transition: 'all 0.15s',
  }

  return (
    <div style={{ ...nodeBase, ...selectedGlow }}>

      <Handle id="prompt" type="target" position={Position.Left}
        style={{ top: promptTop, background: 'rgba(31,65,176,0.6)', border: '1.5px solid #1F41B0' }} />
      {hasRef && (
        <Handle id="ref" type="target" position={Position.Left}
          style={{ top: '68%', background: 'rgba(31,65,176,0.6)', border: '1.5px solid #1F41B0' }} />
      )}
      {isVideo && (
        <Handle id="image" type="target" position={Position.Left}
          style={{ top: '68%', background: 'rgba(31,65,176,0.6)', border: '1.5px solid #1F41B0' }} />
      )}

      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
          color: C.light, background: C.blue,
          borderRadius: 4, padding: '2px 6px', textTransform: 'uppercase',
        }}>Higgsfield</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.light }}>{data.label}</span>
      </div>

      <div style={{ fontSize: 10, color: C.muted, marginBottom: 10 }}>{description}</div>

      {/* 이미지 노드: 모델/퀄리티/비율 선택 */}
      {!isVideo && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10,
          padding: '8px 9px', background: 'rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.06)', borderRadius: 7 }}>
          <SelectRow label="모델" value={model} onChange={handleModel} options={IMAGE_MODELS} />
          <SelectRow label="해상도" value={quality} onChange={handleQuality} options={QUALITY_OPTIONS} />
          <SelectRow label="비율" value={aspectRatio} onChange={handleAspect} options={ASPECT_OPTIONS} />
        </div>
      )}

      {hasMultiInput && !isVideo && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          <span style={inputBadge}>📝 프롬프트</span>
          {hasRef && <span style={inputBadge}>🎭 캐릭터</span>}
        </div>
      )}
      {isVideo && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          <span style={inputBadge}>📝 프롬프트</span>
          <span style={inputBadge}>🖼 첫 프레임</span>
        </div>
      )}

      {/* 상태 뱃지 */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
        color: status === 'error' ? C.red : status === 'idle' ? C.muted : C.cyan,
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${status === 'error' ? 'rgba(227,64,84,0.2)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 4, padding: '2px 8px',
      }}>
        <span style={{
          width: 5, height: 5, borderRadius: '50%',
          background: cfg.dot, boxShadow: cfg.glow, display: 'inline-block',
          animation: isLoading ? 'pulse 1.2s ease-in-out infinite' : 'none',
        }} />
        {cfg.text}
      </div>

      {/* 오류 */}
      {status === 'error' && data.error && (
        <div style={{
          marginTop: 8, fontSize: 10, color: C.red,
          padding: '5px 8px', background: 'rgba(227,64,84,0.08)',
          border: '1px solid rgba(227,64,84,0.18)', borderRadius: 6, lineHeight: 1.5,
        }}>
          ⚠ {data.error}
        </div>
      )}

      {/* 결과 미리보기 + 다운로드 */}
      {isDone && data.resultUrl && (
        <div style={{ marginTop: 8 }}>
          {isVideo
            ? <video src={data.resultUrl} controls style={{ width: '100%', borderRadius: 7 }} />
            : <img src={data.resultUrl} alt="생성 결과" style={{ width: '100%', borderRadius: 7, display: 'block' }} />
          }
          <a
            href={`${CANVAS_API}/api/download?url=${encodeURIComponent(data.resultUrl)}`}
            download
            style={{ display: 'block', textDecoration: 'none', marginTop: 6 }}
          >
            <div style={{
              width: '100%', padding: '6px 0', textAlign: 'center',
              background: 'rgba(41,217,217,0.08)',
              border: '1px solid rgba(41,217,217,0.25)', borderRadius: 6,
              fontSize: 11, fontWeight: 700, color: 'rgba(41,217,217,0.85)',
              cursor: 'pointer',
            }}>
              ↓ 다운로드
            </div>
          </a>
        </div>
      )}

      {/* 생성 버튼 */}
      <button
        style={btnStyle}
        disabled={isLoading}
        onClick={() => higgsfieldHandlerRef.current?.(id)}
        onMouseEnter={e => { if (!isLoading && !isDone) e.currentTarget.style.filter = 'brightness(1.15)' }}
        onMouseLeave={e => { e.currentTarget.style.filter = 'none' }}
      >
        {isLoading ? '⚙ 생성 중...' : isDone ? '↺ 재생성' : '▶ 생성'}
      </button>

      <Handle type="source" position={Position.Right}
        style={{ background: 'rgba(41,217,217,0.5)', border: '1.5px solid #29D9D9',
          boxShadow: '0 0 6px rgba(41,217,217,0.5)' }} />

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  )
}

const inputBadge = {
  fontSize: 9, color: 'rgba(244,244,244,0.5)',
  background: 'rgba(31,65,176,0.12)',
  border: '1px solid rgba(31,65,176,0.2)',
  borderRadius: 3, padding: '1px 5px',
}
