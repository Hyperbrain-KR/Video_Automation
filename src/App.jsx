import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useAuth } from './lib/AuthContext'
import LoginPage from './components/LoginPage'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  useNodesState, useEdgesState, useReactFlow,
  addEdge, BackgroundVariant,
} from '@xyflow/react'
import { CANVAS_API } from './lib/config'
import { CharactersContext } from './lib/CharactersContext'
import { ProjectContext } from './lib/ProjectContext'
import { deleteProjectImages, saveImage as saveImageDB, deleteImage as deleteImageDB } from './lib/imageDB'
import { useProjects } from './hooks/useProjects'
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

const DEFAULT_PROJ_DEFAULTS = {
  image: { model: 'nano_banana_pro', quality: '1k', aspectRatio: 'auto' },
  video: { videoMode: 'pro', videoAspect: '9:16', sound: 'off', duration: 5 },
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
  const { user } = useAuth()

  const [nodes, setNodes, onNodesChange] = useNodesState(nodes0)
  const [edges, setEdges, onEdgesChange] = useEdgesState(edges0)
  const [characters, setCharacters] = useState([])
  const [isDataReady, setIsDataReady] = useState(false)

  // ── 프로젝트 관리 ──────────────────────────────────────────────────────
  const {
    projects, activeId, activeProject, loading,
    loadProject, saveProject, saveProjectDefaults, createProject, switchProject, deleteProject, renameProject,
  } = useProjects(user)

  const [projectDefaults, setProjectDefaults] = useState(DEFAULT_PROJ_DEFAULTS)
  const [showDefaultsModal, setShowDefaultsModal] = useState(false)
  const [draftDefaults, setDraftDefaults] = useState(DEFAULT_PROJ_DEFAULTS)

  const [saveState, setSaveState] = useState('idle') // 'idle' | 'pending' | 'saved'
  const [savedAt, setSavedAt]     = useState(null)
  const saveTimerRef = useRef(null)
  const isMountedRef = useRef(false)
  const initialLoadDoneRef = useRef(false)
  const pollingNodeIds = useRef(new Set())

  useClaudeGenerate(activeId)
  const resumePolling = useHiggsfieldGenerate(characters)

  const resumeInProgressPolling = useCallback((loadedNodes) => {
    loadedNodes
      .filter(n => (n.data?.status === 'generating' || n.data?.status === 'slow') && n.data?.jobId)
      .forEach(n => {
        if (pollingNodeIds.current.has(n.id)) return
        pollingNodeIds.current.add(n.id)
        resumePolling(n.id, n.data.jobId, n.data.type === 'video')
          .finally(() => pollingNodeIds.current.delete(n.id))
      })
  }, [resumePolling])

  // base64 imageDataUrl은 용량 한도 초과 방지를 위해 저장에서 제외
  const stripLargeData = (nodes) => nodes.map(n => {
    if (!n.data?.imageDataUrl) return n
    return { ...n, data: { ...n.data, imageDataUrl: null } }
  })

  // Supabase에서 최초 프로젝트 데이터 로드
  useEffect(() => {
    if (loading || initialLoadDoneRef.current) return
    initialLoadDoneRef.current = true
    const doLoad = async () => {
      try {
        if (activeId) {
          const data = await loadProject(activeId)
          if (data) {
            isMountedRef.current = false  // 로드 후 auto-save skip
            const loadedNodes = data.nodes ?? nodes0
            setNodes(resetInProgressNodes(loadedNodes))
            setEdges(data.edges ?? edges0)
            setCharacters(data.characters ?? [])
            if (data.defaults) { setProjectDefaults(data.defaults); setDraftDefaults(data.defaults) }
            resumeInProgressPolling(loadedNodes)
          }
        }
      } catch (e) {
        console.error('[초기 로드 실패]', e)
      }
      setIsDataReady(true)
    }
    doLoad()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  // 노드/엣지 변경 시 auto-save (마운트 직후 첫 렌더는 skip)
  useEffect(() => {
    if (!isMountedRef.current) { isMountedRef.current = true; return }
    setSaveState('pending')
    clearTimeout(saveTimerRef.current)
    const snapNodes = stripLargeData(nodes)
    const snapEdges = edges
    const snapChars = characters
    const snapActiveId = activeId
    saveTimerRef.current = setTimeout(async () => {
      try {
        if (snapActiveId) {
          await saveProject(snapActiveId, snapNodes, snapEdges, snapChars)
        } else {
          await createProject('내 프로젝트', snapNodes, snapEdges, snapChars)
        }
        setSaveState('saved')
        setSavedAt(new Date())
      } catch (e) {
        console.warn('캔버스 저장 실패:', e)
        setSaveState('idle')
      }
    }, 1500)
    return () => clearTimeout(saveTimerRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, characters])

  const handleSwitchProject = useCallback(async (id) => {
    clearTimeout(saveTimerRef.current)
    if (activeId) await saveProject(activeId, stripLargeData(nodes), edges, characters)
    const data = await switchProject(id)
    if (data) {
      isMountedRef.current = false
      const loadedNodes = data.nodes ?? nodes0
      setNodes(resetInProgressNodes(loadedNodes))
      setEdges(data.edges ?? edges0)
      setCharacters(data.characters ?? [])
      const d = data.defaults ?? DEFAULT_PROJ_DEFAULTS
      setProjectDefaults(d); setDraftDefaults(d)
      resumeInProgressPolling(loadedNodes)
    }
    setSaveState('idle')
    setSavedAt(null)
    isMountedRef.current = false
  }, [activeId, nodes, edges, characters, saveProject, switchProject, setNodes, setEdges, setCharacters, resumeInProgressPolling])

  const handleDeleteProject = useCallback(async (id) => {
    clearTimeout(saveTimerRef.current)
    deleteProjectImages(id).catch(() => {})
    const remaining = await deleteProject(id)
    if (id === activeId) {
      if (remaining.length > 0) {
        const data = await switchProject(remaining[0].id)
        if (data) {
          isMountedRef.current = false
          setNodes(resetInProgressNodes(data.nodes ?? nodes0))
          setEdges(data.edges ?? edges0)
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

  const handleCreateProject = useCallback(async (name) => {
    clearTimeout(saveTimerRef.current)
    if (activeId) await saveProject(activeId, stripLargeData(nodes), edges, characters)
    await createProject(name, nodes0, edges0, [])
    isMountedRef.current = false
    setNodes(nodes0)
    setEdges(edges0)
    setCharacters([])
    setSaveState('idle')
    setSavedAt(null)
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
    const { nodes: newNodes, edges: newEdges } = buildScene(sceneIdx, projectDefaults.image, projectDefaults.video)
    setNodes(nds => [...nds, ...newNodes])
    setEdges(eds => [...eds, ...newEdges])
  }, [getNodes, setNodes, setEdges, projectDefaults])

  const applyDefaultsToAll = useCallback((defaults) => {
    const d = defaults ?? projectDefaults
    setNodes(nds => nds.map(n => {
      if (n.type !== 'higgsfieldNode') return n
      if (n.data.type === 'image' && n.data.label !== '캐릭터 생성')
        return { ...n, data: { ...n.data, ...d.image } }
      if (n.data.type === 'video')
        return { ...n, data: { ...n.data, ...d.video } }
      return n
    }))
  }, [setNodes, projectDefaults])

  // 노드 연결
  const onConnect = useCallback((params) => {
    setEdges(eds => addEdge({ ...params, type: 'smoothstep' }, eds))
  }, [setEdges])

  // ── Higgsfield 크레딧 조회 ───────────────────────────────
  const [hfCredits, setHfCredits] = useState(null)
  const [hfCreditsRaw, setHfCreditsRaw] = useState(null)
  const fetchHfCredits = useCallback(() => {
    fetch(`${CANVAS_API}/api/higgsfield/credits`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setHfCredits('error'); return }
        setHfCredits(d.credits)
        setHfCreditsRaw(d.raw ?? null)
      })
      .catch(() => setHfCredits('error'))
  }, [])

  // ── Higgsfield 인증 오류 감지 ────────────────────────────
  const hasHiggsfieldAuthError = useMemo(
    () => nodes.some(n => n.data?.status === 'auth_error') || hfCredits === 'error',
    [nodes, hfCredits]
  )
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
    fetch(`${CANVAS_API}/api/usage/claude?projectId=${encodeURIComponent(activeId)}`)
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
      {!isDataReady && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 9999,
          background: 'var(--bg, #0A0A0F)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 12,
        }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1, #F4F4F4)' }}>Canvas</div>
          <div style={{ fontSize: 12, color: 'rgba(244,244,244,0.4)' }}>불러오는 중...</div>
        </div>
      )}
      {/* 프로젝트 기본값 설정 버튼 */}
      <button
        onClick={() => { setDraftDefaults(projectDefaults); setShowDefaultsModal(true) }}
        title="생성 기본값 설정"
        style={{
          position: 'fixed', bottom: 240, left: 12, zIndex: 10,
          height: 32, paddingInline: 10, borderRadius: 7,
          border: '1px solid var(--controls-border)',
          background: 'var(--controls-bg)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 11, fontWeight: 700, color: 'var(--t4)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}
      >⚙ 생성 기본값</button>

      {/* 기본값 설정 모달 */}
      {showDefaultsModal && (
        <div
          onClick={() => setShowDefaultsModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.6)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--node-bg, #12131f)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12, padding: 24, width: 300,
              backdropFilter: 'blur(20px)', boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
              display: 'flex', flexDirection: 'column', gap: 16,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--t1)' }}>⚙ 생성 기본값 설정</div>

            {/* 이미지 */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#29D9D9', marginBottom: 8, letterSpacing: '0.06em' }}>이미지</div>
              {[
                { label: '모델', key: 'model', opts: [['nano_banana_pro','나노바나나 Pro'],['gpt_image_2','GPT 이미지 2']] },
                { label: '퀄리티', key: 'quality', opts: draftDefaults.image.model === 'gpt_image_2'
                    ? [['low','Low'],['medium','Medium'],['high','High']]
                    : [['720','720p'],['1k','1K'],['2k','2K'],['4k','4K']] },
                { label: '비율', key: 'aspectRatio', opts: [['auto','Auto'],['1:1','1:1'],['3:4','3:4'],['4:3','4:3'],['9:16','9:16'],['16:9','16:9']] },
              ].map(({ label, key, opts }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: 'var(--t4)', width: 44, flexShrink: 0 }}>{label}</span>
                  <select
                    value={draftDefaults.image[key]}
                    onChange={e => setDraftDefaults(d => ({ ...d, image: { ...d.image, [key]: e.target.value,
                      ...(key === 'model' ? { quality: e.target.value === 'gpt_image_2' ? 'high' : '1k' } : {}) } }))}
                    style={{ flex: 1, background: 'var(--node-input,#1a1b2e)', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 5, color: 'var(--t2)', padding: '4px 6px', fontSize: 10, fontFamily: 'inherit' }}
                  >
                    {opts.map(([v, l]) => <option key={v} value={v} style={{ background: '#0d1020' }}>{l}</option>)}
                  </select>
                </div>
              ))}
            </div>

            {/* 비디오 */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(170,110,255,1)', marginBottom: 8, letterSpacing: '0.06em' }}>비디오</div>
              {[
                { label: '모드', key: 'videoMode', opts: [['std','Standard'],['pro','Pro'],['4k','4K']] },
                { label: '비율', key: 'videoAspect', opts: [['16:9','16:9'],['9:16','9:16'],['1:1','1:1']] },
                { label: '오디오', key: 'sound', opts: [['off','Off'],['on','On']] },
              ].map(({ label, key, opts }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: 'var(--t4)', width: 44, flexShrink: 0 }}>{label}</span>
                  <select
                    value={draftDefaults.video[key]}
                    onChange={e => setDraftDefaults(d => ({ ...d, video: { ...d.video, [key]: e.target.value } }))}
                    style={{ flex: 1, background: 'var(--node-input,#1a1b2e)', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 5, color: 'var(--t2)', padding: '4px 6px', fontSize: 10, fontFamily: 'inherit' }}
                  >
                    {opts.map(([v, l]) => <option key={v} value={v} style={{ background: '#0d1020' }}>{l}</option>)}
                  </select>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, color: 'var(--t4)', width: 44, flexShrink: 0 }}>길이</span>
                <input
                  type="range" min={3} max={15} step={1}
                  value={draftDefaults.video.duration}
                  onChange={e => setDraftDefaults(d => ({ ...d, video: { ...d.video, duration: Number(e.target.value) } }))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: 10, color: 'var(--t2)', width: 24 }}>{draftDefaults.video.duration}s</span>
              </div>
            </div>

            {/* 버튼 */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  setProjectDefaults(draftDefaults)
                  saveProjectDefaults(activeId, draftDefaults)
                  setShowDefaultsModal(false)
                }}
                style={{ flex: 1, padding: '7px 0', borderRadius: 7, border: 'none',
                  background: '#29D9D9', color: '#0a0a0f', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >저장</button>
              <button
                onClick={() => {
                  setProjectDefaults(draftDefaults)
                  saveProjectDefaults(activeId, draftDefaults)
                  applyDefaultsToAll(draftDefaults)
                  setShowDefaultsModal(false)
                }}
                style={{ flex: 1, padding: '7px 0', borderRadius: 7,
                  border: '1px solid rgba(170,110,255,0.5)',
                  background: 'rgba(170,110,255,0.1)', color: 'rgba(170,110,255,1)',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >저장 + 전체 적용</button>
            </div>
          </div>
        </div>
      )}

      <button
        disabled={!hasHiggsfieldAuthError}
        onClick={() => {
          // localhost:3002 is the only redirect_uri registered with Higgsfield OAuth.
          // On production, open local server with relay param so it forwards the token back.
          const isLocal = CANVAS_API === 'http://localhost:3002'
          const url = isLocal
            ? 'http://localhost:3002/auth/higgsfield/start'
            : `http://localhost:3002/auth/higgsfield/start?relay=${encodeURIComponent(CANVAS_API)}`
          window.open(url, '_blank')
        }}
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
  const { user } = useAuth()

  if (user === undefined) return null  // 로딩중
  if (user === null) return <LoginPage />

  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  )
}
