import { useMemo, useRef, useState, useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'

const STATUS_DOT = {
  done:       { color: '#22c55e', glow: '0 0 6px #22c55e', pulse: false },
  generating: { color: '#F59E0B', glow: '0 0 6px #F59E0B', pulse: true },
  loading:    { color: '#F59E0B', glow: '0 0 6px #F59E0B', pulse: true },
  error:      { color: '#E34054', glow: '0 0 6px #E34054', pulse: false },
  auth_error: { color: '#E34054', glow: '0 0 6px #E34054', pulse: false },
  idle:       { color: 'rgba(180,180,200,0.5)', glow: 'none', pulse: false },
}

function sceneStatus(imgStatus, vidStatus) {
  if (vidStatus === 'done') return 'done'
  if (imgStatus === 'generating' || vidStatus === 'generating') return 'generating'
  if (imgStatus === 'loading'    || vidStatus === 'loading')    return 'loading'
  if (imgStatus === 'error'      || vidStatus === 'error')      return 'error'
  if (imgStatus === 'auth_error' || vidStatus === 'auth_error') return 'auth_error'
  if (imgStatus === 'done') return 'done'
  return 'idle'
}

const STYLES = `
  @keyframes sceneDotPulse {
    0%, 100% { opacity: 1;    transform: scale(1);    }
    50%       { opacity: 0.35; transform: scale(0.65); }
  }
  @keyframes sceneIconPulse {
    0%, 100% { opacity: 0.4; }
    50%       { opacity: 0.15; }
  }

  /* ─────────────────────────────────────────────────────
     상단 바
     overflow-x: clip  → 가로 클리핑(스크롤 없음)
     overflow-y: visible → 카드가 아래로 바깥 레이어에 나타남
     CSS 스펙: overflow-x가 clip 일 때 overflow-y: visible 유지 가능
             (auto/scroll/hidden 일 때만 visible→auto 강제됨)
  ───────────────────────────────────────────────────── */
  .scene-nav-bar {
    height: 72px;
    flex-shrink: 0;
    position: relative;
    z-index: 10;               /* 캔버스(z-index: auto)보다 위 */
    overflow-x: clip;
    overflow-y: visible;
    backdrop-filter: blur(28px) saturate(190%);
    -webkit-backdrop-filter: blur(28px) saturate(190%);
  }

  [data-theme="dark"] .scene-nav-bar {
    background: rgba(8, 13, 28, 0.85);
    border-bottom: 1px solid rgba(255,255,255,0.07);
    box-shadow: 0 2px 20px rgba(0,0,0,0.45), inset 0 -1px 0 rgba(255,255,255,0.03);
  }

  [data-theme="light"] .scene-nav-bar {
    background: rgba(238, 244, 255, 0.92);
    border-bottom: 1px solid rgba(0,0,0,0.07);
    box-shadow: 0 2px 20px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.95);
  }

  /* 가로 스크롤용 내부 행 */
  .scene-nav-inner {
    display: flex;
    align-items: flex-start;
    padding-top: 6px;
    padding-inline: 14px;
    gap: 7px;
    width: max-content;
  }

  /* ── 래퍼: flex 레이아웃 담당 → 넓어지면 옆 카드 밀려남 ── */
  .scene-card-wrap {
    flex-shrink: 0;
    width: 94px;
    height: 54px;
    position: relative;
    transition: width 0.24s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .scene-card-wrap:hover {
    width: 110px;
  }

  /* ── 카드: absolute → 래퍼 너비 따라가고, 아래로 overflow ── */
  .scene-card {
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 54px;
    border-radius: 9px;
    cursor: pointer;
    padding: 0;
    overflow: hidden;
    z-index: 1;
    transition:
      height       0.24s cubic-bezier(0.34, 1.56, 0.64, 1),
      box-shadow   0.22s ease,
      border-color 0.15s ease;
  }

  /* 호버 시 80px → 72px 바 경계를 넘어 아래로 14px 돌출 */
  .scene-card-wrap:hover .scene-card {
    height: 80px;
    z-index: 20;
  }

  [data-theme="dark"] .scene-card {
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.12);
    box-shadow: 0 2px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.09);
  }

  [data-theme="dark"] .scene-card-wrap:hover .scene-card {
    border-color: rgba(41,217,217,0.55);
    box-shadow: 0 12px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(41,217,217,0.3), inset 0 1px 0 rgba(255,255,255,0.14);
  }

  [data-theme="light"] .scene-card {
    background: rgba(255,255,255,0.88);
    border: 1px solid rgba(0,0,0,0.09);
    box-shadow: 0 2px 10px rgba(0,0,0,0.09), inset 0 1px 0 rgba(255,255,255,1);
  }

  [data-theme="light"] .scene-card-wrap:hover .scene-card {
    border-color: rgba(41,217,217,0.6);
    box-shadow: 0 12px 32px rgba(0,0,0,0.16), 0 0 0 1px rgba(41,217,217,0.35);
  }

  /* 빈 카드 배경 */
  .scene-card-empty {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
  }
  [data-theme="dark"]  .scene-card-empty { background: rgba(20, 28, 50, 0.7); }
  [data-theme="light"] .scene-card-empty { background: rgba(215, 224, 245, 0.6); }

  /* 하단 레이블 */
  .scene-card-label {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    padding: 3px 6px 4px;
    display: flex; align-items: center; justify-content: space-between;
  }
  [data-theme="dark"]  .scene-card-label { background: linear-gradient(to top, rgba(0,0,0,0.76) 0%, transparent 100%); }
  [data-theme="light"] .scene-card-label { background: rgba(220,228,248,0.92); border-top: 1px solid rgba(0,0,0,0.06); }

  .scene-label-text { font-size: 9px; font-weight: 800; letter-spacing: 0.04em; line-height: 1; }
  [data-theme="dark"]  .scene-label-text { color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,0.6); }
  [data-theme="light"] .scene-label-text { color: rgba(20,30,70,0.82); }

  /* ── + 씬 추가 버튼 ── */
  .scene-add-btn {
    flex-shrink: 0;
    height: 54px; padding-inline: 16px;
    border-radius: 9px; cursor: pointer;
    font-family: inherit; font-size: 12px; font-weight: 700;
    letter-spacing: 0.03em; color: #29D9D9;
    display: flex; align-items: center; gap: 5px;
    transition:
      height       0.24s cubic-bezier(0.34, 1.56, 0.64, 1),
      box-shadow   0.18s ease,
      background   0.15s ease,
      border-color 0.15s ease;
  }
  .scene-add-btn:hover { height: 80px; }

  [data-theme="dark"] .scene-add-btn {
    border: 1.5px dashed rgba(41,217,217,0.38);
    background: rgba(41,217,217,0.06);
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  }
  [data-theme="dark"] .scene-add-btn:hover {
    background: rgba(41,217,217,0.12); border-color: rgba(41,217,217,0.7);
    box-shadow: 0 8px 20px rgba(41,217,217,0.12), 0 0 0 1px rgba(41,217,217,0.2);
  }
  [data-theme="light"] .scene-add-btn {
    border: 1.5px dashed rgba(41,217,217,0.55);
    background: rgba(255,255,255,0.82);
    box-shadow: 0 2px 8px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,1);
  }
  [data-theme="light"] .scene-add-btn:hover {
    background: rgba(41,217,217,0.08); border-color: rgba(41,217,217,0.8);
    box-shadow: 0 8px 20px rgba(41,217,217,0.1), 0 0 0 1px rgba(41,217,217,0.25);
  }
`

function SceneCard({ scene, onClick }) {
  const { imgStatus, vidStatus, imgResultUrl } = scene
  const overallStatus = sceneStatus(imgStatus, vidStatus)
  const dot = STATUS_DOT[overallStatus] ?? STATUS_DOT.idle
  const isVidDone    = vidStatus === 'done'
  const isGenerating = overallStatus === 'generating' || overallStatus === 'loading'

  return (
    <div className="scene-card-wrap">
      <button className="scene-card" onClick={onClick}>
        {imgResultUrl ? (
          <>
            <img
              src={imgResultUrl} alt={`씬 ${scene.index}`}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            {isVidDone && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(70,20,150,0.50)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 18, opacity: 0.9, filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.5))' }}>▶</span>
              </div>
            )}
          </>
        ) : (
          <div className="scene-card-empty">
            <span style={{
              fontSize: 20,
              opacity: isGenerating ? 0.45 : 0.2,
              animation: isGenerating ? 'sceneIconPulse 1.4s ease-in-out infinite' : 'none',
            }}>🎬</span>
          </div>
        )}

        <div className="scene-card-label">
          <span className="scene-label-text">씬 {scene.index}</span>
          <span style={{
            width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
            background: dot.color, boxShadow: dot.glow,
            animation: dot.pulse ? 'sceneDotPulse 1.2s ease-in-out infinite' : 'none',
          }} />
        </div>
      </button>
    </div>
  )
}

