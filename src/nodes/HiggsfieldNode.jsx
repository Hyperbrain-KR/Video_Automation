import { useState, useEffect, useRef, useContext } from 'react'
import { Handle, Position, useReactFlow, useStore } from '@xyflow/react'
import { higgsfieldHandlerRef } from '../lib/higgsfieldHandlerRef'
import { CharactersContext } from '../lib/CharactersContext'

const C = {
  blue: '#1F41B0',
  cyan: '#29D9D9',
  red: '#E34054',
  light: 'var(--t1)',
  muted: 'var(--t3)',
}

const nodeBase = {
  background: 'var(--node-bg)',
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
  ['nano_banana_pro', '나노바나나 Pro'],
  ['gpt_image_2', 'GPT 이미지 2'],
]

const QUALITY_OPTIONS = [
  ['720', '720p'],
  ['1k', '1K'],
  ['2k', '2K'],
  ['4k', '4K'],
]

const GPT_QUALITY_OPTIONS = [
  ['low', 'Low'],
  ['medium', 'Medium'],
  ['high', 'High'],
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
  idle:       { dot: 'var(--t5)', text: '대기 중',  glow: 'none' },
  loading:    { dot: '#29D9D9', text: '생성 중…', glow: '0 0 8px rgba(41,217,217,0.8)' },
  generating: { dot: '#29D9D9', text: '생성 중…', glow: '0 0 8px rgba(41,217,217,0.8)' },
  done:       { dot: '#29D9D9', text: '완료',     glow: '0 0 8px rgba(41,217,217,0.8)' },
  error:      { dot: '#E34054', text: '오류',     glow: '0 0 8px rgba(227,64,84,0.8)' },
  auth_error: { dot: '#F59E0B', text: '재인증 필요', glow: '0 0 8px rgba(245,158,11,0.8)' },
}

const selectStyle = {
  flex: 1,
  background: 'var(--node-input)',
  border: '1px solid var(--sep2)',
  borderRadius: 5,
  color: 'var(--t2)',
  padding: '3px 6px',
  fontSize: 10,
  fontFamily: 'inherit',
  outline: 'none',
  cursor: 'pointer',
}

function SelectRow({ label, value, onChange, options }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 9, color: 'var(--t4)', width: 36, flexShrink: 0 }}>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} style={selectStyle}>
        {options.map(([v, l]) => (
          <option key={v} value={v} style={{ background: '#0d1020' }}>{l}</option>
        ))}
      </select>
    </div>
  )
}

const CANVAS_API = 'http://localhost:3002'

const VIDEO_MODE_OPTIONS = [['std','Standard'], ['pro','Pro'], ['4k','4K']]
const VIDEO_ASPECT_OPTIONS = [['16:9','16:9'], ['9:16','9:16'], ['1:1','1:1']]

