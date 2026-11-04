import { addCharSectionRef, deleteCharSectionRef } from '../lib/charSectionHandlerRef'

export default function SectionBackgroundNode({ id, data }) {
  const isDragging = data.isDragging ?? false
  const w = data.width ?? 940
  const totalH = data.height ?? 500
  const sectionH = totalH - 30

  const isCharSection = data.step === 'Step 01' || data.step?.startsWith('Step 01 ·')
  const isDeletable = isCharSection && id !== 'bg-s1'
  const uid = id.startsWith('bg-s1-') ? id.slice('bg-s1-'.length) : null

  return (
    <div className={isDragging ? 'section-dragging' : ''} style={{ width: w, height: totalH, position: 'relative', '--pulse-color': data.border }}>
      {/* ── 드래그 핸들 (레이블 박스) ── */}
      <div
        className="section-drag-handle"
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

        {isCharSection && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, paddingRight: 10 }}>
            {isDeletable && (
              <button
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); deleteCharSectionRef.current?.(uid) }}
                title="캐릭터 섹션 삭제"
                style={{
                  width: 18, height: 18, borderRadius: 4, border: '1px solid rgba(227,64,84,0.4)',
                  background: 'rgba(227,64,84,0.12)', color: '#E34054',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                }}
              >✕</button>
            )}
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); addCharSectionRef.current?.() }}
              title="캐릭터 섹션 추가"
              style={{
                width: 18, height: 18, borderRadius: 4, border: '1px solid rgba(100,140,255,0.5)',
                background: 'rgba(100,140,255,0.15)', color: 'rgba(100,140,255,0.9)',
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
              }}
            >+</button>
          </div>
        )}
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
