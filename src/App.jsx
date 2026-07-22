import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  useNodesState, useEdgesState, useReactFlow,
  addEdge, BackgroundVariant,
} from '@xyflow/react'
import { CharactersContext } from './lib/CharactersContext'
import { ProjectContext } from './lib/ProjectContext'
import { deleteProjectImages, saveImage as saveImageDB, deleteImage as deleteImageDB } from './lib/imageDB'
import { useProjects, loadSavedProject, getActiveProjectId } from './hooks/useProjects'
import { nodes0, edges0, buildScene, nodeTemplates, resetInProgressNodes } from './lib/initialCanvas'
import { useClaudeGenerate } from './hooks/useClaudeGenerate'
import { useHiggsfieldGenerate } from './hooks/useHiggsfieldGenerate'
import '@xyflow/react/dist/style.css'
import './App.css'

import ReviewGateNode from './nodes/ReviewGateNode'
import StyleAnchorInputNode from './nodes/StyleAnchorInputNode'
import TextInputNode from './nodes/TextInputNode'
import ClaudeNode from './nodes/ClaudeNode'
import HiggsfieldNode from './nodes/HiggsfieldNode'
import SectionBackgroundNode from './nodes/SectionBackgroundNode'
import ScriptImportNode from './nodes/ScriptImportNode'
import ReferenceImageNode from './nodes/ReferenceImageNode'
import ContextMenu from './components/ContextMenu'
import SceneNavBar from './components/SceneNavBar'

function SlotDigit({ char }) {
  if (!/\d/.test(char)) {
    return <span style={{ display: 'inline-flex', alignItems: 'center', height: '1em' }}>{char}</span>
  }
  const n = parseInt(char, 10)
  return (
    <span style={{ display: 'inline-block', overflow: 'hidden', height: '1em', lineHeight: '1em' }}>
      <span style={{
        display: 'flex', flexDirection: 'column',
        transform: `translateY(${-n}em)`,
        transition: 'transform 0.45s cubic-bezier(0.22,1,0.36,1)',
        willChange: 'transform',
      }}>
        {[0,1,2,3,4,5,6,7,8,9].map(d => (
          <span key={d} style={{ display: 'block', height: '1em', lineHeight: '1em', textAlign: 'center' }}>{d}</span>
        ))}
      </span>
    </span>
  )
}

function SlotCounter({ value }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      {String(value).split('').map((ch, i) => <SlotDigit key={i} char={ch} />)}
    </span>
  )
}

const nodeTypes = {
  reviewGate: ReviewGateNode,
  styleAnchorInput: StyleAnchorInputNode,
  textInput: TextInputNode,
  claudeNode: ClaudeNode,
  higgsfieldNode: HiggsfieldNode,
  sectionBackground: SectionBackgroundNode,
  scriptImport: ScriptImportNode,
  referenceImage: ReferenceImageNode,
}