export default function HiggsfieldNode({ id, data, selected }) {
  const { updateNodeData, getEdges, setNodes } = useReactFlow()
  const { characters, saveCharacter } = useContext(CharactersContext)
  const [savingName, setSavingName] = useState('')
  const [showSaveInput, setShowSaveInput] = useState(false)

  // 연결된 핸들 실시간 감지 (edges 변경 시 자동 갱신)
  const connectedHandleStr = useStore(s =>
    s.edges.filter(e => e.target === id && e.targetHandle).map(e => e.targetHandle).join(',')
  )
  const connected = new Set(connectedHandleStr.split(',').filter(Boolean))

  // 뱃지 클릭 → 해당 핸들에 연결된 모든 소스 노드 flash
  const flashSource = (handle) => {
    const srcIds = new Set(
      getEdges().filter(e => e.target === id && e.targetHandle === handle).map(e => e.source)
    )
    if (srcIds.size === 0) return
    setNodes(nds => nds.map(n =>
      srcIds.has(n.id) ? { ...n, className: ((n.className ?? '').replace(' node-flash', '')) + ' node-flash' } : n
    ))
    setTimeout(() => {
      setNodes(nds => nds.map(n =>
        srcIds.has(n.id) ? { ...n, className: (n.className ?? '').replace(' node-flash', '') } : n
      ))
    }, 900)
  }
  const isVideo = data.type === 'video'
  const hasRef = data.hasRef ?? false
  const hasMultiInput = isVideo || hasRef
  const promptTop = hasMultiInput ? '25%' : '50%'

  const [model, setModel] = useState(data.model ?? 'nano_banana_pro')
  const defaultQuality = (data.model ?? 'nano_banana_pro') === 'gpt_image_2' ? 'high' : '1k'
  const [quality, setQuality] = useState(data.quality ?? defaultQuality)
  const [aspectRatio, setAspectRatio] = useState(data.aspectRatio ?? 'auto')

  // 비디오 전용 상태
  const [duration, setDuration] = useState(Number(data.duration ?? 5))
  const [videoMode, setVideoMode] = useState(data.videoMode ?? 'pro')
  const [sound, setSound] = useState(data.sound ?? 'off')
  const [videoAspect, setVideoAspect] = useState(data.videoAspect ?? '1:1')

  const status = data.status ?? 'idle'
  const cfg = statusConfigs[status] ?? statusConfigs.idle
  const isLoading = status === 'loading' || status === 'generating'
  const isDone = status === 'done'
  const isAuthError = status === 'auth_error'

  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(null)
  useEffect(() => {
    if (status !== 'generating') { startRef.current = null; return }
    startRef.current = Date.now()
    const t = setInterval(() => {
      if (startRef.current) setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    return () => clearInterval(t)
  }, [status])

  let description = '프롬프트 → 이미지 생성'
  if (hasRef) description = '프롬프트 + 캐릭터 참조 → 이미지 생성'
  if (isVideo) description = '프롬프트 + 첫 프레임 → 영상 생성'

  const selectedGlow = selected ? {
    border: '1px solid #29D9D9',
    boxShadow: [
      '0 0 0 1.5px #29D9D9',
      '0 0 16px rgba(41,217,217,0.75)',
      '0 0 40px rgba(41,217,217,0.4)',
      '0 8px 32px rgba(0,0,0,0.55)',
    ].join(', '),
  } : {}


  const handleModel = (v) => {
    const newQuality = v === 'gpt_image_2' ? 'high' : '1k'
    setModel(v); setQuality(newQuality)
    updateNodeData(id, { model: v, quality: newQuality })
  }
  const handleQuality = (v) => { setQuality(v); updateNodeData(id, { quality: v }) }
  const handleAspect = (v) => { setAspectRatio(v); updateNodeData(id, { aspectRatio: v }) }
  const handleDuration = (v) => { const n = Number(v); setDuration(n); updateNodeData(id, { duration: String(n) }) }
  const handleVideoMode = (v) => { setVideoMode(v); updateNodeData(id, { videoMode: v }) }
  const handleSound = () => { const next = sound === 'on' ? 'off' : 'on'; setSound(next); updateNodeData(id, { sound: next }) }
  const handleVideoAspect = (v) => { setVideoAspect(v); updateNodeData(id, { videoAspect: v }) }

  const btnStyle = {
    width: '100%', padding: '8px 0', marginTop: 10,
    background: isLoading ? 'var(--node-bg)' : isDone ? 'var(--btn-done-bg)' : 'linear-gradient(135deg, #1a3090 0%, #1F41B0 100%)',
    color: isLoading ? 'var(--t5)' : isDone ? 'var(--btn-done-text)' : '#F4F4F4',
    border: isLoading ? '1px solid rgba(31,65,176,0.2)' : isDone ? '1px solid var(--btn-done-border)' : '1px solid rgba(31,65,176,0.6)',
    borderRadius: 7, cursor: isLoading ? 'not-allowed' : 'pointer',
    fontWeight: 700, fontSize: 12, letterSpacing: '0.05em', fontFamily: 'inherit',
    boxShadow: isLoading || isDone ? 'none' : '0 2px 12px rgba(31,65,176,0.45)',
    transition: 'all 0.15s',
  }

  return (
    <div style={{ ...nodeBase, ...selectedGlow }}>

      {/* 프롬프트 핸들 */}
      <Handle id="prompt" type="target" position={Position.Left}
        style={{ top: isVideo ? '18%' : promptTop, background: 'rgba(31,65,176,0.6)', border: '1.5px solid #1F41B0' }} />
      {hasRef && (
        <Handle id="ref" type="target" position={Position.Left}
          style={{ top: '68%', background: 'rgba(31,65,176,0.6)', border: '1.5px solid #1F41B0' }} />
      )}
      {isVideo && (
        <Handle id="image" type="target" position={Position.Left}
          style={{ top: '62%', background: 'rgba(41,217,217,0.6)', border: '1.5px solid #29D9D9' }} />
      )}
      {isVideo && (
        <Handle id="end_image" type="target" position={Position.Left}
          style={{ top: '80%', background: 'rgba(176,31,101,0.6)', border: '1.5px solid #b01f65' }} />
      )}

      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
          color: '#F4F4F4', background: C.blue,
          borderRadius: 4, padding: '2px 6px', textTransform: 'uppercase',
        }}>Higgsfield</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.light }}>{data.label}</span>
      </div>

      <div style={{ fontSize: 10, color: C.muted, marginBottom: 10 }}>{description}</div>

      {/* 이미지 노드: 모델/퀄리티/비율 선택 */}
      {!isVideo && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10,
          padding: '8px 9px', background: 'var(--node-prompt)',
          border: '1px solid var(--sep)', borderRadius: 7 }}>
          <SelectRow label="모델" value={model} onChange={handleModel} options={IMAGE_MODELS} />
          <SelectRow label="퀄리티" value={quality} onChange={handleQuality} options={model === 'gpt_image_2' ? GPT_QUALITY_OPTIONS : QUALITY_OPTIONS} />
          <SelectRow label="비율" value={aspectRatio} onChange={handleAspect} options={ASPECT_OPTIONS} />
        </div>
      )}

      {/* 캐릭터 참조 선택 (이미지 씬 노드만) */}
      {!isVideo && hasRef && (
        <div style={{ marginBottom: 10, padding: '7px 9px',
          background: 'var(--node-prompt)', border: '1px solid var(--sep)', borderRadius: 7 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t4)',
            letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>
            캐릭터 참조
          </div>
          {characters.length === 0 ? (
            <div style={{ fontSize: 10, color: 'var(--t5)' }}>저장된 캐릭터 없음</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {characters.map(c => {
                const checked = (data.selectedCharacterIds ?? []).includes(c.id)
                return (
                  <label key={c.id} className="nopan nodrag" style={{
                    display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                    padding: '3px 6px', borderRadius: 4, transition: 'all 0.15s',
                    background: checked ? 'rgba(41,217,217,0.07)' : 'transparent',
                    border: `1px solid ${checked ? 'rgba(41,217,217,0.2)' : 'transparent'}`,
                  }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      className="nopan nodrag"
                      onChange={() => {
                        const cur = data.selectedCharacterIds ?? []
                        const next = checked ? cur.filter(x => x !== c.id) : [...cur, c.id]
                        updateNodeData(id, { selectedCharacterIds: next })
                      }}
                      style={{ accentColor: '#29D9D9', width: 11, height: 11, flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 10, color: checked ? 'var(--t1)' : 'var(--t3)', flex: 1,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.name}
                    </span>
                    {c.resultUrl && (
                      <img src={c.resultUrl} alt={c.name}
                        style={{ width: 20, height: 20, borderRadius: 3, objectFit: 'cover', flexShrink: 0 }} />
                    )}
                  </label>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 비디오 노드: Kling 3.0 컨트롤 */}
      {isVideo && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10,
          padding: '8px 9px', background: 'var(--node-prompt)',
          border: '1px solid var(--sep)', borderRadius: 7 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(41,217,217,0.6)',
            letterSpacing: '0.08em', marginBottom: 4 }}>KLING 3.0</div>

          {/* 길이 슬라이더 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 9, color: 'var(--t4)', width: 36, flexShrink: 0 }}>길이</span>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: C.cyan }}>{duration}s</span>
                <span style={{ fontSize: 9, color: 'var(--t5)' }}>3–15</span>
              </div>
              <input
                type="range"
                min={3} max={15} step={1}
                value={duration}
                onChange={e => handleDuration(e.target.value)}
                className="nopan nodrag"
                style={{
                  width: '100%', cursor: 'pointer', height: 4,
                  accentColor: '#29D9D9', appearance: 'none', WebkitAppearance: 'none',
                  background: `linear-gradient(to right, #29D9D9 0%, #29D9D9 ${((duration - 3) / 12) * 100}%, var(--sep2) ${((duration - 3) / 12) * 100}%, var(--sep2) 100%)`,
                  borderRadius: 2, outline: 'none', border: 'none',
                  '--pct': `${((duration - 3) / 12) * 100}%`,
                }}
              />
            </div>
          </div>

          <SelectRow label="모드" value={videoMode} onChange={handleVideoMode} options={VIDEO_MODE_OPTIONS} />
          <SelectRow label="비율" value={videoAspect} onChange={handleVideoAspect} options={VIDEO_ASPECT_OPTIONS} />

          {/* 오디오 토글 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 9, color: 'var(--t4)', width: 36, flexShrink: 0 }}>오디오</span>
            <button
              onClick={handleSound}
              className="nopan"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '3px 10px 3px 4px',
                background: sound === 'on'
                  ? 'linear-gradient(135deg, rgba(34,197,94,0.18), rgba(34,197,94,0.10))'
                  : 'linear-gradient(135deg, rgba(202,184,25,0.28), rgba(202,184,25,0.16))',
                border: sound === 'on'
                  ? '1px solid rgba(34,197,94,0.5)'
                  : '1px solid rgba(180,150,0,0.55)',
                borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.2s',
              }}
            >
              {/* 토글 원형 */}
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                background: sound === 'on'
                  ? 'radial-gradient(circle at 40% 40%, #4ade80, #16a34a)'
                  : 'radial-gradient(circle at 40% 40%, #fde047, #ca8a04)',
                boxShadow: sound === 'on'
                  ? '0 0 6px rgba(34,197,94,0.7)'
                  : '0 0 6px rgba(202,184,25,0.6)',
                border: '1.5px solid rgba(255,255,255,0.2)',
                flexShrink: 0,
                transition: 'all 0.2s',
              }} />
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: sound === 'on' ? 'rgba(74,222,128,0.9)' : 'rgba(180,140,0,1)',
              }}>
                {sound === 'on' ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>
        </div>
      )}

      {hasMultiInput && !isVideo && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          <InputBadge handle="prompt"  icon="📝" label="프롬프트" color="#6488ff" connected={connected} onFlash={flashSource} />
          {hasRef && <InputBadge handle="ref" icon="🎭" label="캐릭터" color="#29D9D9" connected={connected} onFlash={flashSource} />}
        </div>
      )}
      {isVideo && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          <InputBadge handle="prompt"    icon="📝" label="프롬프트" color="#6488ff"  connected={connected} onFlash={flashSource} />
          <InputBadge handle="image"     icon="🖼" label="첫 프레임" color="#29D9D9" connected={connected} onFlash={flashSource} />
          <InputBadge handle="end_image" icon="🏁" label="끝 프레임" color="#e040a0" connected={connected} onFlash={flashSource} />
        </div>
      )}

      {/* 상태 뱃지 */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
        color: status === 'error' ? C.red : status === 'idle' ? C.muted : C.cyan,
        background: 'var(--node-bg)',
        border: `1px solid ${status === 'error' ? 'rgba(227,64,84,0.2)' : 'var(--sep2)'}`,
        borderRadius: 4, padding: '2px 8px',
      }}>
        <span style={{
          width: 5, height: 5, borderRadius: '50%',
          background: cfg.dot, boxShadow: cfg.glow, display: 'inline-block',
          animation: isLoading ? 'pulse 1.2s ease-in-out infinite' : 'none',
        }} />
        {cfg.text}
        {status === 'generating' && elapsed > 0 && (
          <span style={{ fontWeight: 400, opacity: 0.7 }}>
            {` ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`}
          </span>
        )}
      </div>

      {/* 생성 중일 때 jobId + 취소 버튼 */}
      {status === 'generating' && (
        <div style={{ marginTop: 5, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          {data.jobId && (
            <div style={{
              flex: 1, fontSize: 9, color: 'var(--t5)',
              fontFamily: 'monospace', wordBreak: 'break-all', lineHeight: 1.4,
            }}>
              job: {data.jobId}
            </div>
          )}
          <button
            onClick={() => updateNodeData(id, { status: 'idle', error: undefined })}
            style={{
              flexShrink: 0, fontSize: 9, fontWeight: 700,
              color: 'rgba(227,64,84,0.7)', background: 'rgba(227,64,84,0.08)',
              border: '1px solid rgba(227,64,84,0.25)', borderRadius: 4,
              padding: '2px 7px', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            취소
          </button>
        </div>
      )}

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

      {/* 인증 만료 안내 */}
      {isAuthError && (
        <div style={{
          marginTop: 8, fontSize: 10, color: '#F59E0B', lineHeight: 1.5,
          padding: '5px 8px', background: 'rgba(245,158,11,0.07)',
          border: '1px solid rgba(245,158,11,0.25)', borderRadius: 6,
        }}>
          🔑 세션 만료 — 왼쪽 재연결 버튼을 눌러주세요
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
              background: 'var(--btn-done-bg)',
              border: '1px solid var(--btn-done-border)', borderRadius: 6,
              fontSize: 11, fontWeight: 700, color: 'var(--btn-done-text)',
              cursor: 'pointer',
            }}>
              ↓ 다운로드
            </div>
          </a>

          {/* 캐릭터로 저장 (이미지만) */}
          {!isVideo && (
            showSaveInput ? (
              <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                <input
                  autoFocus
                  value={savingName}
                  onChange={e => setSavingName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && savingName.trim()) {
                      saveCharacter(savingName.trim(), data.resultUrl)
                      setSavingName(''); setShowSaveInput(false)
                    }
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
                  onClick={() => {
                    if (savingName.trim()) {
                      saveCharacter(savingName.trim(), data.resultUrl)
                      setSavingName(''); setShowSaveInput(false)
                    }
                  }}
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
                  borderRadius: 6, fontSize: 11, fontWeight: 700,
                  color: 'var(--t3)', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >👤 캐릭터로 저장</button>
            )
          )}
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
        @keyframes badge-pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0px transparent; }
          50%       { opacity: 0.55; box-shadow: 0 0 6px var(--badge-color, #29D9D9); }
        }
        input[type=range]::-webkit-slider-runnable-track {
          height: 4px; border-radius: 2px;
          background: linear-gradient(to right, #29D9D9 0%, #29D9D9 var(--pct, 0%), rgba(255,255,255,0.1) var(--pct, 0%), rgba(255,255,255,0.1) 100%);
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none; width: 12px; height: 12px;
          border-radius: 50%; background: #29D9D9;
          margin-top: -4px; cursor: pointer;
          box-shadow: 0 0 4px rgba(41,217,217,0.6);
        }
      `}</style>
    </div>
  )
}

function InputBadge({ handle, icon, label, color, connected, onFlash }) {
  const isActive = connected.has(handle)
  return (
    <span
      onClick={() => isActive && onFlash(handle)}
      style={{
        fontSize: 9, fontWeight: 700,
        borderRadius: 3, padding: '2px 6px',
        transition: 'all 0.2s',
        cursor: isActive ? 'pointer' : 'default',
        userSelect: 'none',
        '--badge-color': color,
        ...(isActive ? {
          color,
          background: color + '18',
          border: `1px solid ${color}55`,
          animation: 'badge-pulse 1.6s ease-in-out infinite',
        } : {
          color: 'var(--t5)',
          background: 'var(--node-bg)',
          border: '1px solid var(--sep2)',
        }),
      }}
    >
      {icon} {label}
    </span>
  )
}
