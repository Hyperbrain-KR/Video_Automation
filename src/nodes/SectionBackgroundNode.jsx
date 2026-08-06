export default function SectionBackgroundNode({ data }) {
  const isDragging = data.isDragging ?? false
  const w = data.width ?? 940
  const totalH = data.height ?? 500
  const sectionH = totalH - 30

  return (
    <div style={{ width: w, height: totalH, position: 'relative', '--pulse-color': data.border }}>
      {/* ── 드래그 핸들 (레이블 박스) ── */}
      <div
        className={`section-drag-handle${isDragging ? ' section-dragging' : ''}`}
        style={{
          height: 30,
          display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 16,
          borderRadius: '6px 6px 0 0',
          userSelect: 'none',
        }}
      >
        <span style={{
          fontSize: 9, fontWeight: 900, letterSpacing: '0.18em',
          textTransform: 'uppercase', color: data.accent, opacity: 0.55,
        }}>
          {data.step}
        </span>
        <span style={{
          fontSize: 13, fontWeight: 700,
          color: data.accent, letterSpacing: '0.02em',
        }}>
          {data.label}
        </span>
      </div>

      {/* ── 섹션 배경 박스 ── */}
      <div style={{
        width: w, height: sectionH,
        background: data.bg,
        border: `1.5px solid ${data.border}`,
        borderRadius: 18,
        pointerEvents: 'none',
      }} />
    </div>
  )
}
