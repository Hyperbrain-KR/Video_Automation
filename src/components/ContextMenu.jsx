const paneItems = [
  { key: 'scriptImport',     icon: '📥', label: '스크립트 불러오기',   desc: 'SCRIPT-AUTOMATION 연동' },
  { key: 'imageNode',        icon: '📸', label: '이미지 노드',        desc: '참조 이미지 추가' },
  { key: 'textInput',        icon: '✏️', label: '텍스트 입력',        desc: '사용자 입력 노드' },
  { key: 'referenceImage',  icon: '🖼', label: '레퍼런스 이미지',     desc: '이미지 업로드 / URL 레퍼런스' },
  { key: 'claudeNode',       icon: '🤖', label: 'Claude',             desc: '프롬프트 생성' },
  { key: 'higgsfieldImage',  icon: '🖼', label: 'Higgsfield 이미지',  desc: '이미지 생성' },
  { key: 'higgsfieldVideo',  icon: '🎬', label: 'Higgsfield 비디오',  desc: '비디오 생성' },
  { key: 'reviewGate',       icon: '✅', label: '리뷰 게이트',         desc: '검토 / 승인' },
  { key: 'styleAnchorInput', icon: '🎨', label: '스타일 앵커',         desc: '스타일 앵커 입력' },
]

const nodeItems = [
  { key: 'duplicate', icon: '⧉', label: '복제',   desc: '이 노드 복사', color: 'rgba(244,244,244,0.85)' },
  { key: 'delete',    icon: '🗑', label: '삭제',   desc: '노드 및 연결된 엣지 제거', color: '#E34054' },
]

const edgeItems = [
  { key: 'delete', icon: '✕', label: '연결 끊기', desc: '이 엣지 삭제', color: '#E34054' },
]

export default function ContextMenu({ x, y, mode = 'pane', onSelect, onClose }) {
  const items    = mode === 'node' ? nodeItems : mode === 'edge' ? edgeItems : paneItems
  const heading  = mode === 'node' ? '노드' : mode === 'edge' ? '엣지' : '노드 추가'

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onMouseDown={onClose} />

      <div style={{
        position: 'fixed', left: x, top: y, zIndex: 999,
        background: 'rgba(8,11,26,0.97)',
        border: `1px solid ${mode === 'pane' ? 'rgba(41,217,217,0.28)' : 'rgba(255,255,255,0.12)'}`,
        borderRadius: 12, padding: 6,
        minWidth: mode === 'pane' ? 210 : 170,
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 16px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(41,217,217,0.04)',
      }}>
        <div style={{
          fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
          color: mode === 'pane' ? 'rgba(41,217,217,0.45)' : 'rgba(244,244,244,0.25)',
          padding: '5px 10px 8px',
          borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: 4,
        }}>
          {heading}
        </div>

        {items.map(item => (
          <MenuItem key={item.key} item={item} onSelect={() => { onSelect(item.key); onClose() }} />
        ))}
      </div>
    </>
  )
}

function MenuItem({ item, onSelect }) {
  return (
    <button
      onClick={onSelect}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', textAlign: 'left',
        padding: '7px 10px', borderRadius: 7,
        background: 'none', border: 'none', cursor: 'pointer',
        color: item.color ?? '#F4F4F4',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = item.color === '#E34054'
          ? 'rgba(227,64,84,0.12)' : 'rgba(41,217,217,0.09)'
      }}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >
      <span style={{ fontSize: 14, flexShrink: 0, width: 20, textAlign: 'center' }}>
        {item.icon}
      </span>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>{item.label}</div>
        <div style={{ fontSize: 10, color: 'rgba(244,244,244,0.35)', marginTop: 1 }}>{item.desc}</div>
      </div>
    </button>
  )
}
