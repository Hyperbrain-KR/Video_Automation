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
import { AssetsContext } from './lib/AssetsContext'
import { ProjectContext } from './lib/ProjectContext'
import { deleteProjectImages, saveImage as saveImageDB, deleteImage as deleteImageDB, loadImage as loadImageDB } from './lib/imageDB'
import { useProjects } from './hooks/useProjects'
import { useAssets } from './hooks/useAssets'
import { nodes0, edges0, buildScene, nodeTemplates, resetInProgressNodes, dataEdge } from './lib/initialCanvas'
import { useClaudeGenerate } from './hooks/useClaudeGenerate'
import { useHiggsfieldGenerate } from './hooks/useHiggsfieldGenerate'
import { useVersionCheck } from './hooks/useVersionCheck'
import '@xyflow/react/dist/style.css'
import './App.css'

import ReviewGateNode from './nodes/ReviewGateNode'
import StyleAnchorInputNode from './nodes/StyleAnchorInputNode'
import TextInputNode from './nodes/TextInputNode'
import VideoDirectionNode from './nodes/VideoDirectionNode'
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
  videoDirectionInput: VideoDirectionNode,
  claudeNode: ClaudeNode,
  higgsfieldNode: HiggsfieldNode,
  sectionBackground: SectionBackgroundNode,
  scriptImport: ScriptImportNode,
  referenceImage: ReferenceImageNode,
}

function AssetPanelThumb({ asset, onDelete }) {
  const [src, setSrc] = useState(() => asset.hasLocalImage ? null : (asset.resultUrl ?? null))
  const [hovered, setHovered] = useState(false)
  useEffect(() => {
    if (!asset.hasLocalImage) return
    loadImageDB(`asset-${asset.id}`).then(url => setSrc(url ?? null)).catch(() => {})
  }, [asset.id, asset.hasLocalImage])
  return (
    <div title={asset.name}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative', borderRadius: 6, overflow: 'hidden', aspectRatio: '1',
        background: 'var(--node-bg)', border: '1px solid var(--sep)' }}
    >
      {src
        ? <img src={src} alt={asset.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📦</div>
      }
      {hovered && (
        <>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }} />
          <div style={{ position: 'absolute', bottom: 2, left: 2, right: 2,
            fontSize: 8, color: '#fff', textAlign: 'center',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.name}</div>
          <button onClick={onDelete}
            style={{ position: 'absolute', top: 2, right: 2, width: 14, height: 14, padding: 0,
              background: 'rgba(227,64,84,0.85)', border: 'none', borderRadius: '50%',
              fontSize: 8, color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >✕</button>
        </>
      )}
    </div>
  )
}

