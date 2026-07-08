import { useState, useEffect } from 'react'
import { Handle, Position, useReactFlow } from '@xyflow/react'

const SCRIPT_API = 'http://localhost:3001/api/canvas/scripts'

const C = {
  cyan: '#29D9D9',
  red: '#E34054',
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
  width: 268,
  fontFamily: 'inherit',
  boxShadow: [
    'inset 0 1px 0 rgba(255,255,255,0.08)',
    '0 8px 32px rgba(0,0,0,0.5)',
    '0 0 0 1px rgba(41,217,217,0.06)',
  ].join(', '),
}

export default function ScriptImportNode({ selected }) {
  const { updateNodeData } = useReactFlow()
  const [scripts, setScripts] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // 버튼용 fetch (effect 외부에서 호출)
  const fetchScripts = () => {
    setLoading(true)
    setError(null)
    fetch(SCRIPT_API)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => { setScripts(data); setLoading(false) })
      .catch(() => { setError('SCRIPT-AUTOMATION 서버에 연결할 수 없습니다 (포트 3001)'); setLoading(false) })
  }

  // 마운트 시 최초 1회 로드
  useEffect(() => {
    let active = true
    fetch(SCRIPT_API)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { if (active) setScripts(data) })
      .catch(() => { if (active) setError('SCRIPT-AUTOMATION 서버에 연결할 수 없습니다 (포트 3001)') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  // 스크립트 선택 → styleAnchor 노드에 앵커 자동 주입
  const handleSelect = (rawId) => {
    const id = Number(rawId) || null
    setSelectedId(id)
    if (!id) return
    const entry = scripts.find(s => s.id === id)
    if (!entry?.styleAnchors) return
    updateNodeData('styleAnchor', {
      imageAnchor: entry.styleAnchors.imageAnchor ?? '',
      videoAnchor: entry.styleAnchors.videoAnchor ?? '',
    })
  }

  const selectedGlow = selected ? {
    borderColor: '#29D9D9',
    boxShadow: [
      '0 0 0 1.5px #29D9D9',
      '0 0 16px rgba(41,217,217,0.65)',
      '0 8px 32px rgba(0,0,0,0.55)',
    ].join(', '),
  } : {}

  const entry = scripts.find(s => s.id === selectedId)
  const hasScript = !!entry?.converted
  const hasImageAnchor = !!entry?.styleAnchors?.imageAnchor
  const hasVideoAnchor = !!entry?.styleAnchors?.videoAnchor

  return (
    <div style={{ ...nodeBase, ...selectedGlow }}>

      {/* 소스 핸들 3개 */}
      <Handle id="script" type="source" position={Position.Right}
        style={{ top: '28%', background: 'rgba(244,244,244,0.35)', border: '1.5px solid rgba(244,244,244,0.55)' }} />
      <Handle id="imageAnchor" type="source" position={Position.Right}
        style={{ top: '60%', background: 'rgba(41,217,217,0.5)', border: '1.5px solid #29D9D9',
          boxShadow: '0 0 6px rgba(41,217,217,0.4)' }} />
      <Handle id="videoAnchor" type="source" position={Position.Right}
        style={{ top: '84%', background: 'rgba(41,217,217,0.5)', border: '1.5px solid #29D9D9',
          boxShadow: '0 0 6px rgba(41,217,217,0.4)' }} />

      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase',
            color: C.cyan, background: 'rgba(41,217,217,0.1)',
            border: '1px solid rgba(41,217,217,0.22)', borderRadius: 4, padding: '2px 6px',
          }}>Import</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.light }}>스크립트 불러오기</span>
        </div>
        <button
          onClick={fetchScripts}
          title="새로고침"
          style={{
            fontSize: 13, lineHeight: 1, color: loading ? C.cyan : C.muted,
            background: 'var(--node-section)',
            border: '1px solid var(--sep2)',
            borderRadius: 4, padding: '2px 8px', cursor: 'pointer',
            transition: 'color 0.2s',
          }}
        >
          {loading ? '…' : '↻'}
        </button>
      </div>

      {/* 에러 */}
      {error && (
        <div style={{
          fontSize: 10, color: C.red, marginBottom: 8,
          padding: '6px 8px', lineHeight: 1.5,
          background: 'rgba(227,64,84,0.08)',
          border: '1px solid rgba(227,64,84,0.18)', borderRadius: 6,
        }}>
          ⚠ {error}
        </div>
      )}

      {/* 스크립트 선택 드롭다운 */}
      {!error && (
        <select
          value={selectedId ?? ''}
          onChange={e => handleSelect(e.target.value)}
          style={{
            width: '100%',
            background: 'var(--node-input)',
            border: `1px solid ${selectedId ? 'rgba(41,217,217,0.35)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 7,
            color: selectedId ? C.light : C.muted,
            padding: '6px 9px', fontSize: 11,
            fontFamily: 'inherit', outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="" style={{ background: '#0d1020' }}>
            {scripts.length === 0 ? '생성된 스크립트 없음' : '스크립트 선택…'}
          </option>
          {scripts.map(s => (
            <option key={s.id} value={s.id} style={{ background: '#0d1020' }}>
              {s.title} · {new Date(s.createdAt).toLocaleDateString('ko-KR')}
            </option>
          ))}
        </select>
      )}

      {/* 선택된 스크립트 정보 */}
      {entry && (
        <div style={{ marginTop: 10 }}>
          <div style={{
            fontSize: 9, color: 'var(--t4)', marginBottom: 8,
            letterSpacing: '0.04em',
          }}>
            {new Date(entry.createdAt).toLocaleString('ko-KR')} · {entry.mode === 'create' ? '신규 생성' : '변환'}
          </div>

          {/* 출력 상태 표시 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <OutputRow label="📄 스크립트" active={hasScript} />
            <OutputRow label="🖼 이미지 앵커" active={hasImageAnchor} />
            <OutputRow label="🎬 비디오 앵커" active={hasVideoAnchor} />
          </div>
        </div>
      )}
    </div>
  )
}

function OutputRow({ label, active }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
        background: active ? '#29D9D9' : 'rgba(244,244,244,0.12)',
        boxShadow: active ? '0 0 7px rgba(41,217,217,0.7)' : 'none',
        transition: 'all 0.2s',
      }} />
      <span style={{
        fontSize: 10,
        color: active ? 'var(--t2)' : 'var(--t5)',
        transition: 'color 0.2s',
      }}>
        {label}
      </span>
      <span style={{
        marginLeft: 'auto', fontSize: 9,
        color: active ? 'rgba(41,217,217,0.7)' : 'var(--t5)',
      }}>
        {active ? '연결 가능' : '없음'}
      </span>
    </div>
  )
}