function FlowCanvas() {
  const { screenToFlowPosition, getNodes } = useReactFlow()

  // 최초 마운트 시 localStorage에서 프로젝트 데이터 로드 (lazy initializer로 한 번만 실행)
  const [initData] = useState(() => {
    const saved = loadSavedProject(getActiveProjectId())
    // 구형 저장 데이터 호환: canvas-characters fallback
    const initChars = saved?.characters
      ?? (() => { try { return JSON.parse(localStorage.getItem('canvas-characters') || '[]') } catch { return [] } })()
    return saved
      ? { nodes: resetInProgressNodes(saved.nodes), edges: saved.edges, characters: initChars }
      : { nodes: nodes0, edges: edges0, characters: [] }
  })

  const [nodes, setNodes, onNodesChange] = useNodesState(initData.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initData.edges)
  // 캐릭터는 프로젝트별 저장 — 새 프로젝트 생성 시 빈 배열로 초기화됨
  const [characters, setCharacters] = useState(initData.characters)

  // ── 프로젝트 관리 ──────────────────────────────────────────────────────
  const {
    projects, activeId, activeProject,
    saveProject, createProject, switchProject, deleteProject, renameProject,
  } = useProjects()

  const [saveState, setSaveState] = useState('idle') // 'idle' | 'pending' | 'saved'
  const [savedAt, setSavedAt]     = useState(null)
  const saveTimerRef = useRef(null)
  const isMountedRef = useRef(false)

  // base64 imageDataUrl은 localStorage 용량 한도 초과 방지를 위해 저장에서 제외
  const stripLargeData = (nodes) => nodes.map(n => {
    if (!n.data?.imageDataUrl) return n
    return { ...n, data: { ...n.data, imageDataUrl: null } }
  })

  // 노드/엣지 변경 시 auto-save (마운트 직후 첫 렌더는 skip)
  useEffect(() => {
    if (!isMountedRef.current) { isMountedRef.current = true; return }
    setSaveState('pending')
    clearTimeout(saveTimerRef.current)
    // nodes/edges/characters를 클로저에 직접 캡처 (getNodes()는 remount 중 stale 가능)
    const snapNodes = stripLargeData(nodes)
    const snapEdges = edges
    const snapChars = characters
    const snapActiveId = activeId
    saveTimerRef.current = setTimeout(() => {
      try {
        if (snapActiveId) {
          saveProject(snapActiveId, snapNodes, snapEdges, snapChars)
        } else {
          createProject('내 프로젝트', snapNodes, snapEdges, snapChars)
        }
        setSaveState('saved')
        setSavedAt(new Date())
      } catch (e) {
        console.warn('캔버스 저장 실패 (저장공간 부족):', e)
        setSaveState('idle')
      }
    }, 1500)
    return () => clearTimeout(saveTimerRef.current)
  // activeId/saveProject/createProject는 timeout 내에서 스냅샷으로 사용 — deps에 추가하면 프로젝트 전환 시 잘못된 저장 유발
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, characters])

  const handleSwitchProject = useCallback((id) => {
    clearTimeout(saveTimerRef.current)
    if (activeId) saveProject(activeId, stripLargeData(nodes), edges, characters)
    const data = switchProject(id)
    if (data) {
      setNodes(resetInProgressNodes(data.nodes))
      setEdges(data.edges)
      setCharacters(data.characters ?? [])
    }
    setSaveState('idle')
    setSavedAt(null)
    isMountedRef.current = false
  }, [activeId, nodes, edges, characters, saveProject, switchProject, setNodes, setEdges, setCharacters])

  const handleDeleteProject = useCallback((id) => {
    clearTimeout(saveTimerRef.current)
    deleteProjectImages(id).catch(() => {})
    const remaining = deleteProject(id)
    if (id === activeId) {
      if (remaining.length > 0) {
        const data = switchProject(remaining[0].id)
        if (data) {
          setNodes(resetInProgressNodes(data.nodes))
          setEdges(data.edges)
          setCharacters(data.characters ?? [])
        }
      } else {
        setNodes(nodes0)
        setEdges(edges0)
        setCharacters([])
      }
      setSaveState('idle')
      setSavedAt(null)
      isMountedRef.current = false
    }
  }, [activeId, deleteProject, switchProject, setNodes, setEdges, setCharacters])

  const handleCreateProject = useCallback((name) => {
    clearTimeout(saveTimerRef.current)
    if (activeId) saveProject(activeId, stripLargeData(nodes), edges, characters)
    createProject(name, nodes0, edges0, [])
    setNodes(nodes0)
    setEdges(edges0)
    setCharacters([])
    setSaveState('idle')
    setSavedAt(null)
    isMountedRef.current = false
  }, [activeId, nodes, edges, characters, saveProject, createProject, setNodes, setEdges, setCharacters])

  // ── 캐릭터 저장소 (프로젝트별 — auto-save와 함께 저장됨) ────────────────
  const saveCharacter = useCallback((name, resultUrl) => {
    const id = `char-${Date.now()}`
    if (resultUrl?.startsWith('data:')) {
      saveImageDB(`char-${id}`, resultUrl).catch(e => console.warn('캐릭터 이미지 저장 실패:', e))
      setCharacters(prev => [...prev, { id, name, hasLocalImage: true }])
    } else {
      setCharacters(prev => [...prev, { id, name, resultUrl }])
    }
  }, [])
  const deleteCharacter = useCallback((charId) => {
    setCharacters(prev => prev.filter(c => c.id !== charId))
    deleteImageDB(`char-${charId}`).catch(() => {})
  }, [])
  const [contextMenu, setContextMenu] = useState(null)
  const [theme, setTheme] = useState(() => localStorage.getItem('canvas-theme') ?? 'dark')
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('canvas-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    document.documentElement.classList.add('theme-transitioning')
    setTheme(t => t === 'dark' ? 'light' : 'dark')
    setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 350)
  }


  // ── 씬 삭제 ──────────────────────────────────────────────────
  const deleteScene = useCallback((uid) => {
    if (!uid) return  // 씬 1 보호
    setNodes(nds => nds.filter(n => !n.id.endsWith(`-${uid}`)))
    setEdges(eds => eds.filter(e => !e.id.endsWith(`-${uid}`)))
  }, [setNodes, setEdges])

  // ── 씬 추가 ──────────────────────────────────────────────────
  const addScene = useCallback(() => {
    const sceneIdx = getNodes().filter(n => n.data?.step?.includes('Step 02')).length + 1
    const { nodes: newNodes, edges: newEdges } = buildScene(sceneIdx)
    setNodes(nds => [...nds, ...newNodes])
    setEdges(eds => [...eds, ...newEdges])
  }, [getNodes, setNodes, setEdges])

  useClaudeGenerate(activeId)
  useHiggsfieldGenerate(characters)

  // 노드 연결
  const onConnect = useCallback((params) => {
    setEdges(eds => addEdge({ ...params, type: 'smoothstep' }, eds))
  }, [setEdges])

  // ── Higgsfield 인증 오류 감지 ────────────────────────────
  const hasHiggsfieldAuthError = useMemo(
    () => nodes.some(n => n.data?.status === 'auth_error'),
    [nodes]
  )

  // ── Higgsfield 크레딧 조회 ───────────────────────────────
  const [hfCredits, setHfCredits] = useState(null)
  const [hfCreditsRaw, setHfCreditsRaw] = useState(null)
  const fetchHfCredits = useCallback(() => {
    fetch('http://localhost:3002/api/higgsfield/credits')
      .then(r => r.json())
      .then(d => {
        if (d.error) { setHfCredits('error'); return }
        setHfCredits(d.credits)
        setHfCreditsRaw(d.raw ?? null)
      })
      .catch(() => setHfCredits('error'))
  }, [])
  useEffect(() => {
    if (!hasHiggsfieldAuthError) fetchHfCredits()
  }, [hasHiggsfieldAuthError, fetchHfCredits])
  useEffect(() => {
    const handler = () => setTimeout(fetchHfCredits, 3000)
    window.addEventListener('higgsfield-generate-done', handler)
    return () => window.removeEventListener('higgsfield-generate-done', handler)
  }, [fetchHfCredits])

  // ── Claude 사용량 조회 ───────────────────────────────────
  const [claudeCost, setClaudeCost] = useState(null)
  const fetchClaudeCost = useCallback(() => {
    if (!activeId) return
    fetch(`http://localhost:3002/api/usage/claude?projectId=${encodeURIComponent(activeId)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setClaudeCost('error'); return }
        setClaudeCost(d.cost ?? 0)
      })
      .catch(() => setClaudeCost('error'))
  }, [activeId])
  useEffect(() => { fetchClaudeCost() }, [fetchClaudeCost])
  useEffect(() => {
    const handler = () => fetchClaudeCost()
    window.addEventListener('claude-generate-done', handler)
    return () => window.removeEventListener('claude-generate-done', handler)
  }, [fetchClaudeCost])

  // ── 활성 노드 엣지 강조 ──────────────────────────────────
  const activeEdges = useMemo(() => {
    const activeIds = new Set(
      nodes
        .filter(n => n.data?.status === 'loading' || n.data?.status === 'generating')
        .map(n => n.id)
    )
    if (activeIds.size === 0) return edges
    return edges.map(edge => {
      if (!activeIds.has(edge.source) && !activeIds.has(edge.target)) return edge
      return {
        ...edge,
        animated: true,
        style: { ...edge.style, stroke: '#22c55e', strokeWidth: 2 },
        className: (edge.className ?? '') + ' edge-active',
      }
    })
  }, [edges, nodes])

  // ── 우클릭: 빈 캔버스 ────────────────────────────────────
  const onPaneContextMenu = useCallback((event) => {
    event.preventDefault()
    const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    setContextMenu({ x: event.clientX, y: event.clientY, flowPos, mode: 'pane' })
  }, [screenToFlowPosition])

  // ── 우클릭: 노드 ─────────────────────────────────────────
  const onNodeContextMenu = useCallback((event, node) => {
    if (node.selectable === false) return
    event.preventDefault()
    setContextMenu({ x: event.clientX, y: event.clientY, mode: 'node', nodeId: node.id })
  }, [])

  // ── 우클릭: 엣지 ─────────────────────────────────────────
  const onEdgeContextMenu = useCallback((event, edge) => {
    event.preventDefault()
    setContextMenu({ x: event.clientX, y: event.clientY, mode: 'edge', edgeId: edge.id })
  }, [])

  const onPaneClick = useCallback(() => setContextMenu(null), [])

  // ── 노드 추가 ─────────────────────────────────────────────
  const handleAddNode = useCallback((nodeKey) => {
    const tmpl = nodeTemplates[nodeKey]
    if (!tmpl || !contextMenu) return
    setNodes(nds => [
      ...nds,
      {
        id: `${nodeKey}-${Date.now()}`,
        position: contextMenu.flowPos,
        ...tmpl,
      },
    ])
  }, [contextMenu, setNodes])

  // ── 노드 삭제 / 복제 ─────────────────────────────────────
  const handleNodeAction = useCallback((action) => {
    if (!contextMenu?.nodeId) return
    const id = contextMenu.nodeId
    if (action === 'delete') {
      setNodes(nds => nds.filter(n => n.id !== id))
      setEdges(eds => eds.filter(e => e.source !== id && e.target !== id))
    } else if (action === 'duplicate') {
      const node = nodes.find(n => n.id === id)
      if (!node) return
      setNodes(nds => [
        ...nds,
        { ...node, id: `${node.type}-${Date.now()}`, position: { x: node.position.x + 30, y: node.position.y + 30 }, selected: false },
      ])
    }
  }, [contextMenu, nodes, setNodes, setEdges])

  // ── 엣지 삭제 ─────────────────────────────────────────────
  const handleEdgeAction = useCallback((action) => {
    if (!contextMenu?.edgeId) return
    if (action === 'delete') {
      setEdges(eds => eds.filter(e => e.id !== contextMenu.edgeId))
    }
  }, [contextMenu, setEdges])

  const handleContextMenuSelect = useCallback((key) => {
    if (contextMenu?.mode === 'node') handleNodeAction(key)
    else if (contextMenu?.mode === 'edge') handleEdgeAction(key)
    else handleAddNode(key)
  }, [contextMenu, handleNodeAction, handleEdgeAction, handleAddNode])

  // 이미지 드롭 → image 노드 생성

  return (
    <CharactersContext.Provider value={{ characters, saveCharacter, deleteCharacter }}>
    <ProjectContext.Provider value={activeId}>
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh' }}>
      <SceneNavBar
        nodes={nodes}
        onAddScene={addScene}
        onDeleteScene={deleteScene}
        projects={projects}
        activeProject={activeProject}
        saveState={saveState}
        savedAt={savedAt}
        onSwitchProject={handleSwitchProject}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
        onRenameProject={renameProject}
      />
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
      <button
        disabled={!hasHiggsfieldAuthError}
        onClick={() => window.open('http://localhost:3002/auth/higgsfield/start', '_blank')}
        title={hasHiggsfieldAuthError ? 'Higgsfield 재연결' : 'Higgsfield 연결됨'}
        style={{
          position: 'fixed', bottom: 200, left: 12, zIndex: 10,
          height: 32, paddingInline: 10, borderRadius: 7,
          border: `1px solid ${hasHiggsfieldAuthError ? 'rgba(245,158,11,0.55)' : 'var(--controls-border)'}`,
          background: hasHiggsfieldAuthError ? 'rgba(245,158,11,0.14)' : 'var(--controls-bg)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          cursor: hasHiggsfieldAuthError ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 11, fontWeight: 700,
          color: hasHiggsfieldAuthError ? '#F59E0B' : 'var(--t4)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          transition: 'all 0.2s',
          opacity: hasHiggsfieldAuthError ? 1 : 0.5,
        }}
      >
        <span style={{
          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
          background: hasHiggsfieldAuthError ? '#F59E0B' : '#22c55e',
          boxShadow: hasHiggsfieldAuthError ? '0 0 6px #F59E0B' : '0 0 6px #22c55e',
        }} />
        {hasHiggsfieldAuthError ? '재연결 필요' : 'HF 연결됨'}
      </button>
      {/* 크레딧 / 사용량 카드 */}
      <div style={{ position: 'fixed', top: 82, right: 16, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          {
            label: '💎 Higgsfield Credit',
            value: hfCredits === 'error' ? 'Error' : hfCredits === null ? '——' : String(hfCredits),
            isError: hfCredits === 'error',
            onClick: fetchHfCredits,
            title: hfCreditsRaw ?? '클릭하여 새로고침',
          },
          {
            label: '🤖 Claude API usage',
            value: claudeCost === 'error' ? 'Error' : claudeCost === null ? '——' : `$ ${claudeCost.toFixed(4)}`,
            isError: claudeCost === 'error',
            onClick: fetchClaudeCost,
            title: '이 프로젝트의 Claude API 누적 비용',
          },
        ].map(({ label, value, isError, onClick, title }) => (
          <button key={label} onClick={onClick} title={title} style={{
            width: 164, padding: '9px 13px', borderRadius: 11, textAlign: 'left',
            border: '1px solid var(--controls-border)',
            background: 'var(--controls-bg)',
            backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
          }}>
            <div style={{ fontSize: 10, color: 'var(--t1)', opacity: 0.45, marginBottom: 5, letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
              {label}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1, color: isError ? '#E34054' : 'var(--t1)', letterSpacing: '-0.02em' }}>
              <SlotCounter value={value} />
            </div>
          </button>
        ))}
      </div>
      <button
        onClick={toggleTheme}
        title={theme === 'dark' ? '라이트 모드' : '다크 모드'}
        style={{
          position: 'fixed', bottom: 160, left: 12, zIndex: 10,
          width: 32, height: 32, borderRadius: 7,
          border: '1px solid var(--controls-border)',
          background: 'var(--controls-bg)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: theme === 'dark' ? '#a0b0d0' : '#5a6a90',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}
      >
        {theme === 'dark'
          ? <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        }
      </button>
      <ReactFlow
        nodes={nodes}
        edges={activeEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneContextMenu={onPaneContextMenu}
        onPaneClick={onPaneClick}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.1 }}
        panOnScroll
        panOnDrag={[1, 2]}
        zoomOnScroll={false}
        selectionOnDrag={false}
        minZoom={0.08}
        maxZoom={2}
        defaultEdgeOptions={{ type: 'smoothstep' }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color={theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.09)'}
        />
        <Controls style={{ background: 'var(--controls-bg)', border: '1px solid var(--controls-border)', borderRadius: 8 }} />
        <MiniMap
          style={{ background: 'var(--minimap-bg)', border: '1px solid var(--controls-border)', borderRadius: 8 }}
          nodeColor="rgba(41,217,217,0.35)"
          maskColor="var(--minimap-mask)"
        />
      </ReactFlow>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          mode={contextMenu.mode ?? 'pane'}
          onSelect={handleContextMenuSelect}
          onClose={() => setContextMenu(null)}
        />
      )}
      </div>
    </div>
    </ProjectContext.Provider>
    </CharactersContext.Provider>
  )
}

export default function App() {
  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  )
}
