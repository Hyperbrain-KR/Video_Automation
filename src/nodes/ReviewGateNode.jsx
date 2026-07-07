import { useState, useEffect } from 'react'
import { Handle, Position, useReactFlow } from '@xyflow/react'

const C = {
  blue: '#1F41B0',
  cyan: '#29D9D9',
  red: '#E34054',
  light: '#F4F4F4',
  textMuted: 'rgba(244,244,244,0.45)',
}

const glass = {
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(20px) saturate(160%)',
  WebkitBackdropFilter: 'blur(20px) saturate(160%)',
  border: '1px solid rgba(41,217,217,0.18)',
  boxShadow: [
    'inset 0 1px 0 rgba(255,255,255,0.10)',
    'inset 0 -1px 0 rgba(0,0,0,0.2)',
    '0 8px 32px rgba(0,0,0,0.45)',
    '0 0 0 1px rgba(41,217,217,0.06)',
  ].join(', '),
}

const glassCyan = {
  ...glass,
  border: '1px solid rgba(41,217,217,0.45)',
  boxShadow: [
    'inset 0 1px 0 rgba(255,255,255,0.10)',
    'inset 0 -1px 0 rgba(0,0,0,0.2)',
    '0 8px 32px rgba(0,0,0,0.5)',
    '0 0 0 1px rgba(41,217,217,0.2)',
    '0 0 20px rgba(41,217,217,0.10)',
  ].join(', '),
}

const styles = {
  node: {
    ...glassCyan,
    borderRadius: 12,
    padding: 14,
    minWidth: 280,
    fontSize: 13,
    fontFamily: 'inherit',
  },
  label: {
    fontWeight: 600,
    marginBottom: 10,
    color: C.light,
    fontSize: 13,
    letterSpacing: '0.01em',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: C.cyan,
    background: 'rgba(41,217,217,0.08)',
    border: '1px solid rgba(41,217,217,0.25)',
    borderRadius: 4,
    padding: '2px 7px',
    marginBottom: 10,
  },
  prompt: {
    background: 'rgba(0,0,0,0.25)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 8,
    padding: '9px 11px',
    marginBottom: 10,
    whiteSpace: 'pre-wrap',
    lineHeight: 1.6,
    color: 'rgba(244,244,244,0.65)',
    fontSize: 12,
  },
  textarea: {
    width: '100%',
    minHeight: 90,
    background: 'rgba(0,0,0,0.3)',
    border: '1.5px solid rgba(41,217,217,0.5)',
    borderRadius: 8,
    padding: '9px 11px',
    marginBottom: 10,
    fontSize: 12,
    fontFamily: 'inherit',
    resize: 'vertical',
    outline: 'none',
    color: C.light,
    lineHeight: 1.6,
  },
  row: {
    display: 'flex',
    gap: 7,
  },
  btnApprove: {
    flex: 1,
    padding: '7px 0',
    background: 'linear-gradient(135deg, #1F41B0 0%, #29D9D9 100%)',
    color: C.light,
    border: 'none',
    borderRadius: 7,
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: '0.02em',
    boxShadow: '0 2px 12px rgba(41,217,217,0.35)',
  },
  btnSecondary: {
    flex: 1,
    padding: '7px 0',
    background: 'rgba(255,255,255,0.05)',
    color: C.textMuted,
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 7,
    cursor: 'pointer',
    fontSize: 12,
  },
  approvedNode: {
    ...glass,
    border: '1px solid rgba(41,217,217,0.5)',
    background: 'rgba(41,217,217,0.06)',
    boxShadow: [
      'inset 0 1px 0 rgba(255,255,255,0.08)',
      '0 8px 32px rgba(0,0,0,0.45)',
      '0 0 0 1px rgba(41,217,217,0.2)',
      '0 0 24px rgba(41,217,217,0.12)',
    ].join(', '),
    borderRadius: 12,
    padding: 14,
    minWidth: 280,
    fontSize: 13,
    fontFamily: 'inherit',
  },
  approvedRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  approvedText: {
    color: C.light,
    fontWeight: 600,
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  approvedDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: C.cyan,
    display: 'inline-block',
    boxShadow: `0 0 10px ${C.cyan}, 0 0 20px rgba(41,217,217,0.4)`,
  },
  resetBtn: {
    fontSize: 11,
    color: C.textMuted,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
  },
}

export default function ReviewGateNode({ id, data, selected }) {
  const { updateNodeData } = useReactFlow()
  const [status, setStatus] = useState('pending')
  const [prompt, setPrompt] = useState(data.prompt ?? '(프롬프트 없음)')

  // Claude 생성 완료 시 외부에서 data.prompt가 업데이트되면 동기화
  useEffect(() => {
    if (data.prompt && data.prompt !== '(프롬프트 없음)') {
      setPrompt(data.prompt)
      setStatus('pending')
    }
  }, [data.prompt])

  const selectedGlow = selected ? {
    borderColor: '#29D9D9',
    boxShadow: [
      'inset 0 1px 0 rgba(255,255,255,0.16)',
      'inset 0 -1px 0 rgba(0,0,0,0.2)',
      '0 0 0 1.5px #29D9D9',
      '0 0 16px rgba(41,217,217,0.75)',
      '0 0 40px rgba(41,217,217,0.4)',
      '0 0 80px rgba(41,217,217,0.18)',
      '0 8px 32px rgba(0,0,0,0.55)',
    ].join(', '),
  } : {}

  const handles = (
    <>
      <Handle id="left" type="target" position={Position.Left} />
      <Handle id="top" type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </>
  )

  if (status === 'approved') {
    return (
      <div style={{ ...styles.approvedNode, ...selectedGlow }}>
        {handles}
        <div style={styles.approvedRow}>
          <div style={styles.approvedText}>
            <span style={styles.approvedDot} />
            {data.label} — 승인됨
          </div>
          <button style={styles.resetBtn} onClick={() => setStatus('pending')}>
            되돌리기
          </button>
        </div>
      </div>
    )
  }

  if (status === 'editing') {
    return (
      <div style={{ ...styles.node, ...selectedGlow }}>
        {handles}
        <div style={styles.statusBadge}>✏ 수정 중</div>
        <div style={styles.label}>{data.label}</div>
        <textarea
          style={styles.textarea}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <div style={styles.row}>
          <button style={styles.btnSecondary} onClick={() => setStatus('pending')}>
            취소
          </button>
          <button style={styles.btnApprove} onClick={() => {
            updateNodeData(id, { prompt })
            setStatus('approved')
          }}>
            수정 후 승인
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ ...styles.node, ...selectedGlow }}>
      {handles}
      <div style={styles.statusBadge}>⏳ 검토 대기</div>
      <div style={styles.label}>{data.label}</div>
      <div style={styles.prompt}>{prompt}</div>
      <div style={styles.row}>
        <button style={styles.btnSecondary} onClick={() => setStatus('editing')}>
          수정
        </button>
        <button style={styles.btnApprove} onClick={() => setStatus('approved')}>
          승인
        </button>
      </div>
    </div>
  )
}