export default function SceneNavBar({ nodes, onAddScene }) {
  const { fitBounds } = useReactFlow()
  const barRef  = useRef()
  const innerRef = useRef()
  const [scrollX, setScrollX] = useState(0)

  // overflow-x: clip이므로 네이티브 스크롤 없음 → 휠로 직접 처리
  const handleWheel = useCallback((e) => {
    const innerW = innerRef.current?.scrollWidth ?? 0
    const barW   = barRef.current?.offsetWidth   ?? 0
    const maxScroll = Math.max(0, innerW - barW)
    if (maxScroll === 0) return
    e.preventDefault()
    const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY
    setScrollX(prev => Math.max(0, Math.min(maxScroll, prev + delta)))
  }, [])

  const scenes = useMemo(() => {
    return nodes
      .filter(n => n.id === 'bg-s2' || n.id.startsWith('bg-s2-'))
      .sort((a, b) => a.position.x - b.position.x)
      .map((bg, i) => {
        const uid = bg.id === 'bg-s2' ? null : bg.id.replace('bg-s2-', '')
        const imgNode = nodes.find(n => n.id === (uid ? `higgsfieldImage-${uid}` : 'higgsfieldImage'))
        const vidNode = nodes.find(n => n.id === (uid ? `higgsfieldVideo-${uid}` : 'higgsfieldVideo'))
        return {
          index: i + 1,
          bgX: bg.position.x,
          imgStatus:    imgNode?.data?.status    ?? 'idle',
          imgResultUrl: imgNode?.data?.resultUrl ?? null,
          vidStatus:    vidNode?.data?.status    ?? 'idle',
        }
      })
  }, [nodes])

  const goToScene = (scene) => {
    fitBounds(
      { x: scene.bgX, y: 540, width: 950, height: 1260 },
      { duration: 420, padding: 0.05 },
    )
  }

  return (
    <>
      <style>{STYLES}</style>
      <div ref={barRef} className="scene-nav-bar" onWheel={handleWheel}>
        <div
          ref={innerRef}
          className="scene-nav-inner"
          style={{ transform: `translateX(-${scrollX}px)` }}
        >
          {scenes.map(scene => (
            <SceneCard key={scene.index} scene={scene} onClick={() => goToScene(scene)} />
          ))}

          <button className="scene-add-btn" onClick={onAddScene}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
            씬 추가
          </button>
        </div>
      </div>
    </>
  )
}