function FlowCanvas() {
  const { screenToFlowPosition, getNodes, getEdges } = useReactFlow()
  const { user } = useAuth()

  const [nodes, setNodes, onNodesChange] = useNodesState(nodes0)
  const [edges, setEdges, onEdgesChange] = useEdgesState(edges0)
  const [characters, setCharacters] = useState([])
  const [isDataReady, setIsDataReady] = useState(false)
  const [canvasKey, setCanvasKey] = useState('initial')

  // ── 프로젝트 관리 ──────────────────────────────────────────────────────
  const {
    projects, activeId, activeProject, loading,
    loadProject, saveProject, saveProjectDefaults, createProject, switchProject, deleteProject, renameProject,
  } = useProjects(user)

  const [projectDefaults, setProjectDefaults] = useState(DEFAULT_PROJ_DEFAULTS)
  const [showDefaultsModal, setShowDefaultsModal] = useState(false)
  const [showAssetsPanel, setShowAssetsPanel] = useState(false)
  const [showEdges, setShowEdges] = useState(true)
  const [draftDefaults, setDraftDefaults] = useState(DEFAULT_PROJ_DEFAULTS)

  const [saveState, setSaveState] = useState('idle') // 'idle' | 'pending' | 'saved'
  const [savedAt, setSavedAt]     = useState(null)
  const saveTimerRef = useRef(null)
  const isMountedRef = useRef(false)
  const initialLoadDoneRef = useRef(false)
  const pollingNodeIds = useRef(new Set())
  const generationEpochRef = useRef(0)

  // ── Undo history ─────────────────────────────────────────────────────
  const historyRef = useRef([])
  const historyIdxRef = useRef(-1)
  const pushHistory = useCallback(() => {
    historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1)
    historyRef.current.push({ nodes, edges })
    historyIdxRef.current = historyRef.current.length - 1
    if (historyRef.current.length > 50) {
      historyRef.current.shift()
      historyIdxRef.current--
    }
  }, [nodes, edges])

  const pushHistoryRef = useRef(null)
  useEffect(() => { pushHistoryRef.current = pushHistory }, [pushHistory])

  // ── 키보드 삭제 확인 ─────────────────────────────────────────────────
  const [confirmDelete, setConfirmDelete] = useState(false)
  const pendingDeleteRef = useRef(null)

  const onNodesChangeWithHistory = useCallback((changes) => {
    if (changes.some(c => c.type === 'remove')) pushHistory()
    onNodesChange(changes)
  }, [onNodesChange, pushHistory])

  const onEdgesChangeWithHistory = useCallback((changes) => {
    if (changes.some(c => c.type === 'remove')) pushHistory()
    onEdgesChange(changes)
  }, [onEdgesChange, pushHistory])

  const normalizeSectionNodes = useCallback((nds) =>
    nds.map(n => {
      if (n.type !== 'sectionBackground') return n
      // 마이그레이션: 헤더가 노드 내부에 포함되지 않은 기존 저장 데이터 처리
      if (!n.data?.headerIncluded) {
        return {
          ...n,
          draggable: true, dragHandle: '.section-drag-handle', zIndex: 0,
          position: { x: n.position.x, y: n.position.y - 30 },
          data: { ...n.data, height: (n.data.height ?? 470) + 30, headerIncluded: true, isDragging: false },
        }
      }
      return { ...n, draggable: true, dragHandle: '.section-drag-handle', zIndex: 0, data: { ...n.data, isDragging: false } }
    }), [])

  // 기존 저장 프로젝트의 비디오 연출 노드(textInput)를 videoDirectionInput으로 마이그레이션
  // reviewImageResult / reviewVideoResult 제거 + 승인 상태 higgsfieldImage/Video로 이전
  // normalizeSectionNodes와 체이닝해서 한 번에 처리
  const normalizeNodes = useCallback((nds) => {
    const afterSection = normalizeSectionNodes(nds)
    // approved 상태 수집 (reviewImageResult → higgsfieldImage, reviewVideoResult → higgsfieldVideo)
    const approvedMap = {}
    afterSection.forEach(n => {
      if (n.type === 'reviewGate' && n.data?.approved) {
        if (n.id === 'reviewImageResult' || n.id.startsWith('reviewImageResult-')) {
          const uid = n.id === 'reviewImageResult' ? null : n.id.replace('reviewImageResult-', '')
          approvedMap[uid ? `higgsfieldImage-${uid}` : 'higgsfieldImage'] = true
        } else if (n.id === 'reviewVideoResult' || n.id.startsWith('reviewVideoResult-')) {
          const uid = n.id === 'reviewVideoResult' ? null : n.id.replace('reviewVideoResult-', '')
          approvedMap[uid ? `higgsfieldVideo-${uid}` : 'higgsfieldVideo'] = true
        }
      }
    })
    return afterSection
      .filter(n => n.id !== 'reviewImageResult' && n.id !== 'reviewVideoResult' &&
                   !n.id.startsWith('reviewImageResult-') && !n.id.startsWith('reviewVideoResult-'))
      .map(n => {
        if (n.type === 'textInput' && n.data?.label?.includes('비디오 연출'))
          return { ...n, type: 'videoDirectionInput' }
        if (approvedMap[n.id])
          return { ...n, data: { ...n.data, approved: true } }
        return n
      })
  }, [normalizeSectionNodes])

  // 기존 저장 프로젝트의 reviewImageResult/reviewVideoResult 관련 엣지 제거 + 첫프레임 엣지 추가
  const normalizeEdges = useCallback((edgs, normalizedNodes) => {
    const filtered = edgs.filter(e =>
      !e.source?.includes('reviewImageResult') && !e.target?.includes('reviewImageResult') &&
      !e.source?.includes('reviewVideoResult') && !e.target?.includes('reviewVideoResult')
    )
    const toAdd = []
    normalizedNodes.forEach(n => {
      if (n.id !== 'higgsfieldImage' && !n.id.startsWith('higgsfieldImage-')) return
      const uid = n.id === 'higgsfieldImage' ? null : n.id.replace('higgsfieldImage-', '')
      const targetId = uid ? `higgsfieldVideo-${uid}` : 'higgsfieldVideo'
      const edgeId = uid ? `e-hi-hv-${uid}` : 'e-hi-hv'
      const exists = filtered.some(e => e.id === edgeId || (e.source === n.id && e.target === targetId && e.targetHandle === 'image'))
      if (!exists) toAdd.push({ id: edgeId, source: n.id, target: targetId, targetHandle: 'image', label: '첫 프레임', ...dataEdge })
    })
    return [...filtered, ...toAdd]
  }, [])

  const sectionDragRef = useRef(null)

  const onSectionDragStart = useCallback((_, node) => {
    if (node.type !== 'sectionBackground') return
    const { x: sx, y: sy } = node.position
    const w = node.data.width ?? 940
    const h = node.data.height ?? 500
    const captiveIds = getNodes()
      .filter(n => n.type !== 'sectionBackground')
      .filter(n => n.position.x >= sx && n.position.x <= sx + w && n.position.y >= sy && n.position.y <= sy + h)
      .map(n => n.id)
    sectionDragRef.current = { captiveIds, lastPos: { ...node.position } }
    setNodes(nds => nds.map(n => n.id === node.id ? { ...n, data: { ...n.data, isDragging: true } } : n))
  }, [getNodes, setNodes])

  const onSectionDrag = useCallback((_, node) => {
    if (node.type !== 'sectionBackground' || !sectionDragRef.current) return
    const { lastPos, captiveIds } = sectionDragRef.current
    const dx = node.position.x - lastPos.x
    const dy = node.position.y - lastPos.y
    sectionDragRef.current.lastPos = { ...node.position }
    if (!captiveIds.length) return
    setNodes(nds => nds.map(n =>
      captiveIds.includes(n.id)
        ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
        : n
    ))
  }, [setNodes])

  const onSectionDragStop = useCallback((_, node) => {
    if (node.type !== 'sectionBackground') return
    sectionDragRef.current = null
    setNodes(nds => nds.map(n => n.id === node.id ? { ...n, data: { ...n.data, isDragging: false } } : n))
  }, [setNodes])

  useClaudeGenerate(activeId)
  const { assets, saveAsset, deleteAsset } = useAssets(user)
  const resumePolling = useHiggsfieldGenerate(characters, assets, generationEpochRef)

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
            const loadedNodes = normalizeNodes(data.nodes ?? nodes0)
            setNodes(resetInProgressNodes(loadedNodes))
            setEdges(normalizeEdges(data.edges ?? edges0, loadedNodes))
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
        const dirtyNodes = snapNodes.filter(n => n.data?.resultUrl)
        console.log(`[auto-save] → projectId: ${snapActiveId}, resultUrl 있는 노드:`, dirtyNodes.map(n => `${n.id}(${n.data?.resultUrl?.slice(0,40)})`))
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
    generationEpochRef.current++
    clearTimeout(saveTimerRef.current)
    if (activeId) await saveProject(activeId, stripLargeData(nodes), edges, characters)
    const data = await switchProject(id)
    if (data) {
      isMountedRef.current = false
      const loadedNodes = normalizeNodes(data.nodes ?? nodes0)
      const dirtyLoaded = loadedNodes.filter(n => n.data?.resultUrl)
      console.log(`[switchProject] 로드된 projectId: ${id}, resultUrl 있는 노드:`, dirtyLoaded.map(n => `${n.id}(${n.data?.resultUrl?.slice(0,40)})`))
      setNodes(resetInProgressNodes(loadedNodes))
      setEdges(normalizeEdges(data.edges ?? edges0, loadedNodes))
      setCharacters(data.characters ?? [])
      const d = data.defaults ?? DEFAULT_PROJ_DEFAULTS
      setProjectDefaults(d); setDraftDefaults(d)
      setCanvasKey(id)
      resumeInProgressPolling(loadedNodes)
    }
    setSaveState('idle')
    setSavedAt(null)
    isMountedRef.current = false
  }, [activeId, nodes, edges, characters, saveProject, switchProject, setNodes, setEdges, setCharacters, setCanvasKey, resumeInProgressPolling, normalizeNodes, normalizeEdges])

  const handleDeleteProject = useCallback(async (id) => {
    clearTimeout(saveTimerRef.current)
    // 삭제할 프로젝트의 노드/캐릭터 데이터로 이미지 키 수집
    if (id === activeId) {
      deleteProjectImages(nodes, characters, id).catch(() => {})
    } else {
      loadProject(id).then(data => {
        if (data) deleteProjectImages(data.nodes, data.characters, id).catch(() => {})
      })
    }
    const remaining = await deleteProject(id)
    if (id === activeId) {
      if (remaining.length > 0) {
        const data = await switchProject(remaining[0].id)
        if (data) {
          isMountedRef.current = false
          const loadedNodes = normalizeNodes(data.nodes ?? nodes0)
          setNodes(resetInProgressNodes(loadedNodes))
          setEdges(normalizeEdges(data.edges ?? edges0, loadedNodes))
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
  }, [activeId, nodes, characters, loadProject, deleteProject, switchProject, setNodes, setEdges, setCharacters, normalizeNodes, normalizeEdges])

  const handleCreateProject = useCallback(async (name) => {
    generationEpochRef.current++
    clearTimeout(saveTimerRef.current)
    if (activeId) await saveProject(activeId, stripLargeData(nodes), edges, characters)
    const freshNodes = JSON.parse(JSON.stringify(nodes0))
    const freshEdges = JSON.parse(JSON.stringify(edges0))
    const newId = await createProject(name, freshNodes, freshEdges, [])
    isMountedRef.current = false
    setNodes(freshNodes)
    setEdges(freshEdges)
    setCharacters([])
    setCanvasKey(newId ?? `new-${Date.now()}`)
    setSaveState('idle')
    setSavedAt(null)
  }, [activeId, nodes, edges, characters, saveProject, createProject, setNodes, setEdges, setCharacters, setCanvasKey])

  const handleResetProject = useCallback(() => {
    const DROP = ['resultUrl', 'resultHistory', 'resultIndex', 'status', 'jobId', 'creditsUsed', 'approved',
                  'error', 'generatingStartedAt', 'generatedAt', 'sheetGenerating', 'sheetError']
    setNodes(nds => nds.map(n => {
      if (n.type !== 'higgsfieldNode') return n
      const clean = { ...n.data }
      DROP.forEach(k => delete clean[k])
      clean.status = 'idle'
      return { ...n, data: clean }
    }))
  }, [setNodes])

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
    pushHistory()
    setNodes(nds => nds.filter(n => !n.id.endsWith(`-${uid}`)))
    setEdges(eds => eds.filter(e => !e.id.endsWith(`-${uid}`)))
  }, [pushHistory, setNodes, setEdges])

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

  // ── 업데이트 알림 ─────────────────────────────────────────
  const { hasUpdate, changelog } = useVersionCheck()
  const [showChangelog, setShowChangelog] = useState(false)
  const [openMonths, setOpenMonths] = useState(new Set())
  const [openDates, setOpenDates] = useState(new Set())
  const [changelogSeen, setChangelogSeen] = useState(() => {
    try { return localStorage.getItem('changelog-seen-v2') ?? '' } catch { return '' }
  })
  const changelogNewKey = useMemo(() => {
    if (!changelog.length) return ''
    const first = changelog[0]
    const newCount = first.items?.filter(i => i.startsWith('[NEW]')).length ?? 0
    return `${first.date}-${newCount}`
  }, [changelog])
  const openChangelogModal = useCallback(() => {
    if (changelog.length) {
      const first = changelog[0]
      const [y, m] = first.date.split('-')
      setOpenMonths(new Set([`${y}-${m}`]))
      setOpenDates(new Set([first.date]))
    }
    setShowChangelog(true)
  }, [changelog])
  const closeChangelog = useCallback(() => {
    try { localStorage.setItem('changelog-seen-v2', changelogNewKey) } catch (e) { void e }
    setChangelogSeen(changelogNewKey)
    setShowChangelog(false)
  }, [changelogNewKey])

  // ── Higgsfield 인증 오류 감지 ────────────────────────────
  const hasHiggsfieldAuthError = useMemo(
    () => nodes.some(n => n.data?.status === 'auth_error') || hfCredits === 'error',
    [nodes, hfCredits]
  )
  useEffect(() => {
    fetchHfCredits()
    const interval = setInterval(fetchHfCredits, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchHfCredits])
  useEffect(() => {
    const handler = () => { if (!document.hidden) fetchHfCredits() }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [fetchHfCredits])
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
      pushHistory()
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
  }, [contextMenu, nodes, pushHistory, setNodes, setEdges])

  // ── 엣지 삭제 ─────────────────────────────────────────────
  const handleEdgeAction = useCallback((action) => {
    if (!contextMenu?.edgeId) return
    if (action === 'delete') {
      pushHistory()
      setEdges(eds => eds.filter(e => e.id !== contextMenu.edgeId))
    }
  }, [contextMenu, pushHistory, setEdges])

  useEffect(() => {
    const handleUndo = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== 'z' || e.shiftKey) return
      const el = document.activeElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      e.preventDefault()
      if (historyIdxRef.current < 0) return
      const snap = historyRef.current[historyIdxRef.current]
      historyIdxRef.current--
      setNodes(snap.nodes)
      setEdges(snap.edges)
    }
    window.addEventListener('keydown', handleUndo)
    return () => window.removeEventListener('keydown', handleUndo)
  }, [setNodes, setEdges])

  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const el = document.activeElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      const selNodes = getNodes().filter(n => n.selected)
      const selEdges = getEdges().filter(eg => eg.selected)
      if (selNodes.length === 0 && selEdges.length === 0) return
      e.preventDefault()
      pendingDeleteRef.current = {
        nodeIds: selNodes.map(n => n.id),
        edgeIds: selEdges.map(eg => eg.id),
      }
      setConfirmDelete(true)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [getNodes, getEdges])

  const handleConfirmDelete = useCallback(() => {
    if (!pendingDeleteRef.current) return
    const { nodeIds, edgeIds } = pendingDeleteRef.current
    pushHistoryRef.current?.()
    if (nodeIds.length > 0) {
      const idSet = new Set(nodeIds)
      setNodes(nds => nds.filter(n => !idSet.has(n.id)))
      setEdges(eds => eds.filter(e => !idSet.has(e.source) && !idSet.has(e.target)))
    }
    if (edgeIds.length > 0) {
      const edgeIdSet = new Set(edgeIds)
      setEdges(eds => eds.filter(e => !edgeIdSet.has(e.id)))
    }
    pendingDeleteRef.current = null
    setConfirmDelete(false)
  }, [setNodes, setEdges])

  useEffect(() => {
    if (!confirmDelete) return
    const handler = (e) => {
      if (e.key === 'Escape') { pendingDeleteRef.current = null; setConfirmDelete(false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [confirmDelete])

  const handleContextMenuSelect = useCallback((key) => {
    if (contextMenu?.mode === 'node') handleNodeAction(key)
    else if (contextMenu?.mode === 'edge') handleEdgeAction(key)
    else handleAddNode(key)
  }, [contextMenu, handleNodeAction, handleEdgeAction, handleAddNode])

  // 이미지 드롭 → image 노드 생성

  return (
    <AssetsContext.Provider value={{ assets, saveAsset, deleteAsset }}>
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
        onResetProject={handleResetProject}
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
      {/* 좌하단 버튼 그룹 */}
      <div style={{
        position: 'fixed', bottom: 129, left: 12, zIndex: 10,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {/* 프로젝트 기본값 설정 버튼 */}
        <button
          onClick={() => { setDraftDefaults(projectDefaults); setShowDefaultsModal(true) }}
          title="생성 기본값 설정"
          style={{
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
            const isLocal = CANVAS_API === 'http://localhost:3002'
            const url = isLocal
              ? 'http://localhost:3002/auth/higgsfield/start'
              : `http://localhost:3002/auth/higgsfield/start?relay=${encodeURIComponent(CANVAS_API)}`
            window.open(url, '_blank')
          }}
          title={hasHiggsfieldAuthError ? 'Higgsfield 재연결' : 'Higgsfield 연결됨'}
          style={{
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
            label: hfCredits === 'error' ? '🔐 HF 세션 상태' : '💎 HF 크레딧',
            value: hfCredits === 'error' ? '세션 만료' : hfCredits === null ? '——' : String(hfCredits),
            isError: hfCredits === 'error',
            onClick: fetchHfCredits,
            title: hfCredits === 'error' ? '재연결 버튼을 눌러 재인증하세요' : (hfCreditsRaw ?? '클릭하여 새로고침'),
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

        {/* 연결선 표시/숨김 버튼 */}
        <button
          onClick={() => setShowEdges(v => !v)}
          title={showEdges ? '연결선 숨기기' : '연결선 보이기'}
          style={{
            width: 32, height: 32, borderRadius: 7,
            border: `1px solid ${!showEdges ? 'rgba(41,217,217,0.5)' : 'var(--controls-border)'}`,
            background: !showEdges ? 'rgba(41,217,217,0.1)' : 'var(--controls-bg)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={!showEdges ? '#29D9D9' : 'var(--controls-fill)'} strokeWidth="2" strokeLinecap="round">
            {showEdges
              ? <><path d="M5 12h14"/><path d="M5 6h14"/><path d="M5 18h14"/></>
              : <><path d="M5 12h14" strokeDasharray="4 2"/><path d="M5 6h14" strokeDasharray="4 2"/><path d="M5 18h14" strokeDasharray="4 2"/></>
            }
          </svg>
        </button>

        {/* 제품 이미지 관리 버튼 */}
        <button
          onClick={() => setShowAssetsPanel(v => !v)}
          title="제품 이미지 관리"
          style={{
            width: 32, height: 32, borderRadius: 7,
            border: `1px solid ${showAssetsPanel ? 'rgba(41,217,217,0.5)' : 'var(--controls-border)'}`,
            background: showAssetsPanel ? 'rgba(41,217,217,0.1)' : 'var(--controls-bg)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >📦</button>

        {/* 제품 이미지 패널 */}
        {showAssetsPanel && (
          <div style={{
            position: 'fixed', bottom: 90, left: 52, zIndex: 200,
            background: 'var(--controls-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid var(--controls-border)', borderRadius: 12,
            padding: '14px 14px 12px', width: 220,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--t1)' }}>📦 제품 이미지</span>
              <label style={{ cursor: 'pointer' }} title="이미지 추가">
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = ev => saveAsset(file.name.replace(/\.[^.]+$/, ''), ev.target.result)
                    reader.readAsDataURL(file)
                    e.target.value = ''
                  }}
                />
                <span style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 22, height: 22, borderRadius: 5, fontSize: 14, fontWeight: 700,
                  border: '1px solid var(--controls-border)', background: 'var(--node-bg)',
                  color: 'var(--t3)', cursor: 'pointer',
                }}>+</span>
              </label>
            </div>
            {assets.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--t5)', textAlign: 'center', padding: '12px 0' }}>
                + 버튼으로 제품 이미지 추가<br/>
                <span style={{ fontSize: 10, opacity: 0.6 }}>모든 프로젝트에서 공유됩니다</span>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                {assets.map(a => (
                  <AssetPanelThumb key={a.id} asset={a} onDelete={() => deleteAsset(a.id)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 업데이트 내역 버튼 */}
        <button
          onClick={() => openChangelogModal()}
          title="업데이트 내역"
          style={{
            width: 32, height: 32, borderRadius: 7,
            border: '1px solid var(--controls-border)',
            background: 'var(--controls-bg)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, boxShadow: '0 2px 8px rgba(0,0,0,0.2)', position: 'relative',
          }}
        >
          🚀
          {hasUpdate && (
            <span style={{
              position: 'absolute', top: 4, right: 4,
              width: 7, height: 7, borderRadius: '50%',
              background: '#ef4444', boxShadow: '0 0 4px rgba(239,68,68,0.8)',
            }} />
          )}
        </button>
      </div>

      <ReactFlow
        key={canvasKey}
        className={showEdges ? '' : 'edges-hidden'}
        nodes={nodes}
        edges={activeEdges}
        onNodesChange={onNodesChangeWithHistory}
        onEdgesChange={onEdgesChangeWithHistory}
        onConnect={onConnect}
        onNodeDragStart={onSectionDragStart}
        onNodeDrag={onSectionDrag}
        onNodeDragStop={onSectionDragStop}
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
        deleteKeyCode={null}
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

      {/* 업데이트 알림 배너 */}
      {hasUpdate && (
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(30,40,60,0.96)', backdropFilter: 'blur(16px)',
          border: '1px solid rgba(99,179,237,0.4)',
          borderRadius: 12, padding: '10px 16px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          color: '#e2e8f0', fontSize: 13, fontWeight: 500,
        }}>
          <span style={{ fontSize: 16 }}>🚀</span>
          <span>새 버전이 배포됐습니다</span>
          <button
            onClick={() => openChangelogModal()}
            style={{ background: 'none', border: 'none', color: '#63b3ed', cursor: 'pointer', fontSize: 13, padding: 0, textDecoration: 'underline' }}
          >업데이트 내역</button>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#3b82f6', border: 'none', color: '#fff',
              borderRadius: 7, padding: '4px 12px', fontSize: 13,
              fontWeight: 700, cursor: 'pointer',
            }}
          >새로고침</button>
        </div>
      )}

      {/* 업데이트 내역 모달 */}
      {showChangelog && (
        <div
          onClick={closeChangelog}
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--controls-bg)', backdropFilter: 'blur(20px)',
              border: '1px solid var(--controls-border)',
              borderRadius: 16, padding: '28px 32px', minWidth: 360, maxWidth: 480,
              maxHeight: '80vh', display: 'flex', flexDirection: 'column',
              boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--t1)' }}>🚀 업데이트 내역</span>
              <button
                onClick={closeChangelog}
                style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
              >✕</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, marginBottom: 16 }}>
            {(() => {
              const monthGroups = {}
              const monthOrder = []
              changelog.forEach(entry => {
                const [y, m] = entry.date.split('-')
                const key = `${y}-${m}`
                if (!monthGroups[key]) { monthGroups[key] = []; monthOrder.push(key) }
                monthGroups[key].push(entry)
              })
              const toggleMonth = (key) => setOpenMonths(prev => {
                const next = new Set(prev)
                next.has(key) ? next.delete(key) : next.add(key)
                return next
              })
              const toggleDate = (date) => setOpenDates(prev => {
                const next = new Set(prev)
                next.has(date) ? next.delete(date) : next.add(date)
                return next
              })
              const showNewBadge = changelogNewKey !== changelogSeen && changelogNewKey !== ''
              return monthOrder.map(mKey => {
                const [y, m] = mKey.split('-')
                const label = `${y}년 ${parseInt(m)}월`
                const isMonthOpen = openMonths.has(mKey)
                return (
                  <div key={mKey} style={{ marginBottom: 6 }}>
                    <button
                      onClick={() => toggleMonth(mKey)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'rgba(255,255,255,0.05)', border: 'none',
                        borderRadius: 8, padding: '8px 12px', cursor: 'pointer',
                        color: 'var(--t1)', fontSize: 13, fontWeight: 700,
                        textAlign: 'left',
                      }}
                    >
                      <span>{label}</span>
                      <span style={{ fontSize: 10, opacity: 0.5 }}>{isMonthOpen ? '▾' : '▸'}</span>
                    </button>
                    {isMonthOpen && (
                      <div style={{ paddingLeft: 8, marginTop: 4 }}>
                        {monthGroups[mKey].map(entry => {
                          const [, em, ed] = entry.date.split('-')
                          const dateLabel = `${parseInt(em)}월 ${parseInt(ed)}일`
                          const isDateOpen = openDates.has(entry.date)
                          return (
                            <div key={entry.date} style={{ marginBottom: 3 }}>
                              <button
                                onClick={() => toggleDate(entry.date)}
                                style={{
                                  width: '100%', display: 'flex', alignItems: 'center',
                                  justifyContent: 'space-between',
                                  background: 'none', border: 'none',
                                  borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
                                  color: 'var(--t3)', fontSize: 11, fontWeight: 600,
                                  textAlign: 'left', letterSpacing: '0.04em',
                                }}
                              >
                                <span>{dateLabel}</span>
                                <span style={{ fontSize: 9, opacity: 0.5 }}>{isDateOpen ? '▾' : '▸'}</span>
                              </button>
                              {isDateOpen && (
                                <div style={{ margin: '2px 0 6px', paddingLeft: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {entry.items.map((item, j) => {
                                    const hasNewTag = item.startsWith('[NEW]')
                                    const stripped = hasNewTag ? item.slice(5) : item
                                    const match = stripped.match(/^\[(FIX|ADD|UPD)\]\s*/)
                                    const tag = match?.[1] ?? null
                                    const text = match ? stripped.slice(match[0].length) : stripped
                                    const tagStyle = tag === 'FIX'
                                      ? { background: 'rgba(227,64,84,0.15)', color: '#E34054', border: '1px solid rgba(227,64,84,0.28)' }
                                      : tag === 'ADD'
                                      ? { background: 'rgba(41,217,217,0.12)', color: '#29D9D9', border: '1px solid rgba(41,217,217,0.25)' }
                                      : { background: 'rgba(100,136,255,0.13)', color: '#6488ff', border: '1px solid rgba(100,136,255,0.28)' }
                                    const isNew = showNewBadge && hasNewTag
                                    return (
                                      <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                                        {tag
                                          ? <span style={{ ...tagStyle, fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', padding: '2px 5px', borderRadius: 3, flexShrink: 0, marginTop: 1 }}>{tag}</span>
                                          : <span style={{ color: 'var(--t4)', fontSize: 10, flexShrink: 0, marginTop: 1 }}>•</span>
                                        }
                                        {isNew && (
                                          <span style={{
                                            fontSize: 8, fontWeight: 800, letterSpacing: '0.06em',
                                            padding: '2px 5px', borderRadius: 3, flexShrink: 0, marginTop: 1,
                                            background: 'rgba(41,217,217,0.15)', color: '#29D9D9',
                                            border: '1px solid rgba(41,217,217,0.35)',
                                          }}>NEW</span>
                                        )}
                                        <span style={{ fontSize: 12, color: 'var(--t1)', fontWeight: isNew ? 700 : 400, lineHeight: 1.55 }}>{text}</span>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })
            })()}
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{
                width: '100%', padding: '10px 0', flexShrink: 0,
                background: '#3b82f6', border: 'none', borderRadius: 9,
                color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}
            >새로고침하여 적용</button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div
          onClick={() => { pendingDeleteRef.current = null; setConfirmDelete(false) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 10001,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--node-bg, #12131f)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12, padding: '24px 28px',
              display: 'flex', flexDirection: 'column', gap: 16,
              boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
              minWidth: 260,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>선택한 항목을 삭제할까요?</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { pendingDeleteRef.current = null; setConfirmDelete(false) }}
                style={{
                  padding: '7px 16px', borderRadius: 7,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'transparent', color: 'var(--t2)',
                  cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}
              >취소</button>
              <button
                onClick={handleConfirmDelete}
                autoFocus
                style={{
                  padding: '7px 16px', borderRadius: 7, border: 'none',
                  background: '#E34054', color: '#fff',
                  cursor: 'pointer', fontSize: 13, fontWeight: 700,
                }}
              >삭제</button>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
    </ProjectContext.Provider>
    </CharactersContext.Provider>
    </AssetsContext.Provider>
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
