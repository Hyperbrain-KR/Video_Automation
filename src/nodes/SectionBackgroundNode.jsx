export default function SectionBackgroundNode({ data }) {
  return (
    <div style={{
      width: data.width ?? 940,
      height: data.height ?? 470,
      background: data.bg,
      border: `1.5px solid ${data.border}`,
      borderRadius: 18,
      pointerEvents: 'none',
      position: 'relative',
      overflow: 'visible',
    }}>
      {/* 박스 위에 독립적으로 띄우는 레이블 */}
      <div style={{
        position: 'absolute',
        top: -30,
        left: 16,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{
          fontSize: 9, fontWeight: 900, letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: data.accent,
          opacity: 0.55,
        }}>
          {data.step}
        </span>
        <span style={{
          fontSize: 13, fontWeight: 700,
          color: data.accent,
          letterSpacing: '0.02em',
        }}>
          {data.label}
        </span>
      </div>
    </div>
  )
}
