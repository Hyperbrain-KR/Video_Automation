import { Handle, Position } from '@xyflow/react'
import { generateHandlerRef } from '../lib/generateHandlerRef'

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

const statusConfigs = {
  idle: {
    dot: 'rgba(244,244,244,0.25)',
    text: '대기 중',
    dotGlow: 'none',
  },
  loading: {
    dot: '#29D9D9',
    text: '생성 중...',
    dotGlow: '0 0 8px rgba(41,217,217,0.8)',
  },
  done: {
    dot: '#29D9D9',
    text: '완료',
    dotGlow: '0 0 8px rgba(41,217,217,0.8)',
  },
  error: {
    dot: '#E34054',
    text: '오류',
    dotGlow: '0 0 8px rgba(227,64,84,0.8)',
  },
}

export default function ClaudeNode({ id, data, selected }) {
  const status = data.status ?? 'idle'
  const cfg = statusConfigs[status] ?? statusConfigs.idle

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

  const isLoading = status === 'loading'
  const isDone = status === 'done'

  const btnStyle = {
    width: '100%',
    padding: '8px 0',
    marginTop: 10,
    background: isLoading
      ? 'var(--node-bg)'
      : isDone
        ? 'var(--btn-done-bg)'
        : 'linear-gradient(135deg, #1F41B0 0%, rgba(41,65,200,0.85) 100%)',
    color: isLoading
      ? 'var(--t5)'
      : isDone
        ? 'var(--btn-done-text)'
        : '#F4F4F4',
    border: isLoading
      ? '1px solid rgba(31,65,176,0.2)'
      : isDone
        ? '1px solid var(--btn-done-border)'
        : '1px solid rgba(31,65,176,0.55)',
    borderRadius: 7,
    cursor: isLoading ? 'not-allowed' : 'pointer',
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: '0.05em',
    fontFamily: 'inherit',
    boxShadow: isLoading || isDone ? 'none' : '0 2px 12px rgba(31,65,176,0.4)',
    transition: 'all 0.15s',
  }

  return (
    <div style={{ ...nodeBase, ...selectedGlow }}>

      {/* 타겟 핸들: 앵커(상단), 명령(하단) */}
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

      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
          color: C.blue, background: 'rgba(31,65,176,0.15)',
          border: '1px solid rgba(31,65,176,0.3)',
          borderRadius: 4, padding: '2px 6px', textTransform: 'uppercase',
        }}>Claude</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.light }}>{data.label}</span>
      </div>

      {/* 설명 */}
      <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5, marginBottom: 10 }}>
        {data.description ?? '앵커 + 입력 → 프롬프트 생성'}
      </div>

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
          background: cfg.dot,
          boxShadow: cfg.dotGlow,
          display: 'inline-block',
          animation: isLoading ? 'pulse 1.2s ease-in-out infinite' : 'none',
        }} />
        {cfg.text}
      </div>

      {/* 오류 메시지 */}
      {status === 'error' && data.error && (
        <div style={{
          marginTop: 8, fontSize: 10, color: C.red,
          padding: '5px 8px', background: 'rgba(227,64,84,0.08)',
          border: '1px solid rgba(227,64,84,0.18)', borderRadius: 6, lineHeight: 1.5,
        }}>
          ⚠ {data.error}
        </div>
      )}

      {/* 결과 미리보기 */}
      {isDone && data.result && (
        <div style={{
          marginTop: 8, padding: '7px 9px',
          background: 'var(--node-prompt)',
          border: '1px solid rgba(41,217,217,0.15)',
          borderRadius: 7, fontSize: 10,
          color: 'var(--t3)',
          lineHeight: 1.55, maxHeight: 58, overflow: 'hidden',
        }}>
          {data.result.length > 120 ? data.result.slice(0, 120) + '…' : data.result}
        </div>
      )}

      {/* 생성 버튼 */}
      <button
        style={btnStyle}
        disabled={isLoading}
        onClick={() => generateHandlerRef.current?.(id)}
        onMouseEnter={e => {
          if (!isLoading && !isDone) e.currentTarget.style.filter = 'brightness(1.15)'
        }}
        onMouseLeave={e => { e.currentTarget.style.filter = 'none' }}
      >
        {isLoading ? '⚙ 생성 중...' : isDone ? '↺ 재생성' : '✦ 생성'}
      </button>

      {/* 소스 핸들 */}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: 'rgba(41,217,217,0.5)',
          border: '1.5px solid #29D9D9',
          boxShadow: '0 0 6px rgba(41,217,217,0.5)',
        }}
      />

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
