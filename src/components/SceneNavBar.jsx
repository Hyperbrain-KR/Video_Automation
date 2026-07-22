import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react'
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

const fmtTime = (d) => d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
const fmtDate = (iso) => {
  const d = new Date(iso)
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
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
     상단 바 레이아웃
     bar = flex row; left = project area; right = scrollable scenes
     overflow: visible on bar → cards drop below freely
     overflow-x: clip on scenes area → horizontal clip only
  ───────────────────────────────────────────────────── */
  .scene-nav-bar {
    height: 72px;
    flex-shrink: 0;
    display: flex;
    align-items: stretch;
    position: relative;
    z-index: 10;
    overflow: visible;
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

  /* ── 왼쪽 프로젝트 영역 ── */
  .scene-nav-left {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    padding: 0 14px;
    min-width: 160px;
    position: relative;
  }
  [data-theme="dark"]  .scene-nav-left { border-right: 1px solid rgba(255,255,255,0.07); }
  [data-theme="light"] .scene-nav-left { border-right: 1px solid rgba(0,0,0,0.07); }

  /* ── 오른쪽 씬 스크롤 래퍼 (flex 아이템, 72px) ── */
  .scene-nav-scenes-wrap {
    flex: 1;
    position: relative;
    overflow: visible;
  }

  /* ── 실제 스크롤 컨테이너 (absolute, 96px = 72px 보이는 영역 + 24px 카드 확장 여유) ── */
  .scene-nav-scenes {
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 96px;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
  }
  .scene-nav-scenes::-webkit-scrollbar { display: none; }

  /* 씬 내부 행 */
  .scene-nav-inner {
    display: flex;
    align-items: flex-start;
    padding-top: 6px;
    padding-inline: 14px;
    gap: 7px;
    width: max-content;
    min-height: 100%;
  }

  /* ── 씬 카드 래퍼: flex 레이아웃 담당 ── */
  .scene-card-wrap {
    flex-shrink: 0;
    width: 94px;
    height: 54px;
    position: relative;
    transition: width 0.24s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .scene-card-wrap:hover { width: 110px; }

  /* ── 씬 카드: absolute → 아래로 overflow ── */
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
  .scene-card-wrap:hover .scene-card { height: 80px; z-index: 20; }

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

  .scene-card-empty {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
  }
  [data-theme="dark"]  .scene-card-empty { background: rgba(20, 28, 50, 0.7); }
  [data-theme="light"] .scene-card-empty { background: rgba(215, 224, 245, 0.6); }

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

  /* ── 씬 삭제 버튼 ── */
  .scene-delete-btn {
    position: absolute; top: 4px; right: 4px; z-index: 30;
    width: 16px; height: 16px; border-radius: 50%;
    border: none; cursor: pointer; font-size: 9px; line-height: 1;
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: opacity 0.15s, transform 0.15s;
    pointer-events: none;
    background: rgba(227,64,84,0.85);
    color: #fff;
    box-shadow: 0 1px 4px rgba(0,0,0,0.4);
  }
  .scene-card-wrap:hover .scene-delete-btn {
    opacity: 1; pointer-events: auto;
  }
  .scene-delete-btn:hover { transform: scale(1.15); background: #E34054; }

  /* ── 씬 삭제 확인 오버레이 ── */
  .scene-confirm-overlay {
    position: absolute; inset: 0; z-index: 25; border-radius: 8px;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 5px;
    backdrop-filter: blur(4px);
  }
  [data-theme="dark"]  .scene-confirm-overlay { background: rgba(10,15,30,0.88); }
  [data-theme="light"] .scene-confirm-overlay { background: rgba(220,228,248,0.92); }

  /* ── 씬 스크롤 화살표 ── */
  .scene-scroll-arrow {
    position: absolute; top: 50%; transform: translateY(-50%);
    z-index: 15; height: 40px; width: 26px;
    border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 800;
    transition: opacity 0.15s;
    pointer-events: auto;
  }
  .scene-scroll-arrow-left  { left: 0;  border-radius: 0 6px 6px 0; }
  .scene-scroll-arrow-right { right: 0; border-radius: 6px 0 0 6px; }
  [data-theme="dark"]  .scene-scroll-arrow {
    background: linear-gradient(90deg, rgba(8,13,28,0.92) 60%, transparent 100%);
    color: rgba(255,255,255,0.55);
  }
  [data-theme="dark"]  .scene-scroll-arrow-right {
    background: linear-gradient(270deg, rgba(8,13,28,0.92) 60%, transparent 100%);
  }
  [data-theme="light"] .scene-scroll-arrow {
    background: linear-gradient(90deg, rgba(238,244,255,0.95) 60%, transparent 100%);
    color: rgba(0,0,0,0.4);
  }
  [data-theme="light"] .scene-scroll-arrow-right {
    background: linear-gradient(270deg, rgba(238,244,255,0.95) 60%, transparent 100%);
  }
  .scene-scroll-arrow:hover { opacity: 0.75; }

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

  /* ── 프로젝트 드롭다운 ── */
  .proj-trigger {
    display: flex; align-items: center; gap: 6px;
    background: none; border: none; cursor: pointer;
    padding: 4px 6px; border-radius: 6px;
    font-family: inherit;
    width: 100%;
    transition: background 0.12s;
  }
  .proj-trigger:hover { background: rgba(255,255,255,0.06); }
  [data-theme="light"] .proj-trigger:hover { background: rgba(0,0,0,0.04); }

  .proj-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    min-width: 210px;
    border-radius: 10px;
    overflow: hidden;
    z-index: 200;
    box-shadow: 0 16px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06);
    backdrop-filter: blur(20px) saturate(160%);
    -webkit-backdrop-filter: blur(20px) saturate(160%);
  }
  [data-theme="dark"]  .proj-dropdown { background: rgba(14, 20, 40, 0.96); border: 1px solid rgba(255,255,255,0.09); }
  [data-theme="light"] .proj-dropdown { background: rgba(240, 245, 255, 0.97); border: 1px solid rgba(0,0,0,0.09); }

  .proj-item {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 12px;
    cursor: pointer;
    border: none; background: none; width: 100%;
    font-family: inherit; text-align: left;
    transition: background 0.1s;
  }
  .proj-item:hover { background: rgba(41,217,217,0.07); }
  .proj-item.active { background: rgba(41,217,217,0.09); }

  .proj-sep { height: 1px; margin: 4px 10px; }
  [data-theme="dark"]  .proj-sep { background: rgba(255,255,255,0.07); }
  [data-theme="light"] .proj-sep { background: rgba(0,0,0,0.07); }

  .proj-new-btn {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 12px;
    width: 100%; border: none; background: none;
    cursor: pointer; font-family: inherit; text-align: left;
    font-size: 12px; font-weight: 700; color: #29D9D9;
    transition: background 0.1s;
  }
  .proj-new-btn:hover { background: rgba(41,217,217,0.07); }
`

// ── ProjectSelector ────────────────────────────────────────────────────────
function ProjectSelector({ projects, activeProject, saveState, savedAt, onSwitch, onCreate, onDelete, onRename }) {
  const [open, setOpen]             = useState(false)
  const [creating, setCreating]     = useState(false)
  const [newName, setNewName]       = useState('')
  const [renamingId, setRenamingId] = useState(null)
  const [renameName, setRenameName] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  // 트리거에서 직접 이름 편집 중인지
  const [editingTrigger, setEditingTrigger] = useState(false)
  const [triggerName, setTriggerName]       = useState('')
  const dropRef    = useRef()
  const triggerInputRef = useRef()

  // Click outside → close
  useEffect(() => {
    if (!open && !editingTrigger) return
    const handler = (e) => {
      if (!dropRef.current?.contains(e.target)) {
        setOpen(false)
        setCreating(false)
        setRenamingId(null)
        setDeletingId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, editingTrigger])

  // 트리거 이름 편집 시작
  const startTriggerEdit = (e) => {
    e.stopPropagation()
    if (!activeProject) return
    setTriggerName(activeProject.name)
    setEditingTrigger(true)
    setOpen(false)
    setTimeout(() => triggerInputRef.current?.select(), 0)
  }

  const commitTriggerEdit = () => {
    if (triggerName.trim() && activeProject) onRename(activeProject.id, triggerName.trim())
    setEditingTrigger(false)
  }

  const handleCreate = () => {
    const name = newName.trim() || `프로젝트 ${projects.length + 1}`
    onCreate(name)
    setCreating(false)
    setNewName('')
    setOpen(false)
  }

  const handleRename = (id) => {
    if (renameName.trim()) onRename(id, renameName.trim())
    setRenamingId(null)
    setRenameName('')
  }

  return (
    <div ref={dropRef} className="scene-nav-left">
      <div style={{ width: '100%' }}>
        {/* 트리거 */}
        {editingTrigger ? (
          // 이름 인라인 편집 모드
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 6px' }}>
            <span style={{ fontSize: 13, lineHeight: 1 }}>📁</span>
            <input
              ref={triggerInputRef}
              autoFocus
              value={triggerName}
              onChange={e => setTriggerName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') commitTriggerEdit()
                if (e.key === 'Escape') setEditingTrigger(false)
              }}
              onBlur={commitTriggerEdit}
              style={{
                flex: 1, background: 'transparent',
                border: 'none', borderBottom: '1.5px solid rgba(41,217,217,0.6)',
                fontSize: 12, fontWeight: 700, color: 'var(--t1)',
                outline: 'none', fontFamily: 'inherit', padding: '1px 2px',
              }}
            />
          </div>
        ) : (
          <button
            className="proj-trigger"
            onClick={() => { setOpen(o => !o); setCreating(false); setRenamingId(null) }}
          >
            <span style={{ fontSize: 13, lineHeight: 1 }}>📁</span>
            {/* 이름 부분: 더블클릭으로 편집 */}
            <span
              style={{
                fontSize: 12, fontWeight: 700, color: 'var(--t1)',
                maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                flex: 1, textAlign: 'left',
              }}
              onDoubleClick={startTriggerEdit}
              title="더블클릭으로 이름 변경"
            >
              {activeProject?.name ?? '새 프로젝트'}
            </span>
            <span style={{ fontSize: 8, color: 'var(--t4)', flexShrink: 0 }}>▾</span>
          </button>
        )}

        {/* 저장 상태 */}
        <div style={{ fontSize: 9, color: 'var(--t5)', paddingLeft: 7, marginTop: 1 }}>
          {saveState === 'pending' && '저장 중…'}
          {saveState === 'saved' && savedAt && `저장됨 ${fmtTime(savedAt)}`}
        </div>
      </div>

      {/* 드롭다운 */}
      {open && (
        <div className="proj-dropdown">
          {projects.length === 0 && (
            <div style={{ padding: '9px 14px', fontSize: 11, color: 'var(--t5)' }}>
              저장된 프로젝트 없음
            </div>
          )}
          {projects.map(p => (
            <div key={p.id}>
              {renamingId === p.id ? (
                <div style={{ display: 'flex', gap: 6, padding: '6px 10px' }}>
                  <input
                    autoFocus
                    value={renameName}
                    onChange={e => setRenameName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRename(p.id)
                      if (e.key === 'Escape') setRenamingId(null)
                    }}
                    style={{
                      flex: 1, background: 'var(--node-input)',
                      border: '1px solid rgba(41,217,217,0.35)',
                      borderRadius: 5, padding: '3px 7px',
                      fontSize: 12, color: 'var(--t1)', outline: 'none', fontFamily: 'inherit',
                    }}
                  />
                  <button onClick={() => handleRename(p.id)} style={{
                    background: 'rgba(41,217,217,0.15)', border: '1px solid rgba(41,217,217,0.4)',
                    borderRadius: 5, padding: '3px 9px', fontSize: 11, fontWeight: 700,
                    color: '#29D9D9', cursor: 'pointer', fontFamily: 'inherit',
                  }}>✓</button>
                </div>
              ) : deletingId === p.id ? (
                // 삭제 확인
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '7px 12px', gap: 8,
                  background: 'rgba(227,64,84,0.08)',
                }}>
                  <span style={{ fontSize: 11, color: '#E34054', fontWeight: 600 }}>
                    「{p.name}」 삭제할까요?
                  </span>
                  <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                    <button onClick={() => setDeletingId(null)} style={{
                      background: 'none', border: '1px solid var(--sep2)',
                      borderRadius: 5, padding: '3px 8px', fontSize: 11,
                      color: 'var(--t3)', cursor: 'pointer', fontFamily: 'inherit',
                    }}>취소</button>
                    <button onClick={() => { onDelete(p.id); setDeletingId(null) }} style={{
                      background: 'rgba(227,64,84,0.15)', border: '1px solid rgba(227,64,84,0.4)',
                      borderRadius: 5, padding: '3px 8px', fontSize: 11, fontWeight: 700,
                      color: '#E34054', cursor: 'pointer', fontFamily: 'inherit',
                    }}>삭제</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <button
                    className={`proj-item${p.id === activeProject?.id ? ' active' : ''}`}
                    style={{ flex: 1 }}
                    onClick={() => { if (p.id !== activeProject?.id) onSwitch(p.id); setOpen(false) }}
                  >
                    <span style={{ width: 12, fontSize: 9, color: '#29D9D9', flexShrink: 0 }}>
                      {p.id === activeProject?.id ? '✓' : ''}
                    </span>
                    <span style={{
                      fontSize: 12, fontWeight: p.id === activeProject?.id ? 700 : 500,
                      color: 'var(--t1)', flex: 1,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {p.name}
                    </span>
                    <span style={{ fontSize: 9, color: 'var(--t5)', flexShrink: 0, marginLeft: 6 }}>
                      {fmtDate(p.updatedAt)}
                    </span>
                  </button>
                  {/* 이름 변경 */}
                  <button
                    title="이름 변경"
                    onClick={e => { e.stopPropagation(); setRenamingId(p.id); setRenameName(p.name) }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 11, color: 'var(--t4)', padding: '0 7px',
                      flexShrink: 0, transition: 'color 0.1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#29D9D9'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--t4)'}
                  >✎</button>
                  {/* 삭제 */}
                  <button
                    title="삭제"
                    onClick={e => { e.stopPropagation(); setDeletingId(p.id) }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 11, color: 'var(--t4)', padding: '0 10px 0 4px',
                      flexShrink: 0, transition: 'color 0.1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#E34054'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--t4)'}
                  >🗑</button>
                </div>
              )}
            </div>
          ))}

          <div className="proj-sep" />

          {creating ? (
            <div style={{ display: 'flex', gap: 6, padding: '6px 10px 8px' }}>
              <input
                autoFocus
                value={newName}
                placeholder={`프로젝트 ${projects.length + 1}`}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreate()
                  if (e.key === 'Escape') setCreating(false)
                }}
                style={{
                  flex: 1, background: 'var(--node-input)',
                  border: '1px solid rgba(41,217,217,0.35)',
                  borderRadius: 5, padding: '4px 8px',
                  fontSize: 12, color: 'var(--t1)', outline: 'none', fontFamily: 'inherit',
                }}
              />
              <button onClick={handleCreate} style={{
                background: 'rgba(41,217,217,0.15)', border: '1px solid rgba(41,217,217,0.4)',
                borderRadius: 5, padding: '4px 10px', fontSize: 11, fontWeight: 700,
                color: '#29D9D9', cursor: 'pointer', fontFamily: 'inherit',
              }}>확인</button>
            </div>
          ) : (
            <button className="proj-new-btn" onClick={() => setCreating(true)}>
              <span style={{ fontSize: 15, lineHeight: 1 }}>+</span>
              새 프로젝트
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── SceneCard ──────────────────────────────────────────────────────────────
function SceneCard({ scene, onClick, onDelete }) {
  const { imgStatus, vidStatus, imgResultUrl, vidResultUrl } = scene
  const overallStatus = sceneStatus(imgStatus, vidStatus)
  const dot = STATUS_DOT[overallStatus] ?? STATUS_DOT.idle
  const isVidDone    = vidStatus === 'done'
  const isGenerating = overallStatus === 'generating' || overallStatus === 'loading'
  const [confirm, setConfirm] = useState(false)
  const canDelete = scene.uid !== null  // 씬 1은 삭제 불가

  // 스텝2 이미지 없고 스텝3 비디오만 있을 때 첫 프레임을 캔버스로 추출
  const [vidThumb, setVidThumb] = useState(null)
  const thumbAttempted = React.useRef(false)
  React.useEffect(() => {
    if (imgResultUrl || !vidResultUrl || thumbAttempted.current) return
    thumbAttempted.current = true
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.preload = 'metadata'
    video.src = vidResultUrl
    const capture = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth || 320
        canvas.height = video.videoHeight || 180
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
        setVidThumb(canvas.toDataURL('image/jpeg', 0.75))
      } catch {
        // CORS 등으로 추출 실패 시 video 엘리먼트로 폴백
        setVidThumb('__video__')
      }
    }
    video.addEventListener('seeked', capture, { once: true })
    video.addEventListener('loadedmetadata', () => { video.currentTime = 0.01 }, { once: true })
    video.addEventListener('error', () => setVidThumb('__video__'), { once: true })
    video.load()
  }, [imgResultUrl, vidResultUrl])

  const thumbSrc = imgResultUrl || (vidThumb && vidThumb !== '__video__' ? vidThumb : null)
  const showVideoFallback = !imgResultUrl && vidResultUrl && vidThumb === '__video__'

  return (
    <div className="scene-card-wrap">
      <button className="scene-card" onClick={confirm ? undefined : onClick}>
        {thumbSrc ? (
          <>
            <img
              src={thumbSrc} alt={`씬 ${scene.index}`}
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
        ) : showVideoFallback ? (
          <>
            <video
              src={vidResultUrl} muted preload="metadata"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onLoadedMetadata={e => { e.target.currentTime = 0.01 }}
            />
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(70,20,150,0.50)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 18, opacity: 0.9, filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.5))' }}>▶</span>
            </div>
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

        {/* 삭제 확인 오버레이 */}
        {confirm && (
          <div className="scene-confirm-overlay" onClick={e => e.stopPropagation()}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.04em' }}>씬 삭제?</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={e => { e.stopPropagation(); setConfirm(false) }}
                style={{ fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 4,
                  border: '1px solid var(--sep2)', background: 'var(--node-section)',
                  color: 'var(--t3)', cursor: 'pointer', fontFamily: 'inherit' }}
              >취소</button>
              <button
                onClick={e => { e.stopPropagation(); onDelete(scene.uid) }}
                style={{ fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 4,
                  border: '1px solid rgba(227,64,84,0.4)', background: 'rgba(227,64,84,0.15)',
                  color: '#E34054', cursor: 'pointer', fontFamily: 'inherit' }}
              >삭제</button>
            </div>
          </div>
        )}
      </button>

      {/* 씬 1 제외 삭제 버튼 */}
      {canDelete && !confirm && (
        <button
          className="scene-delete-btn"
          onClick={e => { e.stopPropagation(); setConfirm(true) }}
          title="씬 삭제"
        >✕</button>
      )}
    </div>
  )
}

// ── SceneNavBar ────────────────────────────────────────────────────────────
export default function SceneNavBar({
  nodes, onAddScene, onDeleteScene,
  projects, activeProject, saveState, savedAt,
  onSwitchProject, onCreateProject, onDeleteProject, onRenameProject,
}) {
  const { fitBounds } = useReactFlow()
  const scenesRef = useRef()
  const [scrollX, setScrollX]     = useState(0)
  const [maxScroll, setMaxScroll] = useState(0)

  // 스크롤 위치 동기화 (네이티브 scroll 이벤트)
  useEffect(() => {
    const el = scenesRef.current
    if (!el) return
    const sync = () => {
      setScrollX(el.scrollLeft)
      setMaxScroll(Math.max(0, el.scrollWidth - el.clientWidth))
    }
    el.addEventListener('scroll', sync, { passive: true })
    return () => el.removeEventListener('scroll', sync)
  }, [])

  // 콘텐츠 너비 변경 시 maxScroll 재계산
  useEffect(() => {
    const el = scenesRef.current
    if (!el) return
    requestAnimationFrame(() => {
      setMaxScroll(Math.max(0, el.scrollWidth - el.clientWidth))
    })
  }, [nodes])

  // non-passive wheel → 페이지 스크롤 방지 후 씬 영역만 스크롤
  useEffect(() => {
    const el = scenesRef.current
    if (!el) return
    const handler = (e) => {
      if (el.scrollWidth <= el.clientWidth) return
      e.preventDefault()
      el.scrollLeft += e.deltaX !== 0 ? e.deltaX : e.deltaY
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  const scrollBy = (dir) => {
    const el = scenesRef.current
    if (!el) return
    el.scrollLeft += dir * 200
  }

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
          uid,
          bgX: bg.position.x,
          imgStatus:    imgNode?.data?.status    ?? 'idle',
          imgResultUrl: imgNode?.data?.resultUrl ?? null,
          vidStatus:    vidNode?.data?.status    ?? 'idle',
          vidResultUrl: vidNode?.data?.resultUrl ?? null,
        }
      })
  }, [nodes])

  const goToScene = useCallback((scene) => {
    fitBounds(
      { x: scene.bgX, y: 540, width: 950, height: 1260 },
      { duration: 420, padding: 0.05 },
    )
  }, [fitBounds])

  // 키보드 단축키: 1~9 → 씬 1~9, 0 → 씬 10, Shift+1~9 → 씬 11~19, Shift+0 → 씬 20
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return
      if (!e.code.startsWith('Digit')) return
      const digit = parseInt(e.code.replace('Digit', ''), 10)
      const idx = e.shiftKey ? (digit === 0 ? 20 : digit + 10) : (digit === 0 ? 10 : digit)
      const scene = scenes[idx - 1]
      if (scene) goToScene(scene)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [scenes, goToScene])

  return (
    <>
      <style>{STYLES}</style>
      <div className="scene-nav-bar">

        {/* 왼쪽: 프로젝트 선택기 */}
        <ProjectSelector
          projects={projects}
          activeProject={activeProject}
          saveState={saveState}
          savedAt={savedAt}
          onSwitch={onSwitchProject}
          onCreate={onCreateProject}
          onDelete={onDeleteProject}
          onRename={onRenameProject}
        />

        {/* 오른쪽: 씬 카드 스크롤 영역 */}
        <div className="scene-nav-scenes-wrap">
        <div ref={scenesRef} className="scene-nav-scenes">
          {/* 왼쪽 스크롤 화살표 */}
          {scrollX > 0 && (
            <button className="scene-scroll-arrow scene-scroll-arrow-left" onClick={() => scrollBy(-1)}>◀</button>
          )}

          <div className="scene-nav-inner">
            {scenes.map(scene => (
              <SceneCard key={scene.uid ?? 'scene1'} scene={scene} onClick={() => goToScene(scene)} onDelete={onDeleteScene} />
            ))}

            <button className="scene-add-btn" onClick={onAddScene}>
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
              씬 추가
            </button>
          </div>

          {/* 오른쪽 스크롤 화살표 */}
          {scrollX < maxScroll && (
            <button className="scene-scroll-arrow scene-scroll-arrow-right" onClick={() => scrollBy(1)}>▶</button>
          )}
        </div>
        </div>

      </div>
    </>
  )
}
